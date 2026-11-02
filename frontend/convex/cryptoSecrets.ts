/**
 * Encrypts small secrets (two-factor secrets) before they are stored.
 * Set TOTP_ENCRYPTION_KEY in the Convex dashboard to 32 random bytes, base64 encoded:
 *   openssl rand -base64 32
 * Without it, secrets are stored as before and the Security page says so. Stored values that
 * start with "enc:v1:" are encrypted; anything else is a legacy plain secret and still works.
 */
const PREFIX = "enc:v1:";

export const encryptionConfigured = (): boolean => !!process.env.TOTP_ENCRYPTION_KEY;

const b64 = (b: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(b)));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function importKey(): Promise<CryptoKey | null> {
  const raw = process.env.TOTP_ENCRYPTION_KEY;
  if (!raw) return null;
  const bytes = unb64(raw.trim());
  if (bytes.length !== 32) throw new Error("TOTP_ENCRYPTION_KEY must be 32 bytes, base64 encoded.");
  return crypto.subtle.importKey("raw", bytes, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function sealSecret(plain: string): Promise<string> {
  const key = await importKey();
  if (!key) return plain;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plain));
  return `${PREFIX}${b64(iv)}:${b64(ct)}`;
}

export async function openSecret(stored: string): Promise<string> {
  if (!stored.startsWith(PREFIX)) return stored;
  const key = await importKey();
  if (!key) throw new Error("This secret is encrypted but TOTP_ENCRYPTION_KEY is not set.");
  const [iv, ct] = stored.slice(PREFIX.length).split(":");
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(iv) }, key, unb64(ct));
  return new TextDecoder().decode(plain);
}

export async function sha256Hex(text: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, "0")).join("");
}
