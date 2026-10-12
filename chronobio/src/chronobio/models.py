"""Data contracts (spec: "Data contracts").

Every record carries an id, creation timestamp, version and provenance so any
statement in a report can be traced back to its source passage.
Records are immutable: use `revise()` to get a new version instead of mutating.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from enum import StrEnum
from typing import Annotated, ClassVar, Self

from pydantic import BaseModel, ConfigDict, Field, model_validator

NonEmpty = Annotated[str, Field(min_length=1)]


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Provenance(BaseModel):
    model_config = ConfigDict(frozen=True)

    source: NonEmpty                     # e.g. "user_upload", "pubmed", "agent:critic"
    detail: str = ""                     # query string, filename, agent run id …
    tool_version: str = ""               # extractor / model version that produced it


class Record(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")
    prefix: ClassVar[str] = "rec"

    id: str = ""
    created_at: datetime = Field(default_factory=_now)
    version: int = Field(default=1, ge=1)
    provenance: Provenance

    @model_validator(mode="after")
    def _assign_id(self) -> Self:
        if not self.id:
            object.__setattr__(self, "id", f"{self.prefix}_{uuid.uuid4().hex[:12]}")
        return self

    def revise(self, **changes) -> Self:
        """New version of this record with the same id."""
        data = self.model_dump() | changes | {"version": self.version + 1, "created_at": _now()}
        return type(self).model_validate(data)


# ── Literature ───────────────────────────────────────────────────────────────

class RetractionStatus(StrEnum):
    NOT_CHECKED = "not_checked"
    NONE_FOUND = "none_found"
    RETRACTED = "retracted"
    CORRECTED = "corrected"
    CONCERN = "expression_of_concern"


class Publication(Record):
    prefix: ClassVar[str] = "pub"

    title: NonEmpty
    authors: list[str] = []
    year: int | None = Field(default=None, ge=1600, le=2100)
    journal: str = ""
    doi: str | None = None
    pmid: str | None = None
    license: str = "unknown"
    retraction_status: RetractionStatus = RetractionStatus.NOT_CHECKED
    fulltext_location: str | None = None    # local path or URL; never copied into LabOS


class Direction(StrEnum):
    SUPPORTS = "supports"
    CONTRADICTS = "contradicts"
    INCONCLUSIVE = "inconclusive"


class ClaimOrigin(StrEnum):
    REPORTED = "reported"        # stated by the paper
    INFERRED = "inferred"        # derived by the system
    HYPOTHESIS = "hypothesis"


class StudyDesign(StrEnum):
    RANDOMIZED = "randomized"
    OBSERVATIONAL = "observational"
    MECHANISTIC = "mechanistic"
    IN_VITRO = "in_vitro"
    ANIMAL = "animal"
    COMPUTATIONAL = "computational"
    REVIEW = "review"
    OTHER = "other"
    UNKNOWN = "unknown"


class EvidenceClaim(Record):
    prefix: ClassVar[str] = "clm"

    publication_id: NonEmpty
    claim: NonEmpty
    passage: NonEmpty                      # short verbatim snippet from the source
    page: int | None = Field(default=None, ge=1)
    char_start: int | None = Field(default=None, ge=0)
    char_end: int | None = Field(default=None, ge=0)
    direction: Direction = Direction.INCONCLUSIVE
    origin: ClaimOrigin = ClaimOrigin.REPORTED
    design: StudyDesign = StudyDesign.UNKNOWN
    population: str = ""
    n: int | None = Field(default=None, ge=0)
    method: str = ""
    effect: str = ""                       # effect estimate with CI / p as reported
    limitations: list[str] = []
    extraction_version: NonEmpty

    @model_validator(mode="after")
    def _offsets_ordered(self) -> Self:
        if self.char_start is not None and self.char_end is not None and self.char_end < self.char_start:
            raise ValueError("char_end must be >= char_start")
        return self


# ── Temporal graph ───────────────────────────────────────────────────────────

class NodeType(StrEnum):
    CONCEPT = "concept"
    GENE = "gene"
    PATHWAY = "pathway"
    DISEASE = "disease"
    INTERVENTION = "intervention"
    MEASUREMENT = "measurement"
    STUDY = "study"


class GraphNode(Record):
    prefix: ClassVar[str] = "nod"

    type: NodeType
    canonical_name: NonEmpty
    synonyms: list[str] = []
    ontology_ids: list[str] = []


class Relation(StrEnum):
    SUPPORTS = "supports"
    CONTRADICTS = "contradicts"
    ASSOCIATED = "associated"
    ACTIVATES = "activates"
    INHIBITS = "inhibits"
    NO_EFFECT = "no_effect"


class GraphEdge(Record):
    prefix: ClassVar[str] = "edg"

    source: NonEmpty
    target: NonEmpty
    relation: Relation
    sign: int = Field(default=0, ge=-1, le=1)
    evidence_claim_ids: list[str] = []
    publication_date: datetime | None = None
    inferred: bool = False                 # True = hypothesized, drawn dashed

    @model_validator(mode="after")
    def _evidence_or_inferred(self) -> Self:
        # An edge presented as established must point at evidence.
        if not self.inferred and not self.evidence_claim_ids:
            raise ValueError("non-inferred edges need at least one evidence_claim_id")
        return self


# ── Hypotheses, data, validation, plans, figures ─────────────────────────────

class HypothesisStatus(StrEnum):
    NOT_ASSESSED = "not_assessed"
    PROPOSED = "proposed"
    EVIDENCE_SUPPORTED = "evidence_supported"
    CONTRADICTED = "contradicted"
    COMPUTATIONALLY_TESTED = "computationally_tested"
    INDEPENDENTLY_REPLICATED = "independently_replicated"
    EXPERIMENTALLY_VALIDATED = "experimentally_validated"


class NoveltyStatus(StrEnum):
    NOT_SEARCHED = "not_searched"
    KNOWN = "known"
    PARTIALLY_TESTED = "partially_tested"
    POSSIBLE_NOVEL_COMBINATION = "possible_novel_combination"
    UNKNOWN = "unknown"                    # absence of hits is NOT novelty


class Hypothesis(Record):
    prefix: ClassVar[str] = "hyp"

    statement: NonEmpty
    mechanism: str = ""
    predictions: list[NonEmpty] = Field(min_length=1)
    falsifiers: list[NonEmpty] = Field(min_length=1)
    supporting_claim_ids: list[str] = []
    contradicting_claim_ids: list[str] = []
    novelty_status: NoveltyStatus = NoveltyStatus.NOT_SEARCHED
    review_status: HypothesisStatus = HypothesisStatus.PROPOSED


class AccessStatus(StrEnum):
    OPEN = "open"
    CONTROLLED = "controlled"
    PRIVATE = "private"
    PATIENT_LEVEL = "patient_level"        # never leaves this machine


class Dataset(Record):
    prefix: ClassVar[str] = "dat"

    name: NonEmpty
    schema_description: NonEmpty
    access: AccessStatus
    groups: list[str] = []
    covariates: list[str] = []
    units: dict[str, str] = {}
    sample_count: int = Field(ge=0)
    quality_flags: list[str] = []


class RunStatus(StrEnum):
    PLANNED = "planned"
    EXECUTED = "executed"
    FAILED = "failed"


class ValidationRun(Record):
    prefix: ClassVar[str] = "val"

    hypothesis_id: NonEmpty
    dataset_id: NonEmpty
    method: NonEmpty
    code_version: NonEmpty
    seed: int | None = None
    metrics: dict[str, float] = {}
    confidence_intervals: dict[str, tuple[float, float]] = {}
    caveats: list[str] = []
    status: RunStatus = RunStatus.PLANNED

    @model_validator(mode="after")
    def _no_metrics_unless_executed(self) -> Self:
        # Planned analyses must never carry numbers (no invented metrics).
        if self.status != RunStatus.EXECUTED and (self.metrics or self.confidence_intervals):
            raise ValueError("metrics are only allowed on executed runs")
        return self


class ExperimentPlan(Record):
    prefix: ClassVar[str] = "exp"

    hypothesis_id: NonEmpty
    aims: list[NonEmpty] = Field(min_length=1, max_length=3)
    controls: list[NonEmpty] = Field(min_length=1)
    endpoints: list[NonEmpty] = Field(min_length=1)
    replication: str = ""
    power_plan: str = ""
    alternative_outcomes: list[str] = []


class FigureType(StrEnum):
    TIMELINE = "timeline"
    KNOWLEDGE_GRAPH = "knowledge_graph"
    MECHANISM = "mechanism"
    EVIDENCE_MATRIX = "evidence_matrix"
    WORKFLOW = "workflow"
    DATA_PLOT = "data_plot"


class Figure(Record):
    prefix: ClassVar[str] = "fig"

    type: FigureType
    claim_ids: list[str] = []
    caption: NonEmpty
    legend: NonEmpty
    export_paths: list[str] = []


RECORD_TYPES: dict[str, type[Record]] = {
    cls.__name__: cls
    for cls in (Publication, EvidenceClaim, GraphNode, GraphEdge, Hypothesis,
                Dataset, ValidationRun, ExperimentPlan, Figure)
}
