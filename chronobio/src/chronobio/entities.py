"""Entity merging and generic-term filtering for the evidence graph.

The model names the same entity differently in different papers ("p38MAPK",
"p38MAPK signaling", "K-ras G12C", "KRAS(G12C)"), so links never accumulate
evidence across papers. Nodes are merged only when their normalised names are
identical after dropping a few words that never change identity (signaling,
pathway ...). There is no fuzzy matching: a merge is always explainable, and
"MEK inhibitor" is never merged with "MEK".

Very generic terms ("inhibition", "cancer", "patients") are not entities worth a
hypothesis; gaps built on them are skipped.
"""

from __future__ import annotations

import re

from .models import GraphNode

FUNCTION_WORDS = {"signaling", "signalling", "pathway", "pathways", "cascade", "axis", "protein", "gene"}
GENERIC = {
    "inhibition", "inhibitor", "inhibitors", "cancer", "cancers", "cell", "cells", "patient", "patients", "tumor", "tumors",
    "tumour", "tumours", "treatment", "treatments", "therapy", "therapies", "combination therapy", "drug", "drugs", "response",
    "disease", "resistance", "mutation", "mutations", "expression", "activity", "survival", "effect", "effects", "outcome",
    "outcomes", "clinical outcomes", "treatment outcomes", "results", "promising results", "cases", "biomarkers", "biomarker",
    "toxicity", "toxicities", "efficacy", "safety", "risk", "mice", "mouse", "humans", "human",
}


def canonical_key(name: str) -> str:
    """Normalised identity of an entity name."""
    text = re.sub(r"\bk[\s-]?ras\b", "kras", name.lower())            # K-ras / K ras / KRAS
    words = re.sub(r"[^a-z0-9]+", " ", text).split()
    kept = [w for w in words if w not in FUNCTION_WORDS]
    return " ".join(kept or words)


def is_generic(name: str) -> bool:
    return canonical_key(name) in GENERIC


def build_aliases(nodes: list[GraphNode]) -> dict[str, str]:
    """node id -> id of the node it is merged into (only for nodes that are merged away)."""
    groups: dict[str, list[GraphNode]] = {}
    for n in nodes:
        groups.setdefault(canonical_key(n.canonical_name), []).append(n)
    aliases: dict[str, str] = {}
    for members in groups.values():
        keeper = min(members, key=lambda n: (len(n.canonical_name), n.canonical_name, n.id))
        aliases.update({n.id: keeper.id for n in members if n.id != keeper.id})
    return aliases
