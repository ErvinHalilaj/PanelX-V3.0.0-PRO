import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import crypto from 'crypto';

export interface TwoFactorSetup {
  secret: string;
  qrCode: string;
  backupCodes: string[];
}

/**
 * Generate 2FA secret and QR code for user setup
 * @param username - Username for the 2FA account
 * @param appName - Application name to display in authenticator app
 * @returns Setup information including secret, QR code, and backup codes
 */
export async function generateTwoFactorSetup(
  username: string,
  appName: string = 'PanelX IPTV'
): Promise<TwoFactorSetup> {
  // Generate secret
  const secret = speakeasy.generateSecret({
    name: `${appName} (${username})`,
    length: 32,
    issuer: appName
  });

  if (!secret.otpauth_url) {
    throw new Error('Failed to generate OTP auth URL');
  }

  // Generate QR code as data URL
  const qrCode = await QRCode.toDataURL(secret.otpauth_url);

  // Generate 10 backup codes (8 characters each, uppercase hex)
  const backupCodes = Array.from({ length: 10 }, () => 
    crypto.randomBytes(4).toString('hex').toUpperCase()
  );

  return {
    secret: secret.base32,
    qrCode,
    backupCodes
  };
}

/**
 * Verify a 2FA token against the secret
 * @param secret - The base32 encoded secret
 * @param token - The 6-digit token from authenticator app
 * @param window - Time window for token validity (default: 1 = 30 seconds before/after)
 * @returns True if token is valid
 */
export function verifyTwoFactorToken(
  secret: string,
  token: string,
  window: number = 1
): boolean {
  return speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token,
    window
  });
}

/**
 * Hash a backup code for secure storage
 * @param code - The backup code to hash
 * @returns SHA-256 hash of the code
 */
export function hashBackupCode(code: string): string {
  return crypto.createHash('sha256').update(code.toUpperCase()).digest('hex');
}

/**
 * Verify a backup code against a hashed version
 * @param code - The backup code to verify
 * @param hashedCode - The stored hash
 * @returns True if code matches the hash
 */
export function verifyBackupCode(code: string, hashedCode: string): boolean {
  const hash = hashBackupCode(code);
  try {
    return crypto.timingSafeEqual(
      Buffer.from(hash),
      Buffer.from(hashedCode)
    );
  } catch {
    return false;
  }
}

/**
 * Generate a new set of backup codes
 * @param count - Number of backup codes to generate (default: 10)
 * @returns Array of backup codes
 */
export function generateBackupCodes(count: number = 10): string[] {
  return Array.from({ length: count }, () => 
    crypto.randomBytes(4).toString('hex').toUpperCase()
  );
}
