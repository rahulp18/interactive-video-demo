#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/5c48ae4887590bab2f26465054b1ddf616d86e8dc66461de4954efcb99c4ab89/contract';
import startContract from '../../snapshots/5c48ae4887590bab2f26465054b1ddf616d86e8dc66461de4954efcb99c4ab89/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/bca3f41b4ac2b0784a1d3b046ec3bcbd195626f89295e93558c660eb86c3bf26/contract';
import endContract from '../../snapshots/bca3f41b4ac2b0784a1d3b046ec3bcbd195626f89295e93558c660eb86c3bf26/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  fn,
  lit,
  primaryKey,
  sql,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'AuditLog',
        columns: [
          col('action', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('actorId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('at', 'timestamptz(3)', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('subjectId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'audit_action_known_e4d09d89',
            sql`"action" IN ('REPORT_VIEW', 'REPORT_PRINT')`,
          ),
        ],
      }),
      this.addColumn({
        schema: 'public',
        table: 'Session',
        column: col('parentGateAnswer', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'Session',
        column: col('parentGateChallenge', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'Session',
        column: col('parentGateFailures', 'int4', {
          notNull: true,
          default: lit(0),
          codecRef: { codecId: 'pg/int4@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'Session',
        column: col('parentGateLockedUntil', 'timestamptz(3)', {
          codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'Session',
        column: col('parentGateUntil', 'timestamptz(3)', {
          codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
        }),
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'Session',
        constraint: 'session_gate_failures_nonneg_8e8d7760',
        expression: sql`"parentGateFailures" >= 0`,
      }),
      this.createIndex({
        schema: 'public',
        table: 'AuditLog',
        index: 'AuditLog_actorId_idx_a58f6b4b',
        columns: ['actorId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'AuditLog',
        index: 'AuditLog_subjectId_at_idx_9c90ddf8',
        columns: ['subjectId', 'at'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'AuditLog',
        index: 'AuditLog_subjectId_idx_84df2a1d',
        columns: ['subjectId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'AuditLog',
        foreignKey: {
          name: 'AuditLog_actorId_fkey',
          columns: ['actorId'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'AuditLog',
        foreignKey: {
          name: 'AuditLog_subjectId_fkey',
          columns: ['subjectId'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
