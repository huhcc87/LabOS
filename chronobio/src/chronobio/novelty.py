"""Novelty review against external literature.

Every search is logged. The status is decided by explicit rules:

  verified direct prior test found      -> known
  entities co-studied, no direct test   -> partially_tested
  each entity studied, never together   -> possible_novel_combination
  too little coverage to say            -> unknown     (never "novel")

"No hits" is never reported as novelty. A prior test only counts when the model
quotes a sentence from the abstract and that sentence is found verbatim in it.
Papers already in the user's own corpus are excluded from prior work.
"""

from __future__ import annotations

from dataclasses import dataclass

from .agents import json_object
from .literature import LiteratureClient, NetworkDisabled, dedupe_key
from .llm import LLM
from .models import (
    Gap, GraphNode, Hypothesis, NoveltyAssessment, NoveltyStatus, Provenance, Publication, SearchLog,
)
from .pdf_ingest import find_ignoring_case

NOVELTY_VERSION = "novelty-v1"
JUDGE_LIMIT = 4                       # abstracts sent to the model per hypothesis
ALWAYS = ["Absence of search hits is not evidence of novelty.",
          "Searched Europe PMC titles and abstracts only; full texts and patents were not searched.",
          "Only the first page of results (up to 25) was examined per query."]

JUDGE_SYSTEM = (
    "You judge whether a paper abstract already tests a hypothesis. Reply with ONLY a JSON object: "
    "{\"tests_hypothesis\": \"yes\"|\"related\"|\"no\", \"sentence\": str}. 'yes' = the abstract reports a result "
    "directly about the hypothesised relationship. 'related' = it studies the same entities but not this relationship. "
    "'sentence' MUST be copied exactly from the abstract and show why; use \"\" for 'no'."
)


@dataclass(frozen=True)
class NoveltyResult:
    assessment: NoveltyAssessment
    logs: list[SearchLog]


def _mentions(pub: Publication, name: str) -> bool:
    return find_ignoring_case(f"{pub.title} {pub.abstract}", name) is not None


def assess_novelty(
    llm: LLM, lit: LiteratureClient, hyp: Hypothesis, gap: Gap, nodes: dict[str, GraphNode],
    corpus: list[Publication],
) -> NoveltyResult:
    a, b = nodes[gap.node_ids[0]].canonical_name, nodes[gap.node_ids[-1]].canonical_name
    prov = Provenance(source="agent:novelty_reviewer", detail=llm.name, tool_version=NOVELTY_VERSION)

    def result(status, logs, quotes=(), titles=(), extra=()):
        return NoveltyResult(NoveltyAssessment(
            hypothesis_id=hyp.id, status=status, search_log_ids=[g.id for g in logs],
            verified_quotes=list(quotes), prior_titles=list(titles), limitations=[*extra, *ALWAYS], provenance=prov), logs)

    own = {dedupe_key(p) for p in corpus}
    logs: list[SearchLog] = []
    try:
        both, log = lit.search_europepmc(f'"{a}" AND "{b}"')
        logs.append(log)
        only_a, log_a = lit.search_europepmc(f'"{a}"')
        only_b, log_b = lit.search_europepmc(f'"{b}"')
        logs += [log_a, log_b]
    except NetworkDisabled:
        return result(NoveltyStatus.NOT_SEARCHED, logs, extra=["Literature access is off; no search was run."])

    # Search engines match loosely, so keep only hits that really mention both entities.
    co_studied = [p for p in both if dedupe_key(p) not in own and _mentions(p, a) and _mentions(p, b)]
    titles = [p.title for p in co_studied]

    quotes: list[str] = []
    direct = related = 0
    extra: list[str] = []
    for paper in [p for p in co_studied if p.abstract][:JUDGE_LIMIT]:
        data = json_object(llm.generate(
            JUDGE_SYSTEM, f"HYPOTHESIS: {hyp.statement}\n\nABSTRACT:\n{paper.abstract}"))
        if data is None:
            extra.append(f"Model judgement unusable for one abstract ({paper.title[:50]}).")
            continue
        verdict, sentence = data.get("tests_hypothesis"), str(data.get("sentence") or "")
        if verdict in ("yes", "related") and find_ignoring_case(paper.abstract, sentence):
            quotes.append(f"{paper.title} ({paper.year or 'n.d.'}): “{sentence.strip()}”")
            direct += verdict == "yes"
            related += verdict == "related"
        elif verdict in ("yes", "related"):
            extra.append(f"Rejected an unverifiable quote for: {paper.title[:50]}")

    if direct:
        status = NoveltyStatus.KNOWN
    elif co_studied:
        status = NoveltyStatus.PARTIALLY_TESTED
        if not related:
            extra.append("Entities are co-mentioned in prior work, but no verified test of this relationship was found.")
    elif only_a and only_b:
        status = NoveltyStatus.POSSIBLE_NOVEL_COMBINATION
    else:
        status = NoveltyStatus.UNKNOWN
        extra.append("Too few results for at least one entity to judge novelty.")
    return result(status, logs, quotes, titles[:8], extra)
