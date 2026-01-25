# Phase 1 Quick Start Guide
## Security & Stability Implementation

**Timeline:** 2 weeks (10 business days)  
**Priority:** 🔴 CRITICAL  
**Goal:** Make PanelX production-ready

---

## 📋 Overview

This guide provides step-by-step instructions for implementing Phase 1: Security & Stability.

**What You'll Build:**
- ✅ Two-Factor Authentication (2FA)
- ✅ IP Whitelisting
- ✅ Comprehensive Audit Logging
- ✅ Backup & Restore System

**Expected Outcome:**
- PanelX becomes production-ready
- Security score increases from 60% to 95%
- Enterprise-grade data protection
- Full audit trail for compliance

---

## 🚀 Day 1-3: Two-Factor Authentication (2FA)

### Prerequisites
```bash
cd /home/user/webapp
npm install speakeasy qrcode @types/qrcode
```

### Step 1: Database Schema (Day 1)
Create migration file: `migrations/0010_add_2fa.sql`

```sql
-- Add 2FA columns to users table
ALTER TABLE users ADD COLUMN twoFactorSecret TEXT;
ALTER TABLE users ADD COLUMN twoFactorEnabled BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN twoFactorBackupCodes TEXT; -- JSON array of hashed codes
ALTER TABLE users ADD COLUMN lastTwoFactorCheck DATETIME;

-- Create 2FA activity log
CREATE TABLE two_factor_activity (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  action TEXT NOT NULL, -- 'setup', 'enable', 'disable', 'verify_success', 'verify_failed'
  ipAddress TEXT,
  userAgent TEXT,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users(id)
);

CREATE INDEX idx_2fa_activity_user ON two_factor_activity(userId);
CREATE INDEX idx_2fa_activity_created ON two_factor_activity(createdAt);
```

Run migration:
```bash
cd /home/user/webapp && npm run db:migrate:local
```

### Step 2: Backend Implementation (Day 1-2)
Create file: `server/auth/twoFactor.ts`

```typescript
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import crypto from 'crypto';

export interface TwoFactorSetup {
  secret: string;
  qrCode: string;
  backupCodes: string[];
}

/**
 * Generate 2FA secret and QR code
 */
export async function generateTwoFactorSetup(
  username: string,
  appName: string = 'PanelX IPTV'
): Promise<TwoFactorSetup> {
  // Generate secret
  const secret = speakeasy.generateSecret({
    name: `${appName} (${username})`,
    length: 32
  });

  // Generate QR code
  const qrCode = await QRCode.toDataURL(secret.otpauth_url!);

  // Generate backup codes (10 codes)
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
 * Verify 2FA token
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
 * Hash backup code for storage
 */
export function hashBackupCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex');
}

/**
 * Verify backup code
 */
export function verifyBackupCode(code: string, hashedCode: string): boolean {
  const hash = hashBackupCode(code);
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(hashedCode));
}
```

### Step 3: API Routes (Day 2)
Add to `server/routes.ts`:

