import 'dotenv/config';
import net from 'node:net';
import postgres from '@prisma/orm-postgres/runtime';
import { contractFromJson } from '@prisma/orm-postgres/static';
import type { Contract } from './contract.d';
import contractJson from './contract.json' with { type: 'json' };

// Node's default 250ms per-address timeout is too short for high-latency links to Neon (ETIMEDOUT).
net.setDefaultAutoSelectFamilyAttemptTimeout(3000);

export const contract = contractFromJson<Contract>(contractJson);

// pg treats sslmode=require as verify-full (and warns about it), and doesn't support channel_binding.
// Normalise so the connection string works as copied from Neon.
function normalizeDatabaseUrl(raw: string | undefined): string | undefined {
  if (!raw) return raw;
  try {
    const url = new URL(raw);
    const mode = url.searchParams.get('sslmode');
    if (mode === 'require' || mode === 'prefer' || mode === 'verify-ca') {
      url.searchParams.set('sslmode', 'verify-full');
    }
    url.searchParams.delete('channel_binding');
    return url.toString();
  } catch {
    return raw;
  }
}

export const db = postgres({
  contract,
  url: normalizeDatabaseUrl(process.env['DATABASE_URL'])!,
});
