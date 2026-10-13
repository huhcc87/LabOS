/** Readable message from a Convex error (ConvexError data) or any thrown value. */
export const errText = (e: unknown): string => {
  const data = (e as { data?: unknown })?.data;
  if (typeof data === 'string') return data;
  const msg = e instanceof Error ? e.message : '';
  // Convex wraps server errors as "[Request ID: …] Server Error Uncaught ConvexError: <text>"
  const m = msg.match(/ConvexError: (.+?)(?: at |\n|$)/);
  return m?.[1] ?? (msg || 'Something went wrong');
};