```typescript
import { generateTwoFactorSetup, verifyTwoFactorToken, hashBackupCode, verifyBackupCode } from './auth/twoFactor';

// Setup 2FA (generate secret and QR code)
app.post('/api/auth/2fa/setup', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId!;
    const user = await storage.getUser(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Generate 2FA setup
    const setup = await generateTwoFactorSetup(user.username);

    // Save secret (not enabled yet)
    await storage.updateUser(userId, {
      twoFactorSecret: setup.secret
    });

    // Return setup info (DON'T store backup codes yet)
    res.json({
      qrCode: setup.qrCode,
      secret: setup.secret,
      backupCodes: setup.backupCodes
    });
  } catch (error) {
    console.error('2FA setup error:', error);
    res.status(500).json({ error: 'Failed to setup 2FA' });
  }
});

// Verify and enable 2FA
app.post('/api/auth/2fa/enable', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId!;
    const { token, backupCodes } = req.body;

    const user = await storage.getUser(userId);
    if (!user || !user.twoFactorSecret) {
      return res.status(400).json({ error: '2FA not set up' });
    }

    // Verify token
    const isValid = verifyTwoFactorToken(user.twoFactorSecret, token);
    if (!isValid) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }

    // Hash backup codes
    const hashedCodes = backupCodes.map(hashBackupCode);

    // Enable 2FA
    await storage.updateUser(userId, {
      twoFactorEnabled: true,
      twoFactorBackupCodes: JSON.stringify(hashedCodes),
      lastTwoFactorCheck: new Date()
    });

    // Log activity
    await storage.db.execute(
      'INSERT INTO two_factor_activity (userId, action, ipAddress, userAgent) VALUES (?, ?, ?, ?)',
      [userId, 'enable', req.ip, req.get('user-agent')]
    );

    res.json({ success: true, message: '2FA enabled successfully' });
  } catch (error) {
    console.error('2FA enable error:', error);
    res.status(500).json({ error: 'Failed to enable 2FA' });
  }
});

// Verify 2FA during login
app.post('/api/auth/2fa/verify', async (req, res) => {
  try {
    const { userId, token, isBackupCode } = req.body;

    const user = await storage.getUser(userId);
    if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
      return res.status(400).json({ error: '2FA not enabled' });
    }

    let isValid = false;

    if (isBackupCode) {
      // Verify backup code
      const hashedCodes = JSON.parse(user.twoFactorBackupCodes || '[]');
      const codeIndex = hashedCodes.findIndex((hashed: string) => 
        verifyBackupCode(token, hashed)
      );

      if (codeIndex !== -1) {
        isValid = true;
        // Remove used backup code
        hashedCodes.splice(codeIndex, 1);
        await storage.updateUser(userId, {
          twoFactorBackupCodes: JSON.stringify(hashedCodes)
        });
      }
    } else {
      // Verify TOTP token
      isValid = verifyTwoFactorToken(user.twoFactorSecret, token);
    }

    if (!isValid) {
      // Log failed attempt
      await storage.db.execute(
        'INSERT INTO two_factor_activity (userId, action, ipAddress, userAgent) VALUES (?, ?, ?, ?)',
        [userId, 'verify_failed', req.ip, req.get('user-agent')]
      );
      return res.status(400).json({ error: 'Invalid verification code' });
    }

    // Log successful verification
    await storage.db.execute(
      'INSERT INTO two_factor_activity (userId, action, ipAddress, userAgent) VALUES (?, ?, ?, ?)',
      [userId, 'verify_success', req.ip, req.get('user-agent')]
    );

    // Update last check time
    await storage.updateUser(userId, {
      lastTwoFactorCheck: new Date()
    });

    // Set session as 2FA verified
    req.session.twoFactorVerified = true;

    res.json({ success: true });
  } catch (error) {
    console.error('2FA verify error:', error);
    res.status(500).json({ error: 'Failed to verify 2FA' });
  }
});

// Disable 2FA
app.post('/api/auth/2fa/disable', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId!;
    const { password } = req.body;

    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify password for security
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ error: 'Invalid password' });
    }

    // Disable 2FA
    await storage.updateUser(userId, {
      twoFactorEnabled: false,
      twoFactorSecret: null,
      twoFactorBackupCodes: null
    });

    // Log activity
    await storage.db.execute(
      'INSERT INTO two_factor_activity (userId, action, ipAddress, userAgent) VALUES (?, ?, ?, ?)',
      [userId, 'disable', req.ip, req.get('user-agent')]
    );

    res.json({ success: true, message: '2FA disabled successfully' });
  } catch (error) {
    console.error('2FA disable error:', error);
    res.status(500).json({ error: 'Failed to disable 2FA' });
  }
});
```

Update login route to require 2FA:
```typescript
app.post('/api/auth/login', async (req, res) => {
  // ... existing authentication code ...

  // Check if 2FA is enabled
  if (user.twoFactorEnabled) {
    // Don't fully log in yet, require 2FA verification
    return res.json({
      requiresTwoFactor: true,
      userId: user.id,
      message: 'Please enter your 2FA code'
    });
  }

  // Normal login flow if 2FA not enabled
  req.session.userId = user.id;
  req.session.role = user.role;
  // ...
});
```

### Step 4: Frontend Implementation (Day 3)
Create file: `client/src/pages/Settings/TwoFactor.tsx`

