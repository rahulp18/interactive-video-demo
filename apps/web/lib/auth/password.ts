import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

// OWASP-recommended scrypt parameters (N=2^17, r=8, p=1). maxmem must exceed 128 * N * r.
const PARAMS = { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 } satisfies ScryptOptions;
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

function derive(password: string, salt: Buffer, params: ScryptOptions, keyLength: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password.normalize("NFKC"), salt, keyLength, params, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

/** Format: `scrypt$N$r$p$<salt b64>$<hash b64>`. Parameters are stored so they can be raised later. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const key = await derive(password, salt, PARAMS, KEY_LENGTH);
  return ["scrypt", PARAMS.N, PARAMS.r, PARAMS.p, salt.toString("base64"), key.toString("base64")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, r, p, saltB64, hashB64] = parts;
  const expected = Buffer.from(hashB64, "base64");
  const params = { N: Number(n), r: Number(r), p: Number(p), maxmem: PARAMS.maxmem };
  if (![params.N, params.r, params.p].every(Number.isInteger) || expected.length === 0) return false;
  try {
    const actual = await derive(password, Buffer.from(saltB64, "base64"), params, expected.length);
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

// Verified against when the account does not exist so that login timing does not reveal which emails are registered.
let dummyHash: Promise<string> | undefined;
export function verifyAgainstDummy(password: string): Promise<boolean> {
  dummyHash ??= hashPassword(randomBytes(16).toString("hex"));
  return dummyHash.then((h) => verifyPassword(password, h));
}
