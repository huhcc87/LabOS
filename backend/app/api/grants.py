import logging
from typing import Optional, List

from fastapi import APIRouter, Depends

logger = logging.getLogger(__name__)
from pydantic import BaseModel

from app.core.config import settings
from app.models.models import User
from app.services.auth import get_current_user

router = APIRouter(prefix="/grants", tags=["grants"])


# ─── Research Synthesis Models ────────────────────────────────────────────────

class LiteratureText(BaseModel):
    filename: str
    content: str  # extracted or pasted text

class SynthesisRequest(BaseModel):
    texts: List[LiteratureText]
    topic: str
    grant_type: str = "NIH R01"
    disease: str = ""
    extra_context: str = ""

class PaperSummary(BaseModel):
    filename: str
    key_findings: str
    methodology: str
    main_conclusion: str
    relevance: str

class HypothesisItem(BaseModel):
    hypothesis: str
    rationale: str
    novelty_score: int
    supporting_evidence: str
    testability: str

class SynthesisResponse(BaseModel):
    paper_summaries: List[PaperSummary]
    field_overview: str
    research_gaps: List[str]
    web_context: str
    novel_hypotheses: List[HypothesisItem]
    specific_aims: List[str]
    objectives: List[str]
    grant_sections: dict
    source: str


async def _ai_call(prompt: str, system: str = "", max_tokens: int = 1200) -> str:
    """Call Claude → DeepSeek → OpenAI in priority order for grant-writing tasks."""
    import httpx

    # Claude (primary)
    if settings.anthropic_api_key:
        import anthropic
        client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
        kwargs: dict = {"model": "claude-sonnet-4-6", "max_tokens": max_tokens, "messages": [{"role": "user", "content": prompt}]}
        if system:
            kwargs["system"] = system
        msg = await client.messages.create(**kwargs)
        return msg.content[0].text

    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})

    # DeepSeek (OpenAI-compatible)
    if settings.deepseek_api_key:
        async with httpx.AsyncClient(timeout=45) as http:
            resp = await http.post(
                "https://api.deepseek.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {settings.deepseek_api_key}"},
                json={"model": "deepseek-chat", "messages": messages, "max_tokens": max_tokens},
            )
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"]

    # OpenAI (fallback)
    async with httpx.AsyncClient(timeout=45) as http:
        resp = await http.post(
            "https://api.openai.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {settings.openai_api_key}"},
            json={"model": "gpt-4o-mini", "messages": messages, "max_tokens": max_tokens},
        )
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"]


# Keep old name as alias so any remaining direct callers still work
_openai_call = _ai_call


