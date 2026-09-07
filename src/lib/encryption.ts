import "server-only";
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

const ALGORITHM = "aes-256-gcm";

function getKey(): Buffer {
  const secret = process.env.ENCRYPTION_KEY;
  if (!secret) {
    throw new Error(
      "ENCRYPTION_KEY is not set. Set it to a long random string to store secrets (like Google Drive tokens) encrypted at rest."
    );
  }
  // Derived via scrypt so any sufficiently random string works as the env
  // var, rather than requiring users to generate base64 key material.
  return scryptSync(secret, "rowdesk-token-encryption", 32);
}

/** AES-256-GCM encrypt. Output packs iv/authTag/ciphertext as base64 segments
 * joined with '.', so it can round-trip through a single text DB column. */
export function encrypt(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv, authTag, encrypted].map((b) => b.toString("base64")).join(".");
}

export function decrypt(packed: string): string {
  const [ivB64, authTagB64, dataB64] = packed.split(".");
  if (!ivB64 || !authTagB64 || !dataB64) throw new Error("Malformed encrypted value.");
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(authTagB64, "base64");
  const data = Buffer.from(dataB64, "base64");
  const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
