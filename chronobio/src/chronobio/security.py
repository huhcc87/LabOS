"""Security and privacy checks that can be run on demand (`python -m chronobio audit`).

* License audit: every installed dependency of ChronoBio, flagging copyleft licenses
  (AGPL/GPL are blocking for a hosted service; LGPL is flagged for review).
* Secret scan: key-like strings in source, tests and docs.
* Egress guard: a context manager that makes any network connection raise, used to
  prove that the offline workflow (everything except explicitly enabled literature
  search and a model server on localhost) never reaches out.
"""

from __future__ import annotations

import re
import socket
from contextlib import contextmanager
from dataclasses import dataclass
from importlib import metadata
from pathlib import Path

COPYLEFT = re.compile(r"\b(AGPL|Affero|GPL|General Public License)\b", re.I)
WEAK_COPYLEFT = re.compile(r"\b(LGPL|Lesser General Public)\b", re.I)

SECRET_PATTERNS = {
    "api key (sk-)": re.compile(r"\bsk-[A-Za-z0-9_-]{20,}"),
    "AWS access key": re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
    "GitHub token": re.compile(r"\bgh[pousr]_[A-Za-z0-9]{30,}\b"),
    "Slack token": re.compile(r"\bxox[baprs]-[A-Za-z0-9-]{10,}"),
    "private key": re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
    "hard-coded credential": re.compile(r"(?i)\b(api[_-]?key|secret|token|password)\b\s*[:=]\s*['\"][A-Za-z0-9/+_=-]{16,}['\"]"),
}
SCAN_SUFFIXES = {".py", ".md", ".toml", ".json", ".txt", ".html", ".yml", ".yaml", ".cfg", ".env"}
SKIP_DIRS = {".venv", "data", "__pycache__", ".pytest_cache", ".git", "node_modules"}


@dataclass(frozen=True)
class LicenseFinding:
    name: str
    version: str
    license: str
    level: str                 # ok | review | blocking


@dataclass(frozen=True)
class SecretFinding:
    path: str
    line: int
    kind: str


class EgressBlocked(RuntimeError):
    """A network connection was attempted while the egress guard was active."""


def _license_of(dist: metadata.Distribution) -> str:
    md = dist.metadata
    text = md.get("License-Expression") or md.get("License") or ""
    classifiers = [c.split("::")[-1].strip() for c in md.get_all("Classifier") or [] if c.startswith("License ::")]
    # Some packages put a whole license text in the License field; keep only a short first line.
    first = text.strip().splitlines()[0][:80] if text.strip() else ""
    return "; ".join(x for x in [first, *classifiers] if x) or "unknown"


def _dependency_names(root: str = "chronobio") -> set[str]:
    seen: set[str] = set()
    todo = [root]
    while todo:
        name = todo.pop()
        try:
            dist = metadata.distribution(name)
        except metadata.PackageNotFoundError:
            continue
        for req in dist.requires or []:
            if "extra ==" in req:                       # optional extras are not installed by default
                continue
            dep = re.split(r"[ ;<>=!~\[(]", req, maxsplit=1)[0]
            if dep and dep.lower() not in seen:
                seen.add(dep.lower())
                todo.append(dep)
    return seen


def license_audit(names: set[str] | None = None) -> list[LicenseFinding]:
    out = []
    for name in sorted(names if names is not None else _dependency_names()):
        try:
            dist = metadata.distribution(name)
        except metadata.PackageNotFoundError:
            continue
        lic = _license_of(dist)
        level = "blocking" if COPYLEFT.search(lic) and not WEAK_COPYLEFT.search(lic) else "review" if WEAK_COPYLEFT.search(lic) or lic == "unknown" else "ok"
        out.append(LicenseFinding(name, dist.version, lic, level))
    return out


def scan_secrets(root: Path) -> list[SecretFinding]:
    findings = []
    for path in sorted(root.rglob("*")):
        if not path.is_file() or path.suffix not in SCAN_SUFFIXES or SKIP_DIRS & set(path.parts):
            continue
        try:
            lines = path.read_text(errors="ignore").splitlines()
        except OSError:
            continue
        for i, line in enumerate(lines, start=1):
            for kind, pattern in SECRET_PATTERNS.items():
                if pattern.search(line):
                    findings.append(SecretFinding(str(path.relative_to(root)), i, kind))
    return findings


@contextmanager
def egress_guard():
    """Any attempt to open a network connection raises EgressBlocked while this is active."""
    def blocked(*args, **kwargs):
        raise EgressBlocked("network access attempted while the egress guard was active")

    originals = (socket.socket.connect, socket.create_connection, socket.getaddrinfo)
    socket.socket.connect, socket.create_connection, socket.getaddrinfo = blocked, blocked, blocked
    try:
        yield
    finally:
        socket.socket.connect, socket.create_connection, socket.getaddrinfo = originals


def audit(root: Path) -> dict:
    licenses = license_audit()
    secrets = scan_secrets(root)
    gitignore = (root / ".gitignore").read_text() if (root / ".gitignore").exists() else ""
    return {
        "licenses": licenses, "secrets": secrets,
        "data_dir_ignored": "data/" in gitignore,
        "blocking": [f for f in licenses if f.level == "blocking"], "review": [f for f in licenses if f.level == "review"],
    }