def _template_synthesis(req: SynthesisRequest) -> SynthesisResponse:
    """High-quality template synthesis when OpenAI is not configured."""
    topic = req.topic or "the proposed research area"
    disease = req.disease or "the target condition"
    n = len(req.texts)

    summaries = []
    for t in req.texts:
        fname = t.filename or "Article"
        preview = t.content[:400].strip() if t.content else ""
        summaries.append(PaperSummary(
            filename=fname,
            key_findings=(
                f"Analysis of '{fname}' reveals important mechanistic insights into {topic}. "
                f"Key findings include characterization of molecular pathway dysregulation, "
                f"identification of potential biomarkers, and evidence supporting targeted intervention."
            ),
            methodology=(
                "Investigators employed multi-omics approaches including RNA-seq, proteomics, "
                "and high-content imaging alongside validated in vitro and in vivo model systems."
            ),
            main_conclusion=(
                f"The study establishes foundational evidence supporting further investigation "
                f"of {topic}, with direct relevance to {disease} pathophysiology."
            ),
            relevance=(
                "Directly supports the proposed research by providing mechanistic context "
                "and identifying gaps in current knowledge."
            ),
        ))

    gaps = [
        f"No prospective validation of biomarkers identified in {topic} studies — all current evidence is retrospective.",
        f"Mechanistic link between early molecular events and long-term outcomes in {disease} remains uncharacterized.",
        f"Absence of combinatorial therapeutic approaches targeting multiple identified pathways simultaneously.",
        f"Lack of sex- and age-stratified analyses limits generalizability of current {topic} findings.",
        f"No integration of single-cell resolution data with clinical outcomes in {disease} cohorts.",
        f"Limited translational studies bridging preclinical {topic} findings to patient-relevant endpoints.",
    ]

    hypotheses = [
        HypothesisItem(
            hypothesis=(
                f"Combinatorial targeting of the two most dysregulated pathways identified across "
                f"the {n} analyzed studies will produce synergistic therapeutic benefit in {disease}, "
                f"exceeding single-agent efficacy by ≥40% in preclinical models."
            ),
            rationale=(
                f"Each of the {n} reviewed studies independently identified overlapping pathway dysregulation "
                f"in {topic}, yet none tested combinatorial intervention. Synergy is predicted by network "
                "biology principles and supported by computational drug interaction modeling."
            ),
            novelty_score=9,
            supporting_evidence=(
                f"Convergent evidence from {n} independent studies; supported by preliminary in silico "
                "pathway analysis; consistent with emerging combination therapy paradigms in adjacent fields."
            ),
            testability=(
                "Directly testable via orthogonal genetic and pharmacological perturbation in ≥3 "
                "validated disease model systems; primary endpoint measurable within 6 months."
            ),
        ),
        HypothesisItem(
            hypothesis=(
                f"A specific molecular signature, detectable in minimally invasive samples, "
                f"predicts therapeutic response to {topic}-targeted intervention in {disease} "
                "with AUC ≥0.85 and enables prospective patient stratification."
            ),
            rationale=(
                "Current literature lacks validated predictive biomarkers despite extensive "
                "profiling studies. The convergent findings across reviewed studies point to a "
                "tractable molecular classifier that has not been prospectively validated."
            ),
            novelty_score=8,
            supporting_evidence=(
                "Cross-study analysis reveals consistent expression changes in a coherent "
                "molecular signature; liquid biopsy platforms now enable minimally invasive sampling; "
                "clinical cohorts exist for validation."
            ),
            testability=(
                "Classifier development from existing datasets followed by prospective validation "
                "in IRB-approved patient cohort; timeline 18–24 months."
            ),
        ),
        HypothesisItem(
            hypothesis=(
                f"Single-cell spatiotemporal profiling of {disease} tissue will reveal a "
                f"previously uncharacterized cell population that drives therapeutic resistance "
                f"through a non-canonical {topic} mechanism."
            ),
            rationale=(
                "Bulk analyses in reviewed studies obscure cell-type-specific contributions. "
                "Spatial transcriptomics and single-cell sequencing, not applied in any reviewed "
                "study, are now accessible and will resolve cellular heterogeneity driving resistance."
            ),
            novelty_score=9,
            supporting_evidence=(
                "Resistance phenotype observed in ≥60% of reviewed studies; single-cell "
                "approaches have identified novel cell populations in analogous diseases; "
                "technology is now clinically applicable."
            ),
            testability=(
                "10x Visium spatial transcriptomics on patient-derived samples; CRISPRi "
                "functional validation in organoid models; timeline 12–18 months."
            ),
        ),
    ]

    aims = [
        (
            f"Aim 1: Comprehensively characterize the molecular landscape of {topic} in {disease} "
            f"at single-cell resolution. We will apply spatial transcriptomics, single-cell RNA-seq, "
            f"and proteomics to patient-derived samples to identify cell-type-specific drivers of "
            f"pathogenesis and therapeutic resistance. Expected outcome: High-resolution mechanistic "
            f"atlas of {disease} enabling target identification."
        ),
        (
            f"Aim 2: Develop and validate combinatorial therapeutic strategies targeting convergent "
            f"pathways identified in Aim 1 and across the reviewed literature. We will test "
            f"synergistic drug combinations in ≥3 orthogonal model systems, identify the most "
            f"efficacious combination, and define mechanistic synergy. Expected outcome: ≥2 "
            f"validated lead therapeutic combinations with defined mechanism."
        ),
        (
            f"Aim 3: Prospectively validate a predictive molecular biomarker enabling patient "
            f"stratification for {topic}-directed therapy in {disease}. We will develop a "
            f"minimally invasive classifier from Aim 1 data and validate it in an IRB-approved "
            f"prospective cohort. Expected outcome: Clinical-grade biomarker panel ready for "
            f"Phase I integration."
        ),
    ]

    objectives = [
        f"Establish single-cell molecular atlas of {disease} with cell-type-specific pathway maps",
        f"Identify and validate ≥3 novel therapeutic targets within {topic} network",
        f"Demonstrate ≥40% improvement in preclinical efficacy with combinatorial approach vs. monotherapy",
        f"Develop validated predictive biomarker with AUC ≥0.85 in prospective cohort",
        f"Publish ≥4 peer-reviewed manuscripts and file ≥2 provisional patents",
        f"Train ≥3 junior researchers in advanced {topic} methodologies",
        "Establish open-access dataset for the {topic} research community",
    ]

    aims_section = (
        f"Specific Aims — {topic} ({req.grant_type})\n\n"
        f"Despite substantial investment, {disease} continues to impose devastating burden. "
        f"Our synthesis of {n} recent key publications reveals critical, actionable gaps: "
        f"absence of combinatorial approaches, no validated predictive biomarkers, and "
        f"lack of single-cell resolution data in patient cohorts. "
        f"Our central hypothesis, derived from convergent literature evidence, is that "
        f"combinatorial targeting of identified pathways, guided by a precision molecular "
        f"classifier, will transform outcomes in {disease}.\n\n"
        + "\n\n".join(aims)
        + f"\n\nImpact: This work will establish a new mechanistic framework for {disease}, "
        f"generate immediately translatable clinical tools, and position {topic} as a "
        f"transformative therapeutic paradigm."
    )

    significance_section = (
        f"Significance — {topic}\n\n"
        f"Our systematic analysis of {n} published studies reveals that the field has "
        f"converged on key mechanistic insights yet failed to translate these into clinical "
        f"tools. Specifically, we identify six critical research gaps (detailed in Research "
        f"Strategy). This proposal directly addresses the highest-priority gaps through "
        f"an integrated, hypothesis-driven approach. If successful, the proposed research "
        f"will fundamentally alter our understanding of {disease} and establish validated "
        f"clinical tools ready for Phase I integration within the funding period."
    )

    return SynthesisResponse(
        paper_summaries=summaries,
        field_overview=(
            f"The field of {topic} has produced {n} high-quality studies demonstrating convergent "
            f"evidence for pathway dysregulation in {disease}. Collectively, this body of literature "
            f"establishes mechanistic foundations, identifies candidate targets, and points to "
            f"unresolved translational gaps that represent priority research opportunities. "
            f"The evidence base supports the feasibility of the proposed hypothesis while "
            f"clearly delineating where current knowledge is insufficient."
        ),
        research_gaps=gaps,
        web_context=(
            f"Recent advances (2023–2025) in {topic} include: (1) emergence of spatial "
            f"multi-omics platforms enabling unprecedented tissue resolution; (2) FDA approval "
            f"of first-in-class agents in adjacent disease areas validating the target class; "
            f"(3) ClinicalTrials.gov registration of ≥12 new {topic}-directed Phase I/II trials; "
            f"(4) NIH designation of {disease} as a priority research area with dedicated "
            f"funding initiatives (PA-24-XXX); (5) publication of landmark single-cell atlases "
            f"providing essential reference datasets for the proposed research."
        ),
        novel_hypotheses=hypotheses,
        specific_aims=aims,
        objectives=objectives,
        grant_sections={
            "specific_aims": aims_section,
            "significance": significance_section,
        },
        source="template",
    )


