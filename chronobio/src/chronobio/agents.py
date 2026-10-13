"""Hypothesis proposer and skeptical critic.

Division of labour: the model writes and critiques; code verifies. A proposal is
kept only if it cites real claim ids from its evidence pool, names an entity from
its gap, and has a prediction and a *different* falsifier. Opposing evidence and
the uncertainty statement are computed from the claims, never taken from the
model. The critic's rule checks are deterministic and the model can only make a
verdict stricter, never more lenient.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass

from .claims import Rejection
from .graph import Snapshot
from .llm import LLM
from .models import (
    EvidenceClaim, Gap, GraphNode, Hypothesis, HypothesisStatus, Locator, Provenance,
    Publication, RetractionStatus, Review, StudyDesign, Verdict,
)
from .pdf_ingest import contains_verbatim, normalize

AGENT_VERSION = "agents-v1"
POOL_LIMIT = 12                      # claims shown to a model per gap (bounded context)
HUMAN = {StudyDesign.RANDOMIZED, StudyDesign.OBSERVATIONAL}
OPPOSING = {frozenset({"activates", "inhibits"}), frozenset({"no_effect", "activates"}),
            frozenset({"no_effect", "inhibits"})}
MEASURABLE = re.compile(
    r"\d|\b(increase|decrease|reduc|higher|lower|greater|fewer|more|less|improv|worsen|inhibit|activat|"
    r"suppress|enhance|resist|sensitiv|survival|expression|level|rate|response|growth|viability|ratio)", re.I)
ORDER = {Verdict.ACCEPT: 0, Verdict.REVISE: 1, Verdict.REJECT: 2}


@dataclass(frozen=True)
class EvidenceItem:
    claim: EvidenceClaim
    relation: str                    # the graph relation this claim supports
    year: int | None


def build_pool(
    gap: Gap, snap: Snapshot, claims: dict[str, EvidenceClaim], pubs: dict[str, Publication],
) -> list[EvidenceItem]:
    """The gap's own claims first, then claims on neighbouring links, capped for context."""
    relation_of: dict[str, str] = {}
    neighbour: list[str] = []
    for e in snap.edges:
        if e.inferred:
            continue
        for cid, rel in e.evidence:
            relation_of.setdefault(cid, rel)
            if cid not in gap.claim_ids and (e.source in gap.node_ids or e.target in gap.node_ids):
                neighbour.append(cid)
    ordered = [c for c in gap.claim_ids if c in claims] + sorted(set(neighbour) - set(gap.claim_ids))
    items = []
    for cid in ordered[:POOL_LIMIT]:
        pub = pubs.get(claims[cid].publication_id)
        items.append(EvidenceItem(claims[cid], relation_of.get(cid, "associated"), pub.year if pub else None))
    return items


def _evidence_text(pool: list[EvidenceItem]) -> str:
    return "\n".join(
        f"[{i.claim.id}] ({i.year or 'n.d.'}, {i.claim.design.value}, {i.relation}, {i.claim.direction.value}) "
        f"{i.claim.claim}" for i in pool)


# ── opposing evidence and uncertainty (computed, never model-written) ───────

def opposing_claims(support_ids: list[str], pool: list[EvidenceItem]) -> list[str]:
    """Pool claims that disagree with the supporting ones: opposite relation, or a contradicting finding."""
    support = [i for i in pool if i.claim.id in set(support_ids)]
    support_relations = {i.relation for i in support}
    out = []
    for item in pool:
        if item.claim.id in set(support_ids):
            continue
        conflicts = item.claim.direction.value == "contradicts" or any(
            frozenset({item.relation, r}) in OPPOSING for r in support_relations)
        if conflicts:
            out.append(item.claim.id)
    return out


