import pytest
from pydantic import ValidationError

from chronobio.models import (
    EvidenceClaim, GraphEdge, Hypothesis, Provenance, Publication, Relation,
    RunStatus, ValidationRun,
)

PROV = Provenance(source="test")


def test_ids_are_prefixed_and_unique():
    a = Publication(title="A", provenance=PROV)
    b = Publication(title="B", provenance=PROV)
    assert a.id.startswith("pub_") and a.id != b.id


def test_records_are_immutable_and_revise_bumps_version():
    pub = Publication(title="Old", provenance=PROV)
    with pytest.raises(ValidationError):
        pub.title = "mutated"  # type: ignore[misc]
    new = pub.revise(title="New")
    assert (new.id, new.version, new.title) == (pub.id, 2, "New")
    assert pub.title == "Old"


def test_established_edge_requires_evidence():
    with pytest.raises(ValidationError, match="evidence_claim_id"):
        GraphEdge(source="a", target="b", relation=Relation.ACTIVATES, provenance=PROV)
    # Hypothesized edges may have no evidence yet — they render dashed.
    GraphEdge(source="a", target="b", relation=Relation.ACTIVATES, inferred=True, provenance=PROV)


def test_planned_validation_cannot_carry_metrics():
    with pytest.raises(ValidationError, match="executed"):
        ValidationRun(hypothesis_id="h", dataset_id="d", method="cox", code_version="1",
                      metrics={"auc": 0.91}, provenance=PROV)
    run = ValidationRun(hypothesis_id="h", dataset_id="d", method="cox", code_version="1",
                        status=RunStatus.EXECUTED, metrics={"auc": 0.91}, provenance=PROV)
    assert run.metrics["auc"] == 0.91


def test_hypothesis_must_be_falsifiable():
    with pytest.raises(ValidationError):
        Hypothesis(statement="X causes Y", predictions=["Y rises"], falsifiers=[], provenance=PROV)


def test_claim_offsets_must_be_ordered():
    with pytest.raises(ValidationError):
        EvidenceClaim(publication_id="p", claim="c", passage="p", char_start=10, char_end=5,
                      extraction_version="v1", provenance=PROV)


def test_unknown_fields_rejected():
    with pytest.raises(ValidationError):
        Publication(title="A", provenance=PROV, confidence=0.99)  # type: ignore[call-arg]