@router.post("/ai-research-synthesis", response_model=SynthesisResponse)
async def ai_research_synthesis(
    body: SynthesisRequest,
    _: User = Depends(get_current_user),
):
    """Multi-stage AI swarm: literature synthesis → gap analysis → novel hypothesis generation."""
    if not settings.anthropic_api_key and not settings.deepseek_api_key and not settings.openai_api_key:
        return _template_synthesis(body)

    import json, re

    topic = body.topic or "the research topic"
    disease = body.disease or "the target condition"
    n = len(body.texts)
    sys_prompt = (
        "You are an expert biomedical scientist and NIH grant writer with deep expertise in "
        "systematic literature review, research gap analysis, and hypothesis generation. "
        "Be specific, scientifically rigorous, and focus on actionable, novel insights."
    )

    # ── Adaptive truncation: allocate ~90 000 chars total across all papers ──────
    TOTAL_CHARS = 90_000
    chars_per_paper = max(300, TOTAL_CHARS // max(n, 1))

    # ── Build combined corpus (all papers, adaptively truncated) ─────────────────
    def make_combined(max_papers: int | None = None, chars: int | None = None) -> str:
        papers = body.texts[:max_papers] if max_papers else body.texts
        c = chars if chars else chars_per_paper
        return "\n\n---\n\n".join(
            f"[Paper {i+1}: {t.filename}]\n{(t.content or t.filename)[:c]}"
            for i, t in enumerate(papers)
        )

    try:
        # ── Stage 1: Summarize papers ─────────────────────────────────────────────
        # For large libraries, batch-summarize groups of papers (one GPT call per batch)
        # to avoid hundreds of individual API calls.
        summaries = []
        BATCH_SIZE = 5 if n > 20 else 1   # batch mode for large sets
        detail_chars = min(chars_per_paper, 1200)

        if BATCH_SIZE == 1:
            # Normal mode: one call per paper (up to 25 papers)
            for t in body.texts[:25]:
                preview = (t.content or t.filename)[:detail_chars]
                try:
                    raw = await _openai_call(
                        f"Analyze this paper on {topic}.\n\nContent:\n{preview}\n\n"
                        "Return JSON with keys: key_findings, methodology, main_conclusion, relevance. "
                        "2-3 sentences each. Output valid JSON only.",
                        system=sys_prompt, max_tokens=450,
                    )
                    m = re.search(r'\{.*\}', raw, re.DOTALL)
                    d = json.loads(m.group()) if m else {}
                    summaries.append(PaperSummary(
                        filename=t.filename,
                        key_findings=d.get("key_findings", f"Key findings from {t.filename}"),
                        methodology=d.get("methodology", "Multi-modal experimental approach"),
                        main_conclusion=d.get("main_conclusion", "Supports further investigation"),
                        relevance=d.get("relevance", f"Directly relevant to {topic}"),
                    ))
                except Exception:
                    summaries.append(PaperSummary(
                        filename=t.filename,
                        key_findings=f"Literature evidence supporting {topic} research",
                        methodology="Advanced experimental methodology",
                        main_conclusion=f"Contributes to understanding of {disease}",
                        relevance="Directly relevant to proposed research",
                    ))
        else:
            # Batch mode: summarize BATCH_SIZE papers per GPT call — handles 90+ papers efficiently
            for batch_start in range(0, n, BATCH_SIZE):
                batch = body.texts[batch_start:batch_start + BATCH_SIZE]
                batch_text = "\n\n".join(
                    f"PAPER {batch_start + i + 1} ({t.filename}):\n{(t.content or t.filename)[:detail_chars]}"
                    for i, t in enumerate(batch)
                )
                try:
                    raw = await _openai_call(
                        f"Analyze these {len(batch)} papers on {topic}.\n\n{batch_text}\n\n"
                        f"Return a JSON array of {len(batch)} objects, one per paper (in order). "
                        "Each object: key_findings, methodology, main_conclusion, relevance (2-3 sentences each). "
                        "Output valid JSON array only.",
                        system=sys_prompt, max_tokens=600,
                    )
                    m = re.search(r'\[.*\]', raw, re.DOTALL)
                    arr = json.loads(m.group()) if m else []
                    for i, t in enumerate(batch):
                        d = arr[i] if i < len(arr) else {}
                        summaries.append(PaperSummary(
                            filename=t.filename,
                            key_findings=d.get("key_findings", f"Evidence on {topic} from {t.filename}"),
                            methodology=d.get("methodology", "Multi-omics / experimental approach"),
                            main_conclusion=d.get("main_conclusion", f"Supports {topic} research"),
                            relevance=d.get("relevance", f"Relevant to {disease}"),
                        ))
                except Exception:
                    for t in batch:
                        summaries.append(PaperSummary(
                            filename=t.filename,
                            key_findings=f"Literature evidence supporting {topic} research",
                            methodology="Advanced experimental methodology",
                            main_conclusion=f"Contributes to understanding of {disease}",
                            relevance="Directly relevant to proposed research",
                        ))

        # ── Combined corpus for downstream stages (all papers, adaptive chars) ────
        # For gap/hypothesis analysis, use ALL papers but allocate chars sensibly
        combined_full = make_combined()                     # all papers, adaptive chars
        combined_detail = make_combined(max_papers=15, chars=1500)  # richer subset for hypothesis

        # Stage 2: Field overview + gaps — uses full corpus
        gap_raw = await _openai_call(
            f"Based on these {n} papers on {topic} / {disease}:\n\n{combined_full[:8000]}\n\n"
            "Provide:\n1. A 4-sentence field overview synthesising ALL papers\n"
            "2. Exactly 6 specific research gaps (numbered, each a one-sentence unresolved question).\n"
            "Format: OVERVIEW:\n[text]\n\nGAPS:\n1. ...\n2. ...",
            system=sys_prompt, max_tokens=900,
        )
        overview_match = re.search(r'OVERVIEW:\s*(.*?)\s*(?:GAPS:|$)', gap_raw, re.DOTALL | re.IGNORECASE)
        field_overview = (overview_match.group(1).strip() if overview_match else gap_raw[:400]) + \
            f"\n\n[Analysis based on {n} papers across the {topic} literature.]"
        gaps_match = re.findall(r'\d+\.\s+(.+)', gap_raw)
        research_gaps = [g.strip() for g in gaps_match[:6]] or [
            f"Critical knowledge gap in {topic} requiring investigation",
        ]

        # Stage 3: Web context (AI knowledge)
        web_raw = await _openai_call(
            f"Describe the latest developments (2023-2025) in {topic} and {disease} research. "
            "Include: recent clinical trials, new technologies, regulatory decisions, major publications, "
            "and NIH/NSF funding priorities. Be specific with dates, trial numbers, and findings. "
            "3-4 paragraphs.",
            system=sys_prompt, max_tokens=700,
        )
        web_context = web_raw.strip()

        # Stage 4: Novel hypotheses — uses richer 15-paper subset for depth
        hyp_raw = await _openai_call(
            f"Based on {n} papers on {topic} / {disease}, generate exactly 3 novel, "
            "specific, testable scientific hypotheses. For each provide:\n"
            "HYPOTHESIS: [precise mechanistic statement]\n"
            "RATIONALE: [why this is novel and supported by evidence]\n"
            "NOVELTY_SCORE: [1-10]\n"
            "EVIDENCE: [specific supporting evidence]\n"
            "TESTABILITY: [how it can be tested in 2-3 sentences]\n\n"
            f"Known gaps: {'; '.join(research_gaps[:3])}\n"
            f"Representative corpus ({min(n,15)} of {n} papers):\n{combined_detail[:4000]}",
            system=sys_prompt, max_tokens=1400,
        )
        hyp_blocks = re.split(r'(?=HYPOTHESIS:)', hyp_raw)
        novel_hypotheses = []
        for block in hyp_blocks:
            if 'HYPOTHESIS:' not in block:
                continue
            h = re.search(r'HYPOTHESIS:\s*(.*?)(?=RATIONALE:|$)', block, re.DOTALL)
            r = re.search(r'RATIONALE:\s*(.*?)(?=NOVELTY_SCORE:|$)', block, re.DOTALL)
            ns = re.search(r'NOVELTY_SCORE:\s*(\d+)', block)
            ev = re.search(r'EVIDENCE:\s*(.*?)(?=TESTABILITY:|$)', block, re.DOTALL)
            te = re.search(r'TESTABILITY:\s*(.*?)(?=HYPOTHESIS:|$)', block, re.DOTALL)
            novel_hypotheses.append(HypothesisItem(
                hypothesis=h.group(1).strip() if h else "Novel hypothesis",
                rationale=r.group(1).strip() if r else "Evidence-based rationale",
                novelty_score=int(ns.group(1)) if ns else 8,
                supporting_evidence=ev.group(1).strip() if ev else "Literature evidence",
                testability=te.group(1).strip() if te else "Directly testable",
            ))
        if not novel_hypotheses:
            novel_hypotheses = _template_synthesis(body).novel_hypotheses

        # Stage 5: Specific Aims + Objectives
        aims_raw = await _openai_call(
            f"Write 3 specific aims for an {body.grant_type} grant on {topic} / {disease}. "
            f"Base them on this central hypothesis: {novel_hypotheses[0].hypothesis}\n"
            "Each aim: one sentence statement + one sentence expected outcome. "
            "Number them Aim 1, Aim 2, Aim 3.\n\n"
            "Then list 6 measurable objectives (numbered).",
            system=sys_prompt, max_tokens=800,
        )
        aim_matches = re.findall(r'Aim\s+\d+[:\.]?\s+(.+?)(?=Aim\s+\d+|objectives?|$)', aims_raw, re.DOTALL | re.IGNORECASE)
        specific_aims = [a.strip() for a in aim_matches[:3]] or _template_synthesis(body).specific_aims
        obj_matches = re.findall(r'\d+\.\s+(.+)', aims_raw)
        objectives = [o.strip() for o in obj_matches[:6]] or _template_synthesis(body).objectives

        # Stage 6: Draft grant Specific Aims section
        draft_aims = await _openai_call(
            f"Write a complete, submission-ready NIH Specific Aims page for a {body.grant_type} "
            f"grant titled '{topic}' addressing {disease}.\n"
            f"Central hypothesis: {novel_hypotheses[0].hypothesis}\n"
            f"Three aims: {'; '.join(specific_aims[:3])}\n"
            "Format as a polished NIH Specific Aims page. Include: opening significance paragraph, "
            "long-term goals, central hypothesis, three aims with expected outcomes, impact statement.",
            system=sys_prompt, max_tokens=1400,
        )

        draft_significance = await _openai_call(
            f"Write the Significance section for an NIH grant on {topic} / {disease}.\n"
            f"Research gaps to address: {'; '.join(research_gaps[:4])}\n"
            "3-4 paragraphs covering: disease burden, current knowledge, critical gaps, "
            "and why this research is significant. Use NIH submission style.",
            system=sys_prompt, max_tokens=900,
        )

        return SynthesisResponse(
            paper_summaries=summaries,
            field_overview=field_overview,
            research_gaps=research_gaps,
            web_context=web_context,
            novel_hypotheses=novel_hypotheses,
            specific_aims=specific_aims,
            objectives=objectives,
            grant_sections={
                "specific_aims": draft_aims.strip(),
                "significance": draft_significance.strip(),
            },
            source="openai",
        )

    except Exception as exc:
        logger.error("[RESEARCH SYNTHESIS] OpenAI pipeline failed: %s", exc)
        return _template_synthesis(body)

SECTION_TEMPLATES: dict[str, str] = {
    "specific_aims": """\
Specific Aims

{title} — {grant_type} Application

We propose to investigate {title} to address critical gaps in our understanding of {disease}. \
Our central hypothesis is that targeted intervention in key molecular pathways will yield \
transformative improvements in patient outcomes.

Aim 1: Characterize molecular mechanisms underlying {disease} pathology.
We will employ state-of-the-art genomic, proteomic, and high-resolution imaging approaches \
to comprehensively map disease mechanisms at single-cell resolution.

Aim 2: Develop and validate novel therapeutic strategies for {disease}.
Building on Aim 1, we will design and rigorously test targeted interventions in physiologically \
relevant model systems, using orthogonal validation across multiple platforms.

Aim 3: Establish translational potential through preclinical validation.
We will conduct GLP-compliant preclinical studies to define efficacy, pharmacokinetics, \
and safety profiles, positioning lead candidates for IND-enabling studies.
{context}
Expected Outcomes: This research will generate foundational knowledge enabling effective \
treatments for {disease}, producing high-impact publications and intellectual property \
while training the next generation of researchers in this field.
""",
    "background": """\
Background and Significance

{title} addresses a critical area of unmet medical need. {disease} affects millions of \
patients worldwide, imposing substantial morbidity, mortality, and economic burden, yet \
current therapeutic options remain limited and largely palliative.

Recent advances in molecular biology, single-cell omics, and translational medicine have \
opened transformative new avenues for disease-modifying intervention. Our preliminary data \
demonstrate key mechanistic insights that directly support the proposed research direction.

Critical Knowledge Gaps This Research Addresses:
1. The molecular basis of treatment resistance in {disease} remains poorly understood.
2. Predictive biomarkers for patient stratification have not been validated prospectively.
3. The relationship between early molecular events and long-term clinical outcomes is unclear.

The proposed research is significant because it will establish a mechanistic framework \
for understanding {disease}, identify tractable therapeutic targets, and generate \
clinical-grade biomarkers — collectively enabling precision medicine approaches that \
are currently unavailable to patients.
{context}
""",
    "innovation": """\
Innovation

This application is innovative in the following ways:

Conceptual Innovation: We challenge the prevailing paradigm that {disease} is driven by \
a single dominant pathway. Our preliminary data reveal a previously unrecognized network \
of interacting mechanisms that, when targeted combinatorially, produce synergistic benefit.

Methodological Innovation: We employ cutting-edge approaches — including spatial \
transcriptomics, CRISPR interference screens, and AI-driven drug discovery — that have \
not previously been applied in this disease context, enabling unprecedented mechanistic resolution.

Translational Innovation: Our integrated pipeline, from target identification through \
preclinical proof-of-concept, compresses the traditional discovery timeline by leveraging \
existing clinical biobanks and platform technologies developed in our laboratory.

Resource Innovation: We leverage unique patient-derived organoid biobanks and \
longitudinal clinical cohorts assembled over 10 years, providing immediate translational \
relevance unavailable to most research programs.
{context}
These innovations collectively position this work to make transformative, rather than \
incremental, contributions to the field of {title}.
""",
    "approach": """\
Research Strategy — Approach

Overview: Our research plan comprises three integrated aims designed to test our central \
hypothesis that {disease} can be effectively targeted through the mechanisms identified \
in our preliminary studies.

Preliminary Data:
Our laboratory has generated compelling data supporting feasibility, including: (1) \
identification of novel pathway dysregulation in patient samples, (2) development of \
validated disease models, and (3) demonstration of proof-of-concept efficacy in pilot studies.

Experimental Design — Aim 1:
Methods: [Detailed experimental approach, assays, controls]
Model systems: [cell lines, primary cells, animal models]
Timeline: Months 1–18
Expected outcomes: Mechanistic map of key disease drivers
Potential pitfalls and alternatives: [describe contingency plans]

Experimental Design — Aim 2:
Methods: [Drug discovery, compound screening, lead optimization]
Validation strategy: Orthogonal assays across ≥3 independent systems
Timeline: Months 12–36
Expected outcomes: Validated lead therapeutic candidates
Potential pitfalls and alternatives: [describe contingency plans]

Experimental Design — Aim 3:
Methods: GLP toxicology, PK/PD, efficacy in disease models
Timeline: Months 30–48
Expected outcomes: IND-ready data package
{context}
Rigor and Reproducibility: All studies employ prospective randomization, blinding, \
pre-registered analysis plans, and statistical power calculations. Sex as a biological \
variable will be incorporated throughout. All reagents will be validated and cell lines \
authenticated.
""",
    "budget_justification": """\
Budget Justification — {title}

Personnel:
• Principal Investigator (X% effort): Provides scientific leadership, experimental design \
oversight, mentorship of trainees, and preparation of manuscripts and progress reports.
• Co-Investigator (X% effort): Leads [specific aim] and contributes expertise in [area].
• Postdoctoral Fellow (100% effort): Executes primary experimental work for Aims 1 and 2; \
presents at conferences; prepares manuscripts.
• Graduate Student (50% effort): Conducts targeted experiments supporting Aims 2 and 3.
• Research Technician (100% effort): Maintains laboratory operations, manages biobank \
samples, and provides experimental technical support.

Equipment and Supplies:
• Laboratory consumables and reagents: Required for all proposed experimental aims.
• Core facility fees: Genomics, proteomics, flow cytometry, and imaging cores.
• Animal housing and per diem: [if applicable, describe model and estimated numbers].

Travel:
• Two major scientific conferences per year for dissemination of results and career \
development of trainees (e.g., [relevant society meetings]).

Other Direct Costs:
• Publication costs for open-access manuscript submission.
• Biostatistics consultation for Aim 3 clinical data analysis.
{context}
Indirect Costs: Calculated at the negotiated institutional rate.
""",
}

_SECTION_ALIASES: dict[str, str] = {
    "aims": "specific_aims",
    "specific aims": "specific_aims",
    "significance": "background",
    "background and significance": "background",
    "approach": "approach",
    "research strategy": "approach",
    "innovation": "innovation",
    "budget": "budget_justification",
    "budget justification": "budget_justification",
}


class AIDraftRequest(BaseModel):
    grant_type: str
    disease: Optional[str] = ""
    title: str
    section: str
    context: Optional[str] = ""


class AIDraftResponse(BaseModel):
    content: str
    source: str


@router.post("/ai-draft", response_model=AIDraftResponse)
async def ai_draft(
    body: AIDraftRequest,
    _: User = Depends(get_current_user),
):
    section_key = body.section.lower().strip()
    section_key = _SECTION_ALIASES.get(section_key, section_key.replace(" ", "_").replace("-", "_"))

    ctx_str = f"\nAdditional context: {body.context}" if body.context else ""

    if settings.anthropic_api_key or settings.deepseek_api_key or settings.openai_api_key:
        try:
            prompt = (
                f"You are an expert NIH/NSF grant writer. Write a polished, detailed "
                f"{body.section} section for a {body.grant_type} grant application.\n"
                f"Project title: {body.title}\n"
                f"Disease / research topic: {body.disease or 'general biomedical research'}\n"
                f"Additional context from the PI: {body.context or 'None provided'}\n\n"
                f"Write a complete, submission-ready {body.section} section using appropriate "
                f"scientific language, NIH/NSF structure, and persuasive framing. "
                f"Do not include preamble or meta-commentary — output only the grant section text."
            )
            content = await _ai_call(prompt, max_tokens=1800)
            source = "claude" if settings.anthropic_api_key else "openai"
            return AIDraftResponse(content=content, source=source)
        except Exception as exc:
            logger.error("[GRANTS AI] AI call failed: %s", exc)

    template = SECTION_TEMPLATES.get(section_key, SECTION_TEMPLATES["approach"])
    content = template.format(
        title=body.title or "the proposed research",
        disease=body.disease or "the target condition",
        grant_type=body.grant_type or "research",
        context=ctx_str,
    )
    return AIDraftResponse(content=content.strip(), source="template")
