// ============================================================
// Application-Level Encryption for Sensitive Deal Data
//
// Uses AES-256-GCM via Web Crypto API (built-in, no library needed).
// Encrypts sensitive fields before storing in Supabase.
// Decrypts when reading.
//
// The encryption key is derived from the org ID + a secret.
// In production, the secret should come from an env var.
// For pilot, using a client-side derived key is acceptable.
// ============================================================

const ENCRYPTION_ENABLED = false; // Set to true when ready to encrypt real data

// Sensitive field keys that should be encrypted
const SENSITIVE_FIELDS = [
  'companyName',
  'annualRevenue',
  'ebitda',
  'totalExistingDebt',
  'actualAnnualDebtService',
];

/**
 * Derive an AES key from org ID + secret.
 * Uses PBKDF2 for key derivation.
 */
async function deriveKey(orgId) {
  const secret = process.env.REACT_APP_ENCRYPTION_SECRET || 'tranche-pilot-key-2026';
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(orgId + secret),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode('tranche-salt'),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt a string value.
 */
async function encryptValue(value, key) {
  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(String(value))
  );
  // Combine IV + ciphertext, base64 encode
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt a string value.
 */
async function decryptValue(encrypted, key) {
  try {
    const combined = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0));
    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    );
    return new TextDecoder().decode(decrypted);
  } catch {
    return encrypted; // Return raw value if decryption fails (unencrypted data)
  }
}

/**
 * Encrypt sensitive fields in a deal inputs object.
 * Returns a new object with sensitive fields encrypted.
 */
export async function encryptDealInputs(inputs, orgId) {
  if (!ENCRYPTION_ENABLED || !orgId || !inputs) return inputs;

  try {
    const key = await deriveKey(orgId);
    const encrypted = { ...inputs };

    for (const field of SENSITIVE_FIELDS) {
      if (encrypted[field] !== undefined && encrypted[field] !== null && encrypted[field] !== '' && encrypted[field] !== 0) {
        encrypted[field] = await encryptValue(encrypted[field], key);
        encrypted[`_enc_${field}`] = true; // Mark as encrypted
      }
    }

    return encrypted;
  } catch (err) {
    console.warn('Encryption failed, storing unencrypted:', err);
    return inputs;
  }
}

/**
 * Decrypt sensitive fields in a deal inputs object.
 * Returns a new object with sensitive fields decrypted.
 */
export async function decryptDealInputs(inputs, orgId) {
  if (!ENCRYPTION_ENABLED || !orgId || !inputs) return inputs;

  try {
    const key = await deriveKey(orgId);
    const decrypted = { ...inputs };

    for (const field of SENSITIVE_FIELDS) {
      if (decrypted[`_enc_${field}`] && decrypted[field]) {
        const raw = await decryptValue(decrypted[field], key);
        // Try to restore original type (number vs string)
        const num = parseFloat(raw);
        decrypted[field] = isNaN(num) ? raw : num;
        delete decrypted[`_enc_${field}`];
      }
    }

    return decrypted;
  } catch (err) {
    console.warn('Decryption failed, returning raw:', err);
    return inputs;
  }
}

/**
 * Check if encryption is currently enabled.
 */
export function isEncryptionEnabled() {
  return ENCRYPTION_ENABLED;
}
