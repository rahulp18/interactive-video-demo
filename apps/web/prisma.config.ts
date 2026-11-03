import { definePrismaConfig } from '@prisma/cli-engine';
import { defineConfig as ormConfig } from '@prisma/orm-postgres/config';
import 'dotenv/config';
import net from 'node:net';

// Node's default 250ms per-address timeout is too short for high-latency links to Neon (ETIMEDOUT).
net.setDefaultAutoSelectFamilyAttemptTimeout(3000);

export default definePrismaConfig({
  orm: ormConfig({
    contract: "./prisma/contract.prisma",
    db: {
      connection: process.env['DATABASE_URL']!,
    },
  }),
});
