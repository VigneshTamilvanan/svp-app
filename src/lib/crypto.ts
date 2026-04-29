import { createVerify } from 'react-native-quick-crypto';
import { API_BASE } from '../config';

export async function sign(plaintext: string): Promise<string> {
  const res = await fetch(`${API_BASE}/api/signQR`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ plaintext }),
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText);
    throw new Error(`Signing failed (${res.status}): ${msg}`);
  }
  const { signature } = await res.json();
  return signature;
}

let _publicKeyPem: string | null = null;

export function clearPublicKeyCache(): void {
  _publicKeyPem = null;
}

async function getPublicKeyPem(): Promise<string> {
  if (_publicKeyPem) return _publicKeyPem;
  const res = await fetch(`${API_BASE}/api/public-key`);
  if (!res.ok) throw new Error(`Could not load public key (${res.status})`);
  _publicKeyPem = await res.text();
  return _publicKeyPem;
}

export async function verify(plaintext: string, signatureB64: string): Promise<boolean> {
  const pem = await getPublicKeyPem();
  try {
    const verifier = createVerify('RSA-SHA256');
    verifier.update(plaintext, 'utf8');
    return verifier.verify(pem, signatureB64, 'base64');
  } catch {
    return false;
  }
}

export async function getPublicKeyDisplay(): Promise<string> {
  return getPublicKeyPem();
}
