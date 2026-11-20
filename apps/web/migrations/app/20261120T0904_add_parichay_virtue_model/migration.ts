#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/4356762c4cff92f369547f1ae49773ab788f3fb6647fab2821e8d8394c7733fb/contract';
import endContract from '../../snapshots/4356762c4cff92f369547f1ae49773ab788f3fb6647fab2821e8d8394c7733fb/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/eb150eb2888477c1b3fd9720dd42516664f3e86f581952e84aef3f497de256a5/contract';
import startContract from '../../snapshots/eb150eb2888477c1b3fd9720dd42516664f3e86f581952e84aef3f497de256a5/contract.json' with { type: 'json' };
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
import postgres from '@prisma/orm-postgres/runtime';
import { contractFromJson } from '@prisma/orm-postgres/static';

// Lazily connecting; only used to build the typed query plans for the data transform below.
const { sql: db, contract } = postgres({ contract: contractFromJson<End>(endContract) });

// The 10 core virtues, in their fixed display order. Reference data: every database gets exactly these rows.
const VIRTUES = [
  ['self-discipline', 'Self-Discipline', 'Controlling desires, emotions and impulses'],
  ['compassion', 'Compassion', "Feeling others' suffering and acting to relieve it"],
  ['responsibility', 'Responsibility', 'Accountability for actions, duties and promises'],
  ['friendship', 'Friendship', 'Trust, loyalty and support between people'],
  ['work', 'Work', 'Dignity and satisfaction in honest diligence'],
  ['courage', 'Courage', 'Standing up for what is right despite fear'],
  ['perseverance', 'Perseverance', 'Persisting through difficulty and delay'],
  ['honesty', 'Honesty', 'Truthfulness in word and action'],
  ['loyalty', 'Loyalty', 'Steadfast devotion to family, friends and principles'],
  ['faith', 'Faith', 'Belief in something higher; hope and reverence'],
] as const;

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'Journey',
        columns: [
          col('createdAt', 'timestamptz(3)', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('description', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('displayOrder', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('focusVirtueId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('title', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz(3)', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'JourneyModule',
        columns: [
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('journeyId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('level', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('moduleId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('position', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression('journey_module_level_positive_28bb2a3c', sql`"level" >= 1`),
          checkExpression('journey_module_position_nonneg_f43e8efc', sql`"position" >= 0`),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'Module',
        columns: [
          col('ageBand', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz(3)', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('discussionPrompts', 'text[]', {
            notNull: true,
            codecRef: { codecId: 'pg/text@1', many: true },
          }),
          col('followUpActivity', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('learningObjective', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('primaryVirtueId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('sourceStory', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('DRAFT'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('updatedAt', 'timestamptz(3)', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('version', 'int4', {
            notNull: true,
            default: lit(1),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('videoId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression('Module_ageBand_check_85d7e4e4', sql`"ageBand" IN ('8-9', '10-12')`),
          checkExpression(
            'Module_discussionPrompts_elem_not_null_a9f52e86',
            sql`array_position("discussionPrompts", NULL) IS NULL`,
          ),
          checkExpression('Module_status_check_1b4a7b6b', sql`"status" IN ('DRAFT', 'PUBLISHED')`),
          checkExpression('module_version_positive_efd86c31', sql`"version" >= 1`),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'ModuleProgress',
        columns: [
          col('completedAt', 'timestamptz(3)', {
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('lastPositionSeconds', 'float8', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/float8@1' },
          }),
          col('moduleId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('startedAt', 'timestamptz(3)', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('updatedAt', 'timestamptz(3)', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('userId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression('progress_position_nonneg_5a814b60', sql`"lastPositionSeconds" >= 0`),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'ModuleSecondaryVirtue',
        columns: [
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('moduleId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('position', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('primaryVirtueId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('virtueId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'module_secondary_not_primary_c96bdc71',
            sql`"virtueId" <> "primaryVirtueId"`,
          ),
          checkExpression('module_secondary_position_bd4b0c45', sql`"position" IN (1, 2)`),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'OptionVirtueWeight',
        columns: [
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('optionId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('virtueId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('weight', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'option_weight_range_1322491d',
            sql`"weight" BETWEEN -2 AND 2 AND "weight" <> 0`,
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'Virtue',
        columns: [
          col('essence', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('position', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('slug', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression('virtue_position_range_ecfe7de6', sql`"position" BETWEEN 1 AND 10`),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'VirtueRating',
        columns: [
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('mark', 'text', {
            notNull: true,
            default: lit('NONE'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('notes', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('ratedAt', 'timestamptz(3)', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('raterKind', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('raterName', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('rating', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('studentId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('virtueId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'VirtueRating_mark_check_5f4e5d6c',
            sql`"mark" IN ('NONE', 'STRENGTH', 'IMPROVE')`,
          ),
          checkExpression(
            'VirtueRating_raterKind_check_6700c037',
            sql`"raterKind" IN ('PARENT', 'TEACHER')`,
          ),
          checkExpression('virtue_rating_range_63f6196d', sql`"rating" BETWEEN 1 AND 5`),
        ],
      }),
      this.addColumn({
        schema: 'public',
        table: 'Interaction',
        column: col('presentationStyle', 'text', {
          notNull: true,
          default: lit('MORAL_CHOICE'),
          codecRef: { codecId: 'pg/text@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'InteractionResponse',
        column: col('attemptCount', 'int4', {
          notNull: true,
          default: lit(1),
          codecRef: { codecId: 'pg/int4@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'InteractionResponse',
        column: col('replayCount', 'int4', {
          notNull: true,
          default: lit(0),
          codecRef: { codecId: 'pg/int4@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'InteractionResponse',
        column: col('responseTimeMs', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'Interaction',
        constraint: 'Interaction_presentationStyle_check_1e360111',
        expression: sql`"presentationStyle" IN ('MORAL_CHOICE', 'SITUATIONAL', 'EMOTION', 'PREDICT', 'RATING')`,
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'InteractionResponse',
        constraint: 'response_attempt_positive_62c2cdd0',
        expression: sql`"attemptCount" >= 1`,
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'InteractionResponse',
        constraint: 'response_replays_nonneg_b93945e1',
        expression: sql`"replayCount" >= 0`,
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'InteractionResponse',
        constraint: 'response_time_nonneg_a3ea0795',
        expression: sql`"responseTimeMs" IS NULL OR "responseTimeMs" >= 0`,
      }),
      this.addUnique({
        schema: 'public',
        table: 'JourneyModule',
        constraint: 'JourneyModule_journeyId_moduleId_key',
        columns: ['journeyId', 'moduleId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'JourneyModule',
        constraint: 'JourneyModule_journeyId_level_position_key',
        columns: ['journeyId', 'level', 'position'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'Module',
        constraint: 'Module_videoId_key',
        columns: ['videoId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'Module',
        constraint: 'Module_id_primaryVirtueId_key',
        columns: ['id', 'primaryVirtueId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'ModuleProgress',
        constraint: 'ModuleProgress_userId_moduleId_key',
        columns: ['userId', 'moduleId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'ModuleSecondaryVirtue',
        constraint: 'ModuleSecondaryVirtue_moduleId_position_key',
        columns: ['moduleId', 'position'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'ModuleSecondaryVirtue',
        constraint: 'ModuleSecondaryVirtue_moduleId_virtueId_key',
        columns: ['moduleId', 'virtueId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'OptionVirtueWeight',
        constraint: 'OptionVirtueWeight_optionId_virtueId_key',
        columns: ['optionId', 'virtueId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'Virtue',
        constraint: 'Virtue_slug_key',
        columns: ['slug'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'Virtue',
        constraint: 'Virtue_position_key',
        columns: ['position'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Journey',
        index: 'Journey_focusVirtueId_idx_9e10deff',
        columns: ['focusVirtueId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'JourneyModule',
        index: 'JourneyModule_journeyId_idx_6d2acbdc',
        columns: ['journeyId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'JourneyModule',
        index: 'JourneyModule_moduleId_idx_04fe188b',
        columns: ['moduleId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Module',
        index: 'Module_primaryVirtueId_idx_e584541b',
        columns: ['primaryVirtueId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ModuleProgress',
        index: 'ModuleProgress_moduleId_idx_04fe188b',
        columns: ['moduleId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ModuleProgress',
        index: 'ModuleProgress_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ModuleSecondaryVirtue',
        index: 'ModuleSecondaryVirtue_moduleId_primaryVirtueId_idx_0ad0c278',
        columns: ['moduleId', 'primaryVirtueId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ModuleSecondaryVirtue',
        index: 'ModuleSecondaryVirtue_virtueId_idx_e138c4cd',
        columns: ['virtueId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'OptionVirtueWeight',
        index: 'OptionVirtueWeight_optionId_idx_b1d5fce5',
        columns: ['optionId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'OptionVirtueWeight',
        index: 'OptionVirtueWeight_virtueId_idx_e138c4cd',
        columns: ['virtueId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'VirtueRating',
        index: 'VirtueRating_studentId_idx_bf255322',
        columns: ['studentId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'VirtueRating',
        index: 'VirtueRating_studentId_raterKind_idx_d2c3d7bb',
        columns: ['studentId', 'raterKind'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'VirtueRating',
        index: 'VirtueRating_virtueId_idx_e138c4cd',
        columns: ['virtueId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Journey',
        foreignKey: {
          name: 'Journey_focusVirtueId_fkey',
          columns: ['focusVirtueId'],
          references: { schema: 'public', table: 'Virtue', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'JourneyModule',
        foreignKey: {
          name: 'JourneyModule_journeyId_fkey',
          columns: ['journeyId'],
          references: { schema: 'public', table: 'Journey', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'JourneyModule',
        foreignKey: {
          name: 'JourneyModule_moduleId_fkey',
          columns: ['moduleId'],
          references: { schema: 'public', table: 'Module', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Module',
        foreignKey: {
          name: 'Module_videoId_fkey',
          columns: ['videoId'],
          references: { schema: 'public', table: 'Video', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Module',
        foreignKey: {
          name: 'Module_primaryVirtueId_fkey',
          columns: ['primaryVirtueId'],
          references: { schema: 'public', table: 'Virtue', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'ModuleProgress',
        foreignKey: {
          name: 'ModuleProgress_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'ModuleProgress',
        foreignKey: {
          name: 'ModuleProgress_moduleId_fkey',
          columns: ['moduleId'],
          references: { schema: 'public', table: 'Module', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'ModuleSecondaryVirtue',
        foreignKey: {
          name: 'ModuleSecondaryVirtue_virtueId_fkey',
          columns: ['virtueId'],
          references: { schema: 'public', table: 'Virtue', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'ModuleSecondaryVirtue',
        foreignKey: {
          name: 'ModuleSecondaryVirtue_moduleId_primaryVirtueId_fkey',
          columns: ['moduleId', 'primaryVirtueId'],
          references: { schema: 'public', table: 'Module', columns: ['id', 'primaryVirtueId'] },
          onDelete: 'cascade',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'OptionVirtueWeight',
        foreignKey: {
          name: 'OptionVirtueWeight_optionId_fkey',
          columns: ['optionId'],
          references: { schema: 'public', table: 'InteractionOption', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'OptionVirtueWeight',
        foreignKey: {
          name: 'OptionVirtueWeight_virtueId_fkey',
          columns: ['virtueId'],
          references: { schema: 'public', table: 'Virtue', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'VirtueRating',
        foreignKey: {
          name: 'VirtueRating_studentId_fkey',
          columns: ['studentId'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'VirtueRating',
        foreignKey: {
          name: 'VirtueRating_virtueId_fkey',
          columns: ['virtueId'],
          references: { schema: 'public', table: 'Virtue', columns: ['id'] },
        },
      }),
      // Runs after every table and constraint exists. No `check`: the Virtue table is created by this same migration,
      // so it is always empty here.
      this.dataTransform(contract, 'seed-virtues', {
        run: () =>
          db.public.Virtue.insert(VIRTUES.map(([slug, name, essence], i) => ({ slug, name, essence, position: i + 1 }))),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
