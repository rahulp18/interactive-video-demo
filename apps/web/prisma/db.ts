import 'dotenv/config';
import net from 'node:net';
import postgres from '@prisma/orm-postgres/runtime';
import { contractFromJson } from '@prisma/orm-postgres/static';
import type { Contract } from './contract.d';
import contractJson from './contract.json' with { type: 'json' };

// Node's default 250ms per-address timeout is too short for high-latency links to Neon (ETIMEDOUT).
net.setDefaultAutoSelectFamilyAttemptTimeout(3000);

export const contract =contractFromJson<Contract>(contractJson);

export const db = postgres({
  contract,
  url: process.env['DATABASE_URL']!,
});
