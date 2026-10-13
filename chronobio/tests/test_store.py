import sqlite3

import pytest

from chronobio.models import Hypothesis, Provenance, Publication
from chronobio.store import Store

PROV = Provenance(source="test")


@pytest.fixture
def store(tmp_path):
    return Store(tmp_path / "cb.sqlite3")


def test_roundtrip_and_type_restored(store):
    pub = Publication(title="KRAS review", year=2019, doi="10.1/x", provenance=PROV)
    store.save(pub)
    loaded = store.get(pub.id)
    assert isinstance(loaded, Publication) and loaded == pub


def test_versions_are_kept_not_overwritten(store):
    h1 = Hypothesis(statement="A", predictions=["p"], falsifiers=["f"], provenance=PROV)
    h2 = h1.revise(statement="A, refined")
    store.save(h1)
    store.save(h2)
    assert store.get(h1.id).statement == "A, refined"
    assert store.get(h1.id, version=1).statement == "A"
    assert [h.version for h in store.history(h1.id)] == [1, 2]
    assert [h.statement for h in store.list(Hypothesis)] == ["A, refined"]


def test_same_version_cannot_be_written_twice(store):
    pub = Publication(title="T", provenance=PROV)
    store.save(pub)
    with pytest.raises(sqlite3.IntegrityError):
        store.save(pub)


def test_checkpoint_resume(store):
    assert store.resume("job1") is None
    store.checkpoint("job1", "claims", {"done": 3})
    store.checkpoint("job1", "graph", {"done": 5})
    assert store.resume("job1") == ("graph", {"done": 5})
