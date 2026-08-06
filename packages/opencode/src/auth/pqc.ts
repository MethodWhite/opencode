/**
 * PQC-ready authentication using Web Crypto API.
 *
 * Uses ECDSA P-256 for now (widely supported, upgradable to ML-DSA).
 * When Web Crypto adds ML-DSA support, swap the algorithm constant.
 */

const ALGORITHM = "ECDSA"
const CURVE = "P-256"
const HASH = "SHA-256"
const CHALLENGE_BYTES = 32

export interface KeyPair {
  privateKey: CryptoKey
  publicKey: CryptoKey
  publicKeyJwk: JsonWebKey
}

export interface Challenge {
  nonce: string
  created_at: number
  expires_at: number
}

export interface VerificationResult {
  verified: boolean
  error?: string
}

function base64url(buf: ArrayBuffer): string {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
}

function fromBase64url(str: string): Uint8Array {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (str.length % 4)) % 4)
  return new Uint8Array(Buffer.from(base64, "base64"))
}

export async function generateKeypair(): Promise<KeyPair> {
  const { privateKey, publicKey } = await crypto.subtle.generateKey(
    { name: ALGORITHM, namedCurve: CURVE },
    true,
    ["sign", "verify"],
  )
  const publicKeyJwk = await crypto.subtle.exportKey("jwk", publicKey)
  return { privateKey, publicKey, publicKeyJwk }
}

export async function exportPublicKeyBase64(publicKey: CryptoKey): Promise<string> {
  const jwk = await crypto.subtle.exportKey("jwk", publicKey)
  return Buffer.from(JSON.stringify(jwk)).toString("base64")
}

export async function importPublicKey(base64Jwk: string): Promise<CryptoKey> {
  const jwk = JSON.parse(Buffer.from(base64Jwk, "base64").toString())
  return crypto.subtle.importKey("jwk", jwk, { name: ALGORITHM, namedCurve: CURVE }, true, ["verify"])
}

export async function createChallenge(): Promise<Challenge> {
  const nonceBytes = crypto.getRandomValues(new Uint8Array(CHALLENGE_BYTES))
  const nonce = base64url(nonceBytes.buffer)
  const now = Math.floor(Date.now() / 1000)
  return {
    nonce,
    created_at: now,
    expires_at: now + 300, // 5 minutes
  }
}

export async function signChallenge(nonce: string, privateKey: CryptoKey): Promise<string> {
  const encoded = new TextEncoder().encode(nonce)
  const signature = await crypto.subtle.sign(
    { name: ALGORITHM, hash: HASH },
    privateKey,
    encoded as BufferSource,
  )
  return base64url(signature)
}

export async function verifySignature(
  nonce: string,
  signatureB64: string,
  publicKey: CryptoKey,
): Promise<VerificationResult> {
  try {
    const sigBytes = fromBase64url(signatureB64)
    const encoded = new TextEncoder().encode(nonce)
    const verified = await crypto.subtle.verify(
      { name: ALGORITHM, hash: HASH },
      publicKey,
      sigBytes as BufferSource,
      encoded as BufferSource,
    )
    return { verified, error: verified ? undefined : "Signature mismatch" }
  } catch (err) {
    return { verified: false, error: String(err) }
  }
}
