"""Optional dataset ingestion (generic tables as CSV).

A dataset is accepted only with a data dictionary that describes every column,
unique sample ids, a group column and at least two groups. The file stays where
it is; ChronoBio keeps a path and a SHA-256, and refuses to analyse a file that
changed after ingestion (reproducibility). Nothing here ever invents missing data.
Rows are never sent to any language model: validation is plain local code.
"""

from __future__ import annotations

import csv
import hashlib
from collections import Counter
from pathlib import Path

from .models import AccessStatus, Dataset, Provenance
from .store import Store

DATASET_VERSION = "datasets-v1"
MISSING = {"", "na", "n/a", "nan", "null", "none"}
MISSING_FLAG_AT = 0.20


class DatasetError(ValueError):
    """The dataset cannot be accepted (or analysed); the message says why."""


def sha256_of(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read_table(path: Path) -> tuple[list[str], list[dict[str, str]]]:
    with path.open(newline="", encoding="utf-8-sig") as fh:
        reader = csv.DictReader(fh)
        columns = list(reader.fieldnames or [])
        rows = [{k: (v or "").strip() for k, v in row.items()} for row in reader]
    return columns, rows


def is_missing(value: str) -> bool:
    return value.strip().lower() in MISSING


def numeric(rows: list[dict[str, str]], column: str) -> list[float | None]:
    """Column as floats; missing cells are None. Text that is not a number is an error, never coerced."""
    out: list[float | None] = []
    for i, row in enumerate(rows, start=2):                     # line 1 is the header
        cell = row[column]
        if is_missing(cell):
            out.append(None)
            continue
        try:
            out.append(float(cell))
        except ValueError:
            raise DatasetError(f"column '{column}' is not numeric (line {i}: {cell!r})") from None
    return out


def _is_numeric_column(rows: list[dict[str, str]], column: str) -> bool:
    values = [r[column] for r in rows if not is_missing(r[column])]
    if not values:
        return False
    try:
        [float(v) for v in values]
    except ValueError:
        return False
    return True


def ingest_csv(
    store: Store, path: Path, *, name: str, data_dictionary: dict[str, str],
    sample_id_column: str, group_column: str, batch_column: str | None = None,
    units: dict[str, str] | None = None, access: AccessStatus = AccessStatus.PRIVATE,
    covariates: list[str] | None = None, provenance_note: str = "",
) -> Dataset:
    path = Path(path)
    if not path.is_file():
        raise DatasetError(f"file not found: {path}")
    columns, rows = read_table(path)
    if not rows:
        raise DatasetError("the table has no rows")
    if len(set(columns)) != len(columns):
        raise DatasetError("column names must be unique")
    undocumented = [c for c in columns if not data_dictionary.get(c, "").strip()]
    if undocumented:
        raise DatasetError(f"data dictionary is missing a description for: {', '.join(undocumented)}")
    for role, col in (("sample id", sample_id_column), ("group", group_column), ("batch", batch_column)):
        if col is not None and col not in columns:
            raise DatasetError(f"{role} column '{col}' is not in the table")

    ids = [r[sample_id_column] for r in rows]
    if any(is_missing(i) for i in ids):
        raise DatasetError("every sample needs an id")
    duplicated = [i for i, n in Counter(ids).items() if n > 1]
    if duplicated:
        raise DatasetError(f"sample ids must be unique; repeated: {', '.join(duplicated[:5])}")
    group_counts = Counter(r[group_column] for r in rows if not is_missing(r[group_column]))
    if len(group_counts) < 2:
        raise DatasetError("the group column needs at least two groups")

    units = dict(units or {})
    flags: list[str] = []
    for col in columns:
        missing = sum(is_missing(r[col]) for r in rows) / len(rows)
        if missing > MISSING_FLAG_AT:
            flags.append(f"{col}: {missing:.0%} of values are missing")
        if col not in (sample_id_column, group_column, batch_column) and _is_numeric_column(rows, col) and col not in units:
            flags.append(f"{col}: numeric but no unit declared")
    flags += [f"group '{g}' has only {n} sample(s)" for g, n in group_counts.items() if n < 5]
    if batch_column:
        batches: dict[str, set[str]] = {}
        for r in rows:
            batches.setdefault(r[batch_column], set()).add(r[group_column])
        single = sorted(b for b, gs in batches.items() if len(gs) == 1)
        if single:
            flags.append(f"batch confounding: batch(es) {', '.join(single[:5])} contain a single group")
    if access == AccessStatus.PATIENT_LEVEL:
        flags.append("patient-level data: stays on this computer and must never be sent to a cloud model")

    ds = Dataset(
        name=name, schema_description="; ".join(f"{c}: {data_dictionary[c]}" for c in columns), access=access,
        groups=sorted(group_counts), covariates=list(covariates or []), units=units, sample_count=len(rows),
        quality_flags=flags, path=str(path.resolve()), sha256=sha256_of(path), sample_id_column=sample_id_column,
        group_column=group_column, batch_column=batch_column, data_dictionary=dict(data_dictionary),
        provenance=Provenance(source="user_dataset", detail=provenance_note or path.name, tool_version=DATASET_VERSION))
    store.save(ds)
    return ds


def load_table(ds: Dataset) -> tuple[list[str], list[dict[str, str]]]:
    """Re-read the file, refusing if it changed since ingestion."""
    if not ds.path or not Path(ds.path).is_file():
        raise DatasetError(f"dataset file is missing: {ds.path}")
    if sha256_of(Path(ds.path)) != ds.sha256:
        raise DatasetError("the dataset file changed after it was ingested; re-ingest it so results stay reproducible")
    return read_table(Path(ds.path))
