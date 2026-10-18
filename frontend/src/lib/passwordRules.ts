/** Mirrors the server rule in convex/security.ts (passwordProblem) so people see what is wrong while typing. The server decides. */
export function passwordChecks(pw: string): Array<{ label: string; ok: boolean }> {
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length;
  return [
    { label: 'At least 12 characters', ok: pw.length >= 12 },
    { label: 'Upper and lower case, numbers or symbols (3 of 4), or 16+ characters', ok: classes >= 3 || pw.length >= 16 },
  ];
}
