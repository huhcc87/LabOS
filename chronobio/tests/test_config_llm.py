import httpx
import pytest

from chronobio.config import Settings, load_settings
from chronobio.llm import LLMDisabled, OllamaLLM, ScriptedLLM


def test_defaults_are_off_and_local(monkeypatch):
    for key in ("CHRONOBIO_ENABLED", "CHRONOBIO_DRY_RUN", "CHRONOBIO_OLLAMA_URL"):
        monkeypatch.delenv(key, raising=False)
    s = load_settings()
    assert (s.enabled, s.dry_run, s.allow_cloud_llm, s.allow_network_literature) == (False, True, False, False)


def test_remote_llm_rejected_without_opt_in(monkeypatch):
    monkeypatch.setenv("CHRONOBIO_OLLAMA_URL", "https://llm.example.com")
    with pytest.raises(ValueError, match="not local"):
        load_settings()
    monkeypatch.setenv("CHRONOBIO_ALLOW_CLOUD_LLM", "1")
    assert load_settings().allow_cloud_llm


def _mock_client(captured: list):
    def handler(request: httpx.Request) -> httpx.Response:
        captured.append(request)
        return httpx.Response(200, json={"response": "ok"})
    return httpx.Client(transport=httpx.MockTransport(handler))


@pytest.mark.parametrize("enabled,dry_run", [(False, False), (True, True)])
def test_disabled_or_dry_run_never_calls_model(enabled, dry_run):
    captured: list = []
    llm = OllamaLLM(Settings(enabled=enabled, dry_run=dry_run), client=_mock_client(captured))
    with pytest.raises(LLMDisabled):
        llm.generate("sys", "prompt")
    assert captured == []


def test_prompt_is_truncated_to_context_budget():
    captured: list = []
    llm = OllamaLLM(Settings(enabled=True, dry_run=False, max_context_chars=10),
                    client=_mock_client(captured))
    assert llm.generate("sys", "x" * 100) == "ok"
    body = captured[0].read().decode()
    assert '"prompt":"xxxxxxxxxx"' in body.replace(" ", "")


def test_scripted_llm_is_deterministic():
    llm = ScriptedLLM(["a", "b"])
    assert [llm.generate("s", "p1"), llm.generate("s", "p2")] == ["a", "b"]
    with pytest.raises(AssertionError):
        llm.generate("s", "p3")


def test_json_mode_is_requested_only_when_asked_and_reaches_ollama():
    captured: list = []

    def handler(request: httpx.Request) -> httpx.Response:
        captured.append(request.read().decode())
        return httpx.Response(200, json={"response": "{}"})

    llm = OllamaLLM(Settings(enabled=True, dry_run=False), client=httpx.Client(transport=httpx.MockTransport(handler)))
    llm.generate("s", "p")
    llm.generate("s", "p", json_format=True)
    assert '"format"' not in captured[0] and '"format":"json"' in captured[1].replace(" ", "")


def test_structured_agent_calls_ask_for_json_and_extraction_does_not(tmp_path):
    import json
    from swarm_world import A, B
    from test_swarm import critic, judge, literature, proposal, three_animal_corpus
    from chronobio.swarm import run_swarm
    corpus = three_animal_corpus(tmp_path)
    llm = ScriptedLLM([proposal(corpus.claim_ids), critic("accept"), judge("no", "")])
    run_swarm(llm, corpus.store, corpus.settings, literature([]), max_gaps=1)
    assert llm.json_flags == [True, True, True]                      # proposer, critic and novelty judge
