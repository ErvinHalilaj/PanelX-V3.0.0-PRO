import { db } from "../db";
import { sslCertificates } from "@shared/schema";
import { eq } from "drizzle-orm";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";

const execAsync = promisify(exec);

export async function getCertificates() {
  return await db.select().from(sslCertificates);
}

export async function getCertificate(id: number) {
  const [cert] = await db.select().from(sslCertificates).where(eq(sslCertificates.id, id));
  return cert;
}

export async function getCertificateByDomain(domain: string) {
  const [cert] = await db.select().from(sslCertificates).where(eq(sslCertificates.domain, domain));
  return cert;
}

function validateDomain(domain: string): boolean {
  const fqdnRegex = /^(?!-)[A-Za-z0-9-]{1,63}(?<!-)(\.[A-Za-z0-9-]{1,63})*\.[A-Za-z]{2,}$/;
  return fqdnRegex.test(domain) && domain.length <= 253;
}

function sanitizeDomain(domain: string): string {
  return domain.toLowerCase().trim().replace(/[^a-z0-9.-]/g, '');
}

export async function createCertificateRecord(data: {
  domain: string;
  renewalEmail?: string;
  autoRenew?: boolean;
}) {
  const sanitized = sanitizeDomain(data.domain);
  
  if (!validateDomain(sanitized)) {
    throw new Error('Invalid domain format. Must be a valid FQDN (e.g., example.com)');
  }
  
  const existing = await getCertificateByDomain(sanitized);
  if (existing) {
    throw new Error('Certificate record already exists for this domain');
  }
  
  const [cert] = await db.insert(sslCertificates).values({
    domain: sanitized,
    status: 'pending',
    renewalEmail: data.renewalEmail,
    autoRenew: data.autoRenew !== false,
  }).returning();
  
  return cert;
}

export async function updateCertificate(id: number, data: Partial<typeof sslCertificates.$inferInsert>) {
  const [cert] = await db.update(sslCertificates)
    .set(data)
    .where(eq(sslCertificates.id, id))
    .returning();
  return cert;
}

export async function deleteCertificate(id: number) {
  await db.delete(sslCertificates).where(eq(sslCertificates.id, id));
}

export async function requestCertificate(id: number): Promise<{ success: boolean; message: string }> {
  const cert = await getCertificate(id);
  if (!cert) {
    return { success: false, message: 'Certificate not found' };
  }
  
  try {
    const certbotPath = '/usr/bin/certbot';
    const email = cert.renewalEmail || 'admin@' + cert.domain;
    
    try {
      await fs.access(certbotPath);
    } catch {
      return { 
        success: false, 
        message: 'Certbot not installed. Install with: sudo apt install certbot python3-certbot-nginx' 
      };
    }
    
    const command = `sudo certbot certonly --nginx -d ${cert.domain} --email ${email} --agree-tos --non-interactive`;
    
    await updateCertificate(id, { status: 'pending' });
    
    const { stdout, stderr } = await execAsync(command);
    
    const certPath = `/etc/letsencrypt/live/${cert.domain}/cert.pem`;
    const keyPath = `/etc/letsencrypt/live/${cert.domain}/privkey.pem`;
    const fullchainPath = `/etc/letsencrypt/live/${cert.domain}/fullchain.pem`;
    
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 90);
    
    await updateCertificate(id, {
      status: 'active',
      certificatePath: certPath,
      privateKeyPath: keyPath,
      fullchainPath,
      issuedAt: new Date(),
      expiresAt,
      lastError: null,
    });
    
    return { success: true, message: 'Certificate issued successfully' };
    
  } catch (error: any) {
    await updateCertificate(id, {
      status: 'failed',
      lastError: error.message || 'Unknown error',
    });
    
    return { success: false, message: error.message || 'Failed to request certificate' };
  }
}

export async function renewCertificate(id: number): Promise<{ success: boolean; message: string }> {
  const cert = await getCertificate(id);
  if (!cert) {
    return { success: false, message: 'Certificate not found' };
  }
  
  try {
    const command = `sudo certbot renew --cert-name ${cert.domain} --non-interactive`;
    
    const { stdout, stderr } = await execAsync(command);
    
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 90);
    
    await updateCertificate(id, {
      lastRenewalAt: new Date(),
      expiresAt,
      status: 'active',
      lastError: null,
    });
    
    return { success: true, message: 'Certificate renewed successfully' };
    
  } catch (error: any) {
    await updateCertificate(id, {
      lastError: error.message || 'Renewal failed',
    });
    
    return { success: false, message: error.message || 'Failed to renew certificate' };
  }
}

export async function checkExpiringCertificates(daysThreshold = 30) {
  const certs = await getCertificates();
  const expiring = [];
  const now = new Date();
  const thresholdDate = new Date(now.getTime() + daysThreshold * 24 * 60 * 60 * 1000);
  
  for (const cert of certs) {
    if (cert.expiresAt && new Date(cert.expiresAt) <= thresholdDate) {
      expiring.push(cert);
    }
  }
  
  return expiring;
}

export async function autoRenewExpiring() {
  const expiring = await checkExpiringCertificates(30);
  const results = [];
  
  for (const cert of expiring) {
    if (cert.autoRenew) {
      const result = await renewCertificate(cert.id);
      results.push({ domain: cert.domain, ...result });
    }
  }
  
  return results;
}

export function generateNginxSslConfig(domain: string): string {
  return `
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ${domain};

    ssl_certificate /etc/letsencrypt/live/${domain}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${domain}/privkey.pem;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;
    ssl_session_tickets off;
    
    add_header Strict-Transport-Security "max-age=63072000" always;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

server {
    listen 80;
    listen [::]:80;
    server_name ${domain};
    return 301 https://$server_name$request_uri;
}
`;
}

export function generateInstallScript(): string {
  return `#!/bin/bash
# PanelX SSL Auto-Install Script
# This script installs Certbot and configures Let's Encrypt SSL

set -e

echo "Installing Certbot..."
apt-get update
apt-get install -y certbot python3-certbot-nginx

echo "Certbot installed successfully!"
echo ""
echo "To request a certificate for your domain, run:"
echo "  certbot certonly --nginx -d yourdomain.com --email your@email.com --agree-tos"
echo ""
echo "To auto-renew certificates, add this cron job:"
echo "  0 0 * * * /usr/bin/certbot renew --quiet"
echo ""
echo "Done!"
`;
}
