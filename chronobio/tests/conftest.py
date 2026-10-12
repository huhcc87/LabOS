from pathlib import Path

import pytest
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

PAGE_1 = [
    "Metformin and colorectal polyp recurrence: a cohort study",
    "doi: 10.1234/example.2021.001",
    "In a cohort of 1,200 adults, metformin use was associated with fewer recurrent polyps",
    "(hazard ratio 0.62, 95% CI 0.45-0.85). The study was observational.",
]
PAGE_2 = [
    "Limitations: residual confounding could not be excluded and follow-up was short.",
    "Replication in a randomized trial is needed.",
]


def _draw(path: Path, pages: list[list[str]]) -> Path:
    c = canvas.Canvas(str(path), pagesize=letter)
    for lines in pages:
        y = 720
        for line in lines:
            c.drawString(72, y, line)
            y -= 18
        c.showPage()
    c.save()
    return path


@pytest.fixture
def paper_pdf(tmp_path) -> Path:
    return _draw(tmp_path / "metformin_study.pdf", [PAGE_1, PAGE_2])


@pytest.fixture
def scanned_pdf(tmp_path) -> Path:
    """A PDF with no selectable text, standing in for a scanned page."""
    c = canvas.Canvas(str(tmp_path / "scan.pdf"), pagesize=letter)
    c.rect(72, 600, 300, 100, fill=1)
    c.showPage()
    c.save()
    return tmp_path / "scan.pdf"