```typescript
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

export function TwoFactorSettings() {
  const { toast } = useToast();
  const [is2FAEnabled, setIs2FAEnabled] = useState(false);
  const [qrCode, setQrCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [verificationToken, setVerificationToken] = useState('');
  const [showSetup, setShowSetup] = useState(false);

  async function handleSetup2FA() {
    try {
      const res = await fetch('/api/auth/2fa/setup', {
        method: 'POST',
        credentials: 'include'
      });

      if (!res.ok) throw new Error('Setup failed');

      const data = await res.json();
      setQrCode(data.qrCode);
      setBackupCodes(data.backupCodes);
      setShowSetup(true);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to setup 2FA',
        variant: 'destructive'
      });
    }
  }

  async function handleEnable2FA() {
    try {
      const res = await fetch('/api/auth/2fa/enable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          token: verificationToken,
          backupCodes
        })
      });

      if (!res.ok) throw new Error('Verification failed');

      setIs2FAEnabled(true);
      setShowSetup(false);
      toast({
        title: 'Success',
        description: '2FA enabled successfully'
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Invalid verification code',
        variant: 'destructive'
      });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Two-Factor Authentication</CardTitle>
        <CardDescription>
          Add an extra layer of security to your account
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!is2FAEnabled && !showSetup && (
          <Button onClick={handleSetup2FA}>Enable 2FA</Button>
        )}

        {showSetup && (
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Step 1: Scan QR Code</h3>
              <p className="text-sm text-gray-600 mb-4">
                Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
              </p>
              {qrCode && <img src={qrCode} alt="2FA QR Code" className="w-64 h-64" />}
            </div>

            <div>
              <h3 className="font-semibold mb-2">Step 2: Save Backup Codes</h3>
              <p className="text-sm text-gray-600 mb-2">
                Save these backup codes in a safe place. Each code can only be used once.
              </p>
              <div className="bg-gray-100 p-4 rounded font-mono text-sm">
                {backupCodes.map((code, i) => (
                  <div key={i}>{code}</div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Step 3: Verify</h3>
              <p className="text-sm text-gray-600 mb-2">
                Enter the 6-digit code from your authenticator app
              </p>
              <Input
                type="text"
                placeholder="000000"
                maxLength={6}
                value={verificationToken}
                onChange={(e) => setVerificationToken(e.target.value)}
              />
            </div>

            <Button onClick={handleEnable2FA} disabled={verificationToken.length !== 6}>
              Verify and Enable 2FA
            </Button>
          </div>
        )}

        {is2FAEnabled && (
          <div className="text-green-600">
            ✅ Two-Factor Authentication is enabled
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

### Testing (Day 3)
```bash
# Test 2FA flow
curl -X POST http://localhost:3000/api/auth/2fa/setup \
  -H "Content-Type: application/json" \
  -b cookies.txt

# Install Google Authenticator on phone
# Scan QR code
# Test verification
```

---

## 🚀 Day 4-5: IP Whitelisting

### Step 1: Database Schema (Day 4)
Create migration: `migrations/0011_add_ip_whitelist.sql`

```sql
CREATE TABLE ip_whitelist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER,
  ipAddress TEXT NOT NULL,
  ipRange TEXT,
  description TEXT,
  isActive BOOLEAN DEFAULT true,
  createdBy INTEGER,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  lastUsed DATETIME,
  FOREIGN KEY (userId) REFERENCES users(id),
  FOREIGN KEY (createdBy) REFERENCES users(id)
);

CREATE INDEX idx_ip_whitelist_user ON ip_whitelist(userId);
CREATE INDEX idx_ip_whitelist_ip ON ip_whitelist(ipAddress);
CREATE INDEX idx_ip_whitelist_active ON ip_whitelist(isActive);
```

### Step 2: Middleware (Day 4-5)
Create `server/middleware/ipWhitelist.ts`:

```typescript
import { Request, Response, NextFunction } from 'express';
import ipaddr from 'ipaddr.js';

export function ipWhitelistMiddleware(req: Request, res: Response, next: NextFunction) {
  // Get client IP
  const clientIP = req.ip || req.connection.remoteAddress || '';
  
  // Check if IP is whitelisted
  // Implementation here...
  
  next();
}
```

---

## ⏭️ Continue with Days 6-10

Due to length, the remaining days (6-10) covering Audit Logging and Backup/Restore are in the full **IMPLEMENTATION_ROADMAP.md** document.

---

## ✅ Daily Checklist

**Day 1:**
- [ ] Install dependencies (speakeasy, qrcode)
- [ ] Create 2FA database migration
- [ ] Run migration locally
- [ ] Create twoFactor.ts utility file

**Day 2:**
- [ ] Implement 2FA API routes
- [ ] Update login route for 2FA
- [ ] Test API endpoints with curl

**Day 3:**
- [ ] Create TwoFactor settings component
- [ ] Integrate with Settings page
- [ ] Test full 2FA flow
- [ ] Test with Google Authenticator

**Day 4:**
- [ ] Create IP whitelist migration
- [ ] Create IP whitelist middleware
- [ ] Implement IP checking logic

**Day 5:**
- [ ] Create IP whitelist UI
- [ ] Test IP restrictions
- [ ] Document IP whitelist feature

---

## 📚 Resources

- **Speakeasy Docs:** https://github.com/speakeasyjs/speakeasy
- **QRCode Docs:** https://github.com/soldair/node-qrcode
- **Google Authenticator:** https://play.google.com/store/apps/details?id=com.google.android.apps.authenticator2

---

*Phase 1 Quick Start Guide*  
*For full details, see IMPLEMENTATION_ROADMAP.md*
