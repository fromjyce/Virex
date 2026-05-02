/**
 * Ed25519 keypair generation and message signing using TweetNaCl.
 * Each peer generates a keypair on startup and includes the public key
 * in the signaling registration. Handshakes are verified before data exchange.
 */
import nacl from 'tweetnacl';
import { encodeBase64, decodeBase64, encodeUTF8 } from 'tweetnacl-util';

export interface PeerKeypair {
  publicKey: string;  // base64-encoded Ed25519 public key
  secretKey: Uint8Array;
}

export function generateKeypair(): PeerKeypair {
  const kp = nacl.sign.keyPair();
  return {
    publicKey: 'ed25519:' + encodeBase64(kp.publicKey),
    secretKey: kp.secretKey,
  };
}

export function signMessage(message: string, secretKey: Uint8Array): string {
  const msgBytes = encodeUTF8(message);
  const sig = nacl.sign.detached(msgBytes, secretKey);
  return encodeBase64(sig);
}

export function verifySignature(
  message: string,
  signature: string,
  publicKeyB64: string
): boolean {
  try {
    const raw = publicKeyB64.startsWith('ed25519:')
      ? publicKeyB64.slice(8)
      : publicKeyB64;
    const msgBytes  = encodeUTF8(message);
    const sigBytes  = decodeBase64(signature);
    const pubBytes  = decodeBase64(raw);
    return nacl.sign.detached.verify(msgBytes, sigBytes, pubBytes);
  } catch {
    return false;
  }
}

/**
 * SHA-256 hash of an ArrayBuffer. Used for per-chunk integrity verification.
 */
export async function sha256(data: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray  = Array.from(new Uint8Array(hashBuffer));
  return 'sha256:' + hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verify a chunk matches its expected hash. Rejects corrupted or poisoned data.
 */
export async function verifyChunk(chunk: ArrayBuffer, expectedHash: string): Promise<boolean> {
  const actual = await sha256(chunk);
  return actual === expectedHash;
}

/**
 * Encrypt a payload using XSalsa20-Poly1305 (symmetric, for DataChannel messages).
 * Both sides derive a shared key from ECDH (see: deriveSharedKey).
 */
export function encryptPayload(
  message: Uint8Array,
  sharedKey: Uint8Array
): { ciphertext: string; nonce: string } {
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const box   = nacl.secretbox(message, nonce, sharedKey);
  return {
    ciphertext: encodeBase64(box),
    nonce:      encodeBase64(nonce),
  };
}

export function decryptPayload(
  ciphertext: string,
  nonce: string,
  sharedKey: Uint8Array
): Uint8Array | null {
  try {
    return nacl.secretbox.open(
      decodeBase64(ciphertext),
      decodeBase64(nonce),
      sharedKey
    );
  } catch {
    return null;
  }
}
