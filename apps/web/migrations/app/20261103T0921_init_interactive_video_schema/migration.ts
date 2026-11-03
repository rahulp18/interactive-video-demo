#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/09e3a946efef14b3ad67e8cdb6240dd6b3fdb4bc442135ffe398458d9ff8e06d/contract';
import endContract from '../../snapshots/09e3a946efef14b3ad67e8cdb6240dd6b3fdb4bc442135ffe398458d9ff8e06d/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  lit,
  primaryKey,
  sql,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<never, End> {
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createSchema({ schema: 'public' }),
      this.createTable({
        schema: 'public',
        table: 'Interaction',
        columns: [
          col('createdAt', 'timestamptz(3)', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('isSkippable', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('position', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('question', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('timestamp', 'float8', { notNull: true, codecRef: { codecId: 'pg/float8@1' } }),
          col('type', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz(3)', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('videoId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression('Interaction_type_check_ea447555', sql`"type" IN ('SURVEY', 'QUIZ')`),
          checkExpression('interaction_position_nonneg_f43e8efc', sql`"position" >= 0`),
          checkExpression('interaction_timestamp_nonneg_efd28394', sql`"timestamp" >= 0`),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'InteractionOption',
        columns: [
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('interactionId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('isCorrect', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('position', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('text', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression('interaction_option_position_nonneg_f43e8efc', sql`"position" >= 0`),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'InteractionResponse',
        columns: [
          col('createdAt', 'timestamptz(3)', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('interactionId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('isSkipped', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('selectedOptionId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('updatedAt', 'timestamptz(3)', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('userId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'response_skipped_matches_option_164369b0',
            sql`"isSkipped" = ("selectedOptionId" IS NULL)`,
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'User',
        columns: [
          col('createdAt', 'timestamptz(3)', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('email', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('password', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz(3)', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'Video',
        columns: [
          col('createdAt', 'timestamptz(3)', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('duration', 'float8', { notNull: true, codecRef: { codecId: 'pg/float8@1' } }),
          col('fileUrl', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('mimeType', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('title', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz(3)', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression('video_duration_nonneg_74ef1b5d', sql`"duration" >= 0`),
        ],
      }),
      this.addUnique({
        schema: 'public',
        table: 'InteractionOption',
        constraint: 'InteractionOption_id_interactionId_key',
        columns: ['id', 'interactionId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'InteractionOption',
        constraint: 'InteractionOption_interactionId_position_key',
        columns: ['interactionId', 'position'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'InteractionResponse',
        constraint: 'InteractionResponse_userId_interactionId_key',
        columns: ['userId', 'interactionId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'User',
        constraint: 'User_email_key',
        columns: ['email'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Interaction',
        index: 'Interaction_videoId_idx_5feac8db',
        columns: ['videoId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Interaction',
        index: 'Interaction_videoId_timestamp_position_idx_f4250cd7',
        columns: ['videoId', 'timestamp', 'position'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'InteractionOption',
        index: 'InteractionOption_interactionId_idx_91379984',
        columns: ['interactionId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'InteractionResponse',
        index: 'InteractionResponse_interactionId_idx_91379984',
        columns: ['interactionId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'InteractionResponse',
        index: 'InteractionResponse_selectedOptionId_idx_945b4851',
        columns: ['selectedOptionId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'InteractionResponse',
        index: 'InteractionResponse_selectedOptionId_interactionId_idx_dc11b085',
        columns: ['selectedOptionId', 'interactionId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'InteractionResponse',
        index: 'InteractionResponse_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Interaction',
        foreignKey: {
          name: 'Interaction_videoId_fkey',
          columns: ['videoId'],
          references: { schema: 'public', table: 'Video', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'InteractionOption',
        foreignKey: {
          name: 'InteractionOption_interactionId_fkey',
          columns: ['interactionId'],
          references: { schema: 'public', table: 'Interaction', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'InteractionResponse',
        foreignKey: {
          name: 'InteractionResponse_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'InteractionResponse',
        foreignKey: {
          name: 'InteractionResponse_interactionId_fkey',
          columns: ['interactionId'],
          references: { schema: 'public', table: 'Interaction', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'InteractionResponse',
        foreignKey: {
          name: 'InteractionResponse_selectedOptionId_interactionId_fkey',
          columns: ['selectedOptionId', 'interactionId'],
          references: {
            schema: 'public',
            table: 'InteractionOption',
            columns: ['id', 'interactionId'],
          },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
