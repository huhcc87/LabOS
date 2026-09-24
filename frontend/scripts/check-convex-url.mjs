// Fails the build if VITE_CONVEX_URL doesn't point at a live Convex deployment.
// Catches misconfigured env vars (e.g. a dead custom domain) before they ship.
const url = process.env.VITE_CONVEX_URL;

if (!url) {
  console.error("[check-convex-url] VITE_CONVEX_URL is not set — skipping build (nothing to check).");
  process.exit(1);
}

try {
  const res = await fetch(`${url}/version`, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) {
    console.error(`[check-convex-url] ${url}/version returned HTTP ${res.status} — deployment is unreachable.`);
    process.exit(1);
  }
  console.log(`[check-convex-url] ${url} is reachable.`);
} catch (err) {
  console.error(`[check-convex-url] Failed to reach ${url}: ${err.message}`);
  process.exit(1);
}
