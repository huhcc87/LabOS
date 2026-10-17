import { describe, expect, it } from 'vitest';
import { passwordProblem } from '../../convex/security';
import { passwordChecks } from '../../src/lib/passwordRules';

describe('password policy (server)', () => {
  const email = 'jane.doe@lab.org';
  it.each([
    ['short', 'Ab1!xyz', /12 characters/],
    ['one character class', 'abcdefghijkl', /Mix upper/],
    ['contains a common word', 'Password-2026-xyz', /easy to guess/],
    ['contains the email name', 'Xk9!jane.doe-77Q', /email name/],
    ['repeated character', 'aaaaaaaaaaaaaaaaaaaa', /easy to guess/],
  ])('rejects %s', (_n, pw, why) => {
    expect(passwordProblem(pw, email, 'Jane Doe')).toMatch(why);
  });

  it('accepts a long passphrase and a mixed 12-character password', () => {
    expect(passwordProblem('correct horse battery staple', email)).toBeNull();
    expect(passwordProblem('Tq7!mRw2#vZp', email)).toBeNull();
  });
});

describe('password hints (client)', () => {
  it('agree with the server rule on the basics', () => {
    expect(passwordChecks('Tq7!mRw2#vZp').every((c) => c.ok)).toBe(true);
    expect(passwordChecks('short').some((c) => !c.ok)).toBe(true);
  });
});
