/**
 * Local AI through Ollama (free, runs on this Mac; nothing leaves it).
 * Turn it on by naming a model in the database's environment:
 *   npx convex env set OLLAMA_MODEL llama3.1:latest
 * ./run-local.sh does this for you when Ollama is running. OLLAMA_URL defaults to http://127.0.0.1:11434.
 * Only works with a database that can reach your Mac's localhost: the local one, not the cloud one.
 */

export const ollamaConfigured = (): boolean => !!process.env.OLLAMA_MODEL;

/** One chat turn. Returns the text, or null if Ollama is off, not running, or answered with an error. */
export async function callOllama(
  messages: { role: string; content: string }[],
  system: string,
  maxTokens = 1024,
  timeoutMs = 110_000,
): Promise<string | null> {
  const model = process.env.OLLAMA_MODEL;
  if (!model) return null;
  const base = (process.env.OLLAMA_URL ?? "http://127.0.0.1:11434").replace(/\/+$/, "");
  try {
    const res = await fetch(`${base}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, max_tokens: maxTokens, stream: false, messages: [{ role: "system", content: system }, ...messages] }),
      signal: AbortSignal.timeout(timeoutMs), // a local model can be slow; Convex actions allow ~10 minutes, users won't wait that long
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content;
    return typeof text === "string" && text.trim() ? text : null;
  } catch {
    return null; // Ollama not running or too slow: callers fall back to the next provider
  }
}

/**
 * One request that must come back as a JSON object. Uses Ollama's own chat endpoint so the context window can be
 * raised (the default 4096 tokens is shared by the prompt and the answer) and JSON mode keeps the output well formed.
 */
export async function callOllamaJson(system: string, user: string, maxTokens = 4096, timeoutMs = 280_000, numCtx = 12_288): Promise<string | null> {
  const model = process.env.OLLAMA_MODEL;
  if (!model) return null;
  const base = (process.env.OLLAMA_URL ?? "http://127.0.0.1:11434").replace(/\/+$/, "");
  try {
    const res = await fetch(`${base}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model, stream: false, format: "json",
        options: { num_ctx: numCtx, num_predict: maxTokens, temperature: 0.4 },
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text = data.message?.content;
    return typeof text === "string" && text.trim() ? text : null;
  } catch {
    return null; // Ollama not running or too slow: the caller falls back
  }
}