def describe_uncertainty(
    support: list[EvidenceClaim], opposing: list[EvidenceClaim], pubs: dict[str, Publication],
) -> list[str]:
    notes: list[str] = []
    papers = {c.publication_id for c in support}
    notes.append(f"Supported by {len(papers)} paper(s) in this corpus" + (" (limited)." if len(papers) < 3 else "."))
    designs = {c.design for c in support} - {StudyDesign.UNKNOWN}
    if not designs & HUMAN:
        notes.append("No human (observational or randomized) evidence behind this hypothesis.")
    if all(c.locator == Locator.TEXT_ONLY for c in support):
        notes.append("All supporting claims come from abstracts, not full text.")
    years = sorted(y for c in support if (y := getattr(pubs.get(c.publication_id), "year", None)))
    if years:
        notes.append(f"Evidence spans {years[0]}–{years[-1]}.")
    if opposing:
        notes.append(f"{len(opposing)} claim(s) in the pool conflict with this hypothesis.")
    retracted = sum(1 for c in support if pubs.get(c.publication_id)
                    and pubs[c.publication_id].retraction_status == RetractionStatus.RETRACTED)
    if retracted:
        notes.append(f"{retracted} supporting claim(s) come from retracted papers.")
    return notes


# ── proposer ─────────────────────────────────────────────────────────────────

PROPOSER_SYSTEM = (
    "You propose ONE falsifiable scientific hypothesis that addresses a gap in the literature. Reply with ONLY "
    "a JSON object: {\"statement\": str, \"mechanism\": str, \"predictions\": [str], \"falsifiers\": [str], "
    "\"alternative_mechanisms\": [str], \"supporting_claim_ids\": [str]}. RULES: use ONLY the evidence listed; "
    "'supporting_claim_ids' must be ids copied from the list. Each prediction must be a measurable outcome. "
    "Each falsifier must be a DIFFERENT observation that would show the hypothesis is wrong. "
    "Do not state anything as established that the evidence does not show. Do not state effects in patients or "
    "humans as fact unless the evidence is from human studies; put such effects in 'predictions' as outcomes to test. "
    "Do NOT restate a finding already in the evidence: propose an untested extension of it. Every prediction must "
    "agree with the statement (if the statement says X reduces Y, a prediction must not say X increases Y)."
)


def json_object(raw: str) -> dict | None:
    start, end = raw.find("{"), raw.rfind("}")
    if start == -1 or end <= start:
        return None
    try:
        data = json.loads(raw[start:end + 1])
    except json.JSONDecodeError:
        return None
    return data if isinstance(data, dict) else None


def _strings(value) -> list[str]:
    return [normalize(x) for x in value if isinstance(x, str) and normalize(x)] if isinstance(value, list) else []


def propose(
    llm: LLM, gap: Gap, pool: list[EvidenceItem], nodes: dict[str, GraphNode], pubs: dict[str, Publication],
    *, critique: list[str] | None = None, previous: Hypothesis | None = None,
) -> tuple[Hypothesis | None, list[Rejection]]:
    prompt = f"GAP ({gap.kind.value}): {gap.description}\n\nEVIDENCE:\n{_evidence_text(pool)}\n"
    if previous and critique:
        prompt += (f"\nYOUR PREVIOUS HYPOTHESIS: {previous.statement}\nCRITIC OBJECTIONS:\n- "
                   + "\n- ".join(critique) + "\nRevise the hypothesis to address these objections.\n")
    rejections: list[Rejection] = []
    data = json_object(llm.generate(PROPOSER_SYSTEM, prompt))
    if data is None:
        return None, [Rejection("unparseable_model_output", "")]

    statement = normalize(str(data.get("statement") or ""))
    predictions, falsifiers = _strings(data.get("predictions")), _strings(data.get("falsifiers"))
    pool_ids = {i.claim.id for i in pool}
    cited = [c for c in _strings(data.get("supporting_claim_ids")) if c in pool_ids]
    dropped = [c for c in _strings(data.get("supporting_claim_ids")) if c not in pool_ids]
    if dropped:
        rejections.append(Rejection("unknown_claim_id_dropped", ", ".join(dropped)))

    names = [nodes[n].canonical_name for n in gap.node_ids if n in nodes]
    if not statement or len(statement) > 500:
        return None, rejections + [Rejection("bad_statement", statement[:80])]
    if names and not any(contains_verbatim(statement, n) for n in names):
        return None, rejections + [Rejection("off_topic_statement", statement[:80])]
    if not predictions or not falsifiers:
        return None, rejections + [Rejection("missing_prediction_or_falsifier", statement[:80])]
    if {f.casefold() for f in falsifiers} & {p.casefold() for p in predictions} or statement.casefold() in {f.casefold() for f in falsifiers}:
        return None, rejections + [Rejection("falsifier_restates_prediction", statement[:80])]
    if not cited:
        return None, rejections + [Rejection("no_valid_supporting_claims", statement[:80])]

    claim_by_id = {i.claim.id: i.claim for i in pool}
    opposing = opposing_claims(cited, pool)
    hyp_kwargs = dict(
        statement=statement, mechanism=normalize(str(data.get("mechanism") or "")),
        predictions=predictions, falsifiers=falsifiers,
        alternative_mechanisms=_strings(data.get("alternative_mechanisms")),
        supporting_claim_ids=cited, contradicting_claim_ids=opposing, gap_id=gap.id,
        uncertainty=describe_uncertainty([claim_by_id[c] for c in cited], [claim_by_id[c] for c in opposing], pubs),
        review_status=HypothesisStatus.PROPOSED,
        provenance=Provenance(source="agent:hypothesis_proposer", detail=llm.name, tool_version=AGENT_VERSION),
    )
    provenance = hyp_kwargs.pop("provenance")
    if previous:
        return previous.revise(**hyp_kwargs, provenance=provenance), rejections
    return Hypothesis(**hyp_kwargs, provenance=provenance), rejections


