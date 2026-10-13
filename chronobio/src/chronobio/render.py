"""PNG and PDF output through a locally installed Chrome (headless), when there is one.

Chrome is optional. If it is missing or a render fails, these functions return
False and the caller says so in its output; nothing is silently skipped.
Each render uses a throw-away browser profile so it never touches your own
Chrome sessions or data, and loads only local files.
"""

from __future__ import annotations

import shutil
import subprocess
import tempfile
from pathlib import Path

CANDIDATES = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser",
]
TIMEOUT_S = 90


def find_chrome() -> Path | None:
    for candidate in CANDIDATES:
        if Path(candidate).exists():
            return Path(candidate)
    found = shutil.which("google-chrome") or shutil.which("chromium")
    return Path(found) if found else None


def _run(args: list[str], out: Path, chrome: Path | None) -> bool:
    chrome = chrome or find_chrome()
    if chrome is None:
        return False
    with tempfile.TemporaryDirectory(prefix="chronobio-chrome-") as profile:
        cmd = [str(chrome), "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
               "--disable-extensions", f"--user-data-dir={profile}", "--hide-scrollbars", *args]
        try:
            subprocess.run(cmd, capture_output=True, timeout=TIMEOUT_S, check=False)
        except (subprocess.TimeoutExpired, OSError):
            return False
    return out.exists() and out.stat().st_size > 0


def svg_to_png(svg: str, out: Path, width: int, height: int, *, scale: int = 2, chrome: Path | None = None) -> bool:
    """Rasterize SVG text to a PNG (`scale`x resolution, white background)."""
    out.parent.mkdir(parents=True, exist_ok=True)
    out.unlink(missing_ok=True)
    with tempfile.TemporaryDirectory(prefix="chronobio-svg-") as tmp:
        page = Path(tmp) / "figure.html"
        page.write_text(f'<!doctype html><meta charset="utf-8"><style>html,body{{margin:0;background:#fff}}</style>{svg}')
        return _run([f"--window-size={width},{height}", f"--force-device-scale-factor={scale}",
                     "--default-background-color=FFFFFFFF", f"--screenshot={out}", page.as_uri()], out, chrome)


def html_to_pdf(html_path: Path, out: Path, *, chrome: Path | None = None) -> bool:
    """Print a local HTML file to PDF (no page header or footer)."""
    out.parent.mkdir(parents=True, exist_ok=True)
    out.unlink(missing_ok=True)
    return _run(["--no-pdf-header-footer", f"--print-to-pdf={out}", html_path.resolve().as_uri()], out, chrome)
