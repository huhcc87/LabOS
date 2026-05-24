"""Tests for /api/grants/* AI endpoints — verifies template fallback path (no API key)."""
import pytest


def test_ai_draft_unauthenticated(client):
    resp = client.post("/api/grants/ai-draft", json={"section": "specific_aims", "title": "Test", "grant_type": "NIH R01"})
    assert resp.status_code == 401


def test_ai_draft_template_fallback(client, staff_headers):
    """When no API key is configured, should return template-based content."""
    resp = client.post(
        "/api/grants/ai-draft",
        json={
            "section": "specific_aims",
            "title": "Novel CRISPR approaches for oncology",
            "grant_type": "NIH R01",
            "disease": "cancer",
            "context": "Focus on solid tumors",
        },
        headers=staff_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "content" in data
    assert "source" in data
    assert len(data["content"]) > 20


def test_ai_draft_approach_section(client, staff_headers):
    resp = client.post(
        "/api/grants/ai-draft",
        json={"section": "approach", "title": "Stem cell study", "grant_type": "NSF"},
        headers=staff_headers,
    )
    assert resp.status_code == 200
    assert len(resp.json()["content"]) > 10


def test_ai_draft_significance_section(client, staff_headers):
    resp = client.post(
        "/api/grants/ai-draft",
        json={"section": "significance", "title": "Alzheimer biomarkers", "grant_type": "NIH R21"},
        headers=staff_headers,
    )
    assert resp.status_code == 200


def test_ai_draft_innovation_section(client, staff_headers):
    resp = client.post(
        "/api/grants/ai-draft",
        json={"section": "innovation", "title": "mRNA delivery platform", "grant_type": "NIH R01"},
        headers=staff_headers,
    )
    assert resp.status_code == 200


def test_ai_draft_unknown_section_uses_fallback(client, staff_headers):
    """An unrecognized section should still return a non-empty response."""
    resp = client.post(
        "/api/grants/ai-draft",
        json={"section": "budget_justification", "title": "Multi-omics study", "grant_type": "NIH"},
        headers=staff_headers,
    )
    assert resp.status_code == 200
    assert len(resp.json()["content"]) > 5


def test_ai_research_synthesis_template(client, staff_headers):
    """Without an API key the synthesis endpoint returns a template response."""
    resp = client.post(
        "/api/grants/ai-research-synthesis",
        json={
            "texts": [
                {"filename": "paper1.txt", "content": "CRISPR-Cas9 enables precise genome editing in human cells."},
                {"filename": "paper2.txt", "content": "Off-target effects remain a key challenge for clinical translation."},
            ],
            "topic": "CRISPR genome editing",
            "grant_type": "NIH R01",
            "disease": "genetic disorders",
        },
        headers=staff_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "paper_summaries" in data
    assert "novel_hypotheses" in data
    assert "specific_aims" in data
    assert "source" in data
    assert len(data["paper_summaries"]) == 2


def test_ai_research_synthesis_unauthenticated(client):
    resp = client.post(
        "/api/grants/ai-research-synthesis",
        json={"texts": [], "topic": "test", "grant_type": "NIH"},
    )
    assert resp.status_code == 401
