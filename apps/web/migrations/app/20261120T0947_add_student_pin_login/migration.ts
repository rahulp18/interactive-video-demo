#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/4356762c4cff92f369547f1ae49773ab788f3fb6647fab2821e8d8394c7733fb/contract';
import startContract from '../../snapshots/4356762c4cff92f369547f1ae49773ab788f3fb6647fab2821e8d8394c7733fb/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/e918ee1aab6a927861624ad49ab995cda83801c669acead563454c3f4678eabe/contract';
import endContract from '../../snapshots/e918ee1aab6a927861624ad49ab995cda83801c669acead563454c3f4678eabe/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit, sql } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'User',
        column: col('pinFailedAttempts', 'int4', {
          notNull: true,
          default: lit(0),
          codecRef: { codecId: 'pg/int4@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'User',
        column: col('pinHash', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'User',
        column: col('pinLockedUntil', 'timestamptz(3)', {
          codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'User',
        column: col('username', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'User',
        constraint: 'user_pin_attempts_nonneg_b52230ef',
        expression: sql`"pinFailedAttempts" >= 0`,
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'User',
        constraint: 'user_pin_needs_username_9709ea60',
        expression: sql`"pinHash" IS NULL OR "username" IS NOT NULL`,
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'User',
        constraint: 'user_pin_students_only_2e2e3661',
        expression: sql`"pinHash" IS NULL OR "role" = 'STUDENT'`,
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'User',
        constraint: 'user_username_format_6e88c958',
        expression: sql`"username" IS NULL OR "username" ~ '^[a-z0-9_]{3,20}$'`,
      }),
      this.addUnique({
        schema: 'public',
        table: 'User',
        constraint: 'User_username_key',
        columns: ['username'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
