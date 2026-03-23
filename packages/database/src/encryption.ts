import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

interface KeyEntry { version: number; key: string; }

function getKeyRing(): KeyEntry[] {
  const raw = process.env.ENCRYPTION_KEYS;
  if (!raw) throw new Error("ENCRYPTION_KEYS not set");
  const ring: KeyEntry[] = JSON.parse(raw);
  // Validate key lengths
  for (const entry of ring) {
    if (!/^[0-9a-f]{64}$/i.test(entry.key)) {
      throw new Error(`Encryption key version ${entry.version} must be exactly 64 hex characters (32 bytes)`);
    }
  }
  return ring;
}

function getCurrentKey(): KeyEntry {
  const ring = getKeyRing();
  return ring.reduce((a, b) => (a.version > b.version ? a : b));
}

function getKeyByVersion(version: number): Buffer {
  const ring = getKeyRing();
  const entry = ring.find((k) => k.version === version);
  if (!entry) throw new Error(`Encryption key version ${version} not found`);
  return Buffer.from(entry.key, "hex");
}

export function encrypt(plaintext: string): { encrypted: string; keyVersion: number } {
  const current = getCurrentKey();
  const key = Buffer.from(current.key, "hex");
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const combined = Buffer.concat([nonce, ciphertext, authTag]);
  return { encrypted: combined.toString("base64"), keyVersion: current.version };
}

export function decrypt(encrypted: string, keyVersion: number): string {
  const key = getKeyByVersion(keyVersion);
  const combined = Buffer.from(encrypted, "base64");
  const nonce = combined.subarray(0, 12);
  const authTag = combined.subarray(combined.length - 16);
  const ciphertext = combined.subarray(12, combined.length - 16);
  const decipher = createDecipheriv("aes-256-gcm", key, nonce);
  decipher.setAuthTag(authTag);
  return decipher.update(ciphertext).toString("utf8") + decipher.final("utf8");
}
