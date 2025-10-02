import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const SECRET_KEY = process.env.CREDENTIAL_ENCRYPTION_KEY;

if (!SECRET_KEY) {
  throw new Error('CREDENTIAL_ENCRYPTION_KEY environment variable is required');
}

// Create a typed, non-null alias for TypeScript and a Buffer for crypto
const SECRET_KEY_STR: string = SECRET_KEY;
const SECRET_KEY_BUF = Buffer.from(SECRET_KEY_STR);

// Ensure the key is exactly 32 bytes
const KEY = crypto.scryptSync(SECRET_KEY_STR, 'salt', 32);

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  cipher.setAAD(Buffer.from('SoulSyncConnect'));
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
}

export function decrypt(encryptedData: string): string {
  const parts = encryptedData.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format');
  }
  
  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encrypted = parts[2];
  
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAAD(Buffer.from('SoulSyncConnect'));
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

export function hashPassword(password: string): string {
  // Use the precomputed Buffer salt to satisfy TypeScript and runtime.
  return crypto.pbkdf2Sync(password, SECRET_KEY_BUF, 10000, 64, 'sha512').toString('hex');
}

export function verifypassword(password: string, hash: string): boolean {
  const hashToVerify = crypto.pbkdf2Sync(password, SECRET_KEY_BUF, 10000, 64, 'sha512').toString('hex');
  return hashToVerify === hash;
}