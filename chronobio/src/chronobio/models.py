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
    abstract: str = ""
    doi: str | None = None
    pmid: str | None = None
    license: str = "unknown"
    retraction_status: RetractionStatus = RetractionStatus.NOT_CHECKED
    fulltext_location: str | None = None    # local path or URL; never copied into LabOS


class SearchLog(Record):
    """One literature search, kept so any novelty/coverage claim is reproducible."""

    prefix: ClassVar[str] = "sch"

    source: NonEmpty                       # pubmed | europepmc | crossref | openalex …
    query: NonEmpty
    run_at: datetime = Field(default_factory=_now)
    date_from: int | None = None           # publication-year filter used
    date_to: int | None = None
    result_count: int = Field(ge=0)
    returned_count: int = Field(ge=0)      # may be < result_count (page limit)
    limitations: list[str] = []            # e.g. "abstracts only", "first page of results"


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


class Locator(StrEnum):
    PDF_EXACT = "pdf_exact"      # passage found verbatim; page, offsets and boxes are real
    TEXT_ONLY = "text_only"      # passage found verbatim in text without page geometry (e.g. abstract)


class EvidenceClaim(Record):
    prefix: ClassVar[str] = "clm"

    publication_id: NonEmpty
    claim: NonEmpty
    passage: NonEmpty                      # short verbatim snippet from the source
    locator: Locator = Locator.TEXT_ONLY
    page: int | None = Field(default=None, ge=1)
    char_start: int | None = Field(default=None, ge=0)   # offsets into that page's text
    char_end: int | None = Field(default=None, ge=0)
    # Highlight rectangles (x0, top, x1, bottom) in PDF points, one per text line.
    highlight_boxes: list[tuple[float, float, float, float]] = []
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

    @model_validator(mode="after")
    def _exact_locator_needs_geometry(self) -> Self:
        # Never claim an exact PDF location without a page and highlight boxes.
        if self.locator == Locator.PDF_EXACT and (self.page is None or not self.highlight_boxes):
            raise ValueError("pdf_exact claims need a page and highlight_boxes")
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


class GapKind(StrEnum):
    CONTRADICTORY = "contradictory"      # conflicting evidence on the same link
    MECHANISTIC = "mechanistic"          # A→B and B→C reported, A→C never examined
    TRANSLATIONAL = "translational"      # evidence only from lab/animal/computational studies
    UNREPLICATED = "unreplicated"        # a link reported by a single paper


class Gap(Record):
    """A place where the literature is thin, conflicting or untested (found by rules, not the model)."""

    prefix: ClassVar[str] = "gap"

    kind: GapKind
    description: NonEmpty
    node_ids: list[str] = Field(min_length=1)
    claim_ids: list[str] = []              # the evidence that defines the gap
    paper_count: int = Field(ge=0)         # how many papers touch it (lower = less covered)
    priority: float = Field(ge=0)


class Hypothesis(Record):
    prefix: ClassVar[str] = "hyp"

    statement: NonEmpty
    mechanism: str = ""
    predictions: list[NonEmpty] = Field(min_length=1)
    falsifiers: list[NonEmpty] = Field(min_length=1)
    alternative_mechanisms: list[str] = []
    supporting_claim_ids: list[str] = []
    contradicting_claim_ids: list[str] = []
    uncertainty: list[str] = []            # stated limits of the evidence, computed from the claims
    gap_id: str | None = None
    novelty_status: NoveltyStatus = NoveltyStatus.NOT_SEARCHED
    review_status: HypothesisStatus = HypothesisStatus.PROPOSED


class Verdict(StrEnum):
    ACCEPT = "accept"
    REVISE = "revise"
    REJECT = "reject"


class Review(Record):
    """One critic pass over one hypothesis version."""

    prefix: ClassVar[str] = "rev"

    hypothesis_id: NonEmpty
    hypothesis_version: int = Field(ge=1)
    verdict: Verdict
    rule_findings: list[str] = []          # deterministic checks that fired
    critic_notes: list[str] = []           # model critique (never lowers a rule finding)
    missing_controls: list[str] = []
    confounders: list[str] = []


class NoveltyAssessment(Record):
    """Result of an external search for prior work on one hypothesis."""

    prefix: ClassVar[str] = "nov"

    hypothesis_id: NonEmpty
    status: NoveltyStatus
    search_log_ids: list[str] = []
    verified_quotes: list[str] = []        # sentences from prior papers, verified verbatim
    prior_titles: list[str] = []
    limitations: list[str] = []            # always includes "absence of hits is not novelty"


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
    path: str | None = None               # the file stays where it is; only a reference and a checksum are stored
    sha256: str = ""
    sample_id_column: str = ""
    group_column: str = ""
    batch_column: str | None = None
    data_dictionary: dict[str, str] = {}


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
    parameters: dict[str, str | float | int] = {}      # the pre-registered analysis settings
    caveats: list[str] = []
    status: RunStatus = RunStatus.PLANNED
    verdict: str = ""                                   # computed from the metrics; empty until executed

    @model_validator(mode="after")
    def _no_metrics_unless_executed(self) -> Self:
        # Planned analyses must never carry numbers (no invented metrics).
        if self.status != RunStatus.EXECUTED and (self.metrics or self.confidence_intervals):
            raise ValueError("metrics are only allowed on executed runs")
        if self.status != RunStatus.EXECUTED and self.verdict:
            raise ValueError("a verdict is only allowed on executed runs")
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
    models_and_assays: list[str] = []      # taken from the cited studies, never invented
    expected_outcomes: list[str] = []
    go_no_go: list[str] = []
    assumptions: list[str] = []
    flags: list[str] = []                  # ethics, cost and feasibility flags


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
    for cls in (Publication, SearchLog, EvidenceClaim, GraphNode, GraphEdge, Gap, Hypothesis, Review,
                NoveltyAssessment, Dataset, ValidationRun, ExperimentPlan, Figure)
}
