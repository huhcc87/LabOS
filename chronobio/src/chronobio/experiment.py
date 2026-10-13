"""Experiment designer: a plan skeleton built only from stored facts.

Nothing is invented. Aims, endpoints, expected and alternative outcomes come from
the hypothesis; models and assays are quoted from the studies the hypothesis
cites; the sample-size line uses the standard two-group formula with an effect
size that must be either measured (an executed validation run) or supplied by
the user and labelled an assumption. Controls are the generic ones every such
study needs, marked for expert review, and ethics/cost flags are rule-based.
"""

from __future__ import annotations

import math
from statistics import NormalDist

from .models import (
    EvidenceClaim, ExperimentPlan, Hypothesis, Provenance, Publication, RunStatus, StudyDesign, ValidationRun,
)
from .pdf_ingest import normalize

EXPERIMENT_VERSION = "experiment-v1"
GENERIC_CONTROLS = [
    "Negative control: vehicle or untreated samples run in the same batch.",
    "Positive control: a condition with a known, previously reported effect on the readout.",
    "Technical replicates of each measurement and independent biological replicates of each group.",
    "Randomise sample order and process groups in the same batches; blind readout where possible.",
]


def sample_size_per_group(effect_size: float, *, alpha: float = 0.05, power: float = 0.8) -> int:
    """Two-sided, two-group comparison of means (normal approximation): n = 2 * ((z_a + z_b) / d)^2."""
    if effect_size <= 0:
        raise ValueError("effect size must be positive")
    z = NormalDist().inv_cdf
    return math.ceil(2 * ((z(1 - alpha / 2) + z(power)) / effect_size) ** 2)


def design_experiment(
    hyp: Hypothesis, claims: dict[str, EvidenceClaim], pubs: dict[str, Publication],
    runs: list[ValidationRun] | None = None, *, assumed_effect_size: float | None = None,
    alpha: float = 0.05, power: float = 0.8,
) -> ExperimentPlan:
    support = [claims[c] for c in hyp.supporting_claim_ids if c in claims]
    assumptions: list[str] = []
    flags: list[str] = []

    # Effect size: measured beats assumed; with neither there is no power calculation, and the plan says so.
    measured = [abs(r.metrics["hedges_g_heldout"]) for r in (runs or [])
                if r.status == RunStatus.EXECUTED and "hedges_g_heldout" in r.metrics]
    candidates = [x for x in (measured[0] if measured else None, assumed_effect_size) if x]
    effect = min(candidates) if candidates else None          # conservative: never size a study on the larger estimate
    if measured:
        assumptions.append(f"Measured effect size {measured[0]:.2f} (Hedges g, held-out part of an executed run). Effects found in "
                           f"one dataset are usually overestimated, so it is treated as optimistic.")
    if assumed_effect_size:
        assumptions.append(f"Effect size {assumed_effect_size:.2f} is an assumption supplied by the user, not an estimate from data.")
    if len(candidates) == 2:
        assumptions.append(f"Both were available; the smaller ({effect:.2f}) was used to size the study.")
    if effect:
        n = sample_size_per_group(effect, alpha=alpha, power=power)
        power_plan = (f"About {n} independent samples per group (two-sided alpha {alpha}, power {power:.0%}, "
                      f"effect size {effect:.2f}); add 10-20% for attrition or failed samples.")
    else:
        power_plan = ("No sample-size calculation: there is neither a measured nor a user-supplied effect size. "
                      "Supply one (for example from a pilot) to size the study.")

    methods = []
    for c in support:
        desc = " · ".join(x for x in (c.method, c.population) if x)      # a design label alone is not an assay
        pub = pubs.get(c.publication_id)
        if desc:
            methods.append(f"{normalize(desc)} (used in: {pub.title if pub else c.publication_id}, {pub.year if pub and pub.year else 'n.d.'})")
    designs = {c.design for c in support}
    if StudyDesign.ANIMAL in designs or any("mouse" in (c.population + c.method).lower() for c in support):
        flags.append("Animal work: needs institutional animal-care approval and a justification of group sizes.")
    if StudyDesign.OBSERVATIONAL in designs or StudyDesign.RANDOMIZED in designs or any(
            w in hyp.statement.lower() + " ".join(hyp.predictions).lower() for w in ("patient", "human", "clinical")):
        flags.append("Human samples or participants: needs ethics review, consent and privacy handling before any data are collected.")
    if not methods:
        flags.append("The cited studies give no usable method detail; choose models and assays with a domain expert.")
    flags.append("Cost and timeline have not been estimated.")

    aims = [f"Aim 1: Test whether {p[0].lower() + p[1:] if p else p}" for p in hyp.predictions[:2]]
    if hyp.alternative_mechanisms:
        aims.append(f"Aim {len(aims) + 1}: Distinguish the proposed mechanism from the alternative: {hyp.alternative_mechanisms[0]}")
    aims = aims[:3]

    go_no_go = [
        f"Go: the primary endpoint shows the predicted direction with a pre-registered threshold (alpha {alpha}) in the held-out replicates.",
        "No-go: any listed falsifier is observed, or the effect is absent in both discovery and replicate batches.",
    ]
    return ExperimentPlan(
        hypothesis_id=hyp.id, aims=aims, controls=GENERIC_CONTROLS + [f"Check against falsifier: {f}" for f in hyp.falsifiers],
        endpoints=list(hyp.predictions), replication="At least three independent biological replicates per group, repeated in a second batch.",
        power_plan=power_plan, alternative_outcomes=[*hyp.falsifiers, *hyp.alternative_mechanisms],
        models_and_assays=methods, expected_outcomes=list(hyp.predictions), go_no_go=go_no_go, assumptions=assumptions, flags=flags,
        provenance=Provenance(source="rule:experiment_designer", detail="from stored hypothesis and cited studies",
                              tool_version=EXPERIMENT_VERSION))