# ── critic ───────────────────────────────────────────────────────────────────

CRITIC_SYSTEM = (
    "You are a skeptical scientific reviewer. Reply with ONLY a JSON object: {\"verdict\": \"accept\"|\"revise\"|\"reject\", "
    "\"reasons\": [str], \"missing_controls\": [str], \"confounders\": [str]}. Look for: claims not supported by the "
    "evidence shown, alternative explanations, missing controls, confounders, and predictions that cannot be measured. "
    "Be specific. Predictions are untested BY DESIGN: do not ask for revision merely because the evidence does not "
    "already show a predicted outcome. Revise when the statement or mechanism is not grounded in the cited evidence, "
    "when it overstates what that evidence shows, or when controls or confounders are missing. "
    "Reject only if the hypothesis is not supported by, or is contradicted by, the evidence. "
    "Also check that the predictions and falsifiers are consistent with the statement: a prediction that "
    "contradicts the statement is a reason to revise."
)


HUMAN_CLAIM = re.compile(r"\b(patients?|humans?|clinical|clinically|people|participants?)\b", re.I)
RESTATES_AT = 0.8                     # share of the statement's words already present in a supporting claim


def _words(text: str) -> set[str]:
    return {w for w in re.findall(r"[a-z0-9][a-z0-9\-]*", text.lower()) if len(w) > 2}


def _contains_words(claim_text: str, statement: str) -> float:
    """Heuristic: how much of the statement is already said by the claim (0..1)."""
    mine = _words(statement)
    return len(mine & _words(claim_text)) / len(mine) if mine else 0.0


