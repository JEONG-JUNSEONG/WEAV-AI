import fs from 'fs';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env');

const requiredKeys = [
  'VITE_API_BASE_URL',
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
];

const optionalKeys = [
  'VITE_PORTONE_STORE_ID',
  'VITE_PORTONE_CHANNEL_KEY',
  'VITE_BYPASS_MEMBERSHIP',
  'VITE_HIDE_BILLING_UI',
];

const parseEnv = (text) => {
  const result = {};
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    result[key] = value;
  }
  return result;
};

if (!fs.existsSync(envPath)) {
  console.error('[check-env] .env not found at:', envPath);
  process.exit(1);
}

const envText = fs.readFileSync(envPath, 'utf8');
const env = parseEnv(envText);

const missing = requiredKeys.filter((key) => !env[key]);

if (missing.length > 0) {
  console.error('[check-env] Missing required env vars:');
  for (const key of missing) {
    console.error(`  - ${key}`);
  }
  console.error('[check-env] Fill them in frontend/.env before building.');
  process.exit(1);
}

const emptyOptional = optionalKeys.filter((key) => key in env && !env[key]);
if (emptyOptional.length > 0) {
  console.warn('[check-env] Optional env vars present but empty:');
  for (const key of emptyOptional) {
    console.warn(`  - ${key}`);
  }
}

console.log('[check-env] OK');