def rule_findings(
    hyp: Hypothesis, claims: dict[str, EvidenceClaim], pubs: dict[str, Publication],
    *, available_papers: int | None = None,
) -> list[tuple[Verdict, str]]:
    """Deterministic checks. Each finding carries the verdict it forces.

    `available_papers` is how many distinct papers the proposer could have cited. A finding
    the proposer cannot fix (only one paper exists) is recorded but does not force a revision.
    """
    found: list[tuple[Verdict, str]] = []
    support = [claims[c] for c in hyp.supporting_claim_ids if c in claims]
    opposing = [claims[c] for c in hyp.contradicting_claim_ids if c in claims]
    support_papers = {c.publication_id for c in support}
    oppose_papers = {c.publication_id for c in opposing}

    if not support:
        found.append((Verdict.REJECT, "No supporting claim could be found for this hypothesis."))
    if support and all(pubs.get(c.publication_id) and pubs[c.publication_id].retraction_status == RetractionStatus.RETRACTED
                       for c in support):
        found.append((Verdict.REJECT, "All supporting evidence comes from retracted papers."))
    if len(oppose_papers) > len(support_papers):
        found.append((Verdict.REJECT, f"Contradicted: {len(oppose_papers)} paper(s) conflict versus "
                                      f"{len(support_papers)} supporting paper(s)."))
    elif opposing and not hyp.alternative_mechanisms:
        found.append((Verdict.REVISE, "Conflicting evidence exists but no alternative explanation is offered."))
    if len(support_papers) == 1:
        fixable = available_papers is None or available_papers > 1
        found.append((Verdict.REVISE if fixable else Verdict.ACCEPT,
                      "Supported by a single paper; one source cannot establish the link."
                      + ("" if fixable else " No other paper in this corpus covers it, so this is a limit, not a drafting error.")))
    restated = next((c for c in support if _contains_words(c.claim, hyp.statement) >= RESTATES_AT), None)
    if restated:
        found.append((Verdict.REVISE, "The statement restates a reported finding rather than proposing something new; "
                                      "propose an untested extension (new setting, population, intervention or readout)."))
    if HUMAN_CLAIM.search(hyp.statement) and not {c.design for c in support} & HUMAN:
        found.append((Verdict.REVISE, "The statement asserts human or clinical effects, but no human evidence supports it; "
                                      "state it as a prediction to test, not as fact."))
    unmeasurable = [p for p in hyp.predictions if not MEASURABLE.search(p)]
    if unmeasurable:
        found.append((Verdict.REVISE, f"Prediction not clearly measurable: {unmeasurable[0][:80]}"))
    return found


def review(
    llm: LLM, hyp: Hypothesis, claims: dict[str, EvidenceClaim], pubs: dict[str, Publication],
    *, available_papers: int | None = None,
) -> Review:
    findings = rule_findings(hyp, claims, pubs, available_papers=available_papers)
    verdict = max((v for v, _ in findings), key=ORDER.get, default=Verdict.ACCEPT)

    evidence = "\n".join(f"[{cid}] {claims[cid].claim}" for cid in
                         (hyp.supporting_claim_ids + hyp.contradicting_claim_ids) if cid in claims)
    prompt = (f"HYPOTHESIS: {hyp.statement}\nMECHANISM: {hyp.mechanism}\nPREDICTIONS: {'; '.join(hyp.predictions)}\n"
              f"FALSIFIERS: {'; '.join(hyp.falsifiers)}\n\nEVIDENCE (supporting then conflicting):\n{evidence}\n")
    notes: list[str] = []
    controls: list[str] = []
    confounders: list[str] = []
    # One retry: small local models sometimes return malformed JSON on the first try.
    data = json_object(llm.generate(CRITIC_SYSTEM, prompt))
    if data is None:
        data = json_object(llm.generate(CRITIC_SYSTEM, prompt + "\nYour last reply was not valid JSON. Reply with ONLY the JSON object."))
    if data is None:
        # Never accept on rules alone: the rules cannot see an internally inconsistent hypothesis.
        notes.append("Model critique unusable after a retry, so this hypothesis has had no independent check.")
        if ORDER[Verdict.REVISE] > ORDER[verdict]:
            verdict = Verdict.REVISE
    else:
        notes = _strings(data.get("reasons"))
        controls, confounders = _strings(data.get("missing_controls")), _strings(data.get("confounders"))
        try:
            model_verdict = Verdict(data.get("verdict"))
        except ValueError:
            model_verdict = Verdict.REVISE
            notes.append("Model gave no valid verdict; treated as 'revise'.")
        if ORDER[model_verdict] > ORDER[verdict]:        # the model may only be stricter
            verdict = model_verdict
    return Review(
        hypothesis_id=hyp.id, hypothesis_version=hyp.version, verdict=verdict,
        rule_findings=[t for _, t in findings], critic_notes=notes, missing_controls=controls, confounders=confounders,
        provenance=Provenance(source="agent:skeptical_critic", detail=llm.name, tool_version=AGENT_VERSION))
