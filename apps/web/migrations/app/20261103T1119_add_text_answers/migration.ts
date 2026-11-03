#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/51937ca0771907531560fa3c0bb9151b1581de27230b563a0be854de495677bc/contract';
import endContract from '../../snapshots/51937ca0771907531560fa3c0bb9151b1581de27230b563a0be854de495677bc/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/c129e6b1f3dc6c1b918eb02e072acccedf1d21ed78408abb9e39f407592dd898/contract';
import startContract from '../../snapshots/c129e6b1f3dc6c1b918eb02e072acccedf1d21ed78408abb9e39f407592dd898/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit, sql } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropCheckConstraint({
        schema: 'public',
        table: 'InteractionResponse',
        constraint: 'response_skipped_matches_option_164369b0',
      }),
      this.addColumn({
        schema: 'public',
        table: 'Interaction',
        column: col('answerType', 'text', {
          notNull: true,
          default: lit('CHOICE'),
          codecRef: { codecId: 'pg/text@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'Interaction',
        column: col('correctAnswer', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'InteractionResponse',
        column: col('textAnswer', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'Interaction',
        constraint: 'Interaction_answerType_check_4990b0fe',
        expression: sql`"answerType" IN ('CHOICE', 'TEXT')`,
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'InteractionResponse',
        constraint: 'response_single_answer_kind_2713192d',
        expression: sql`NOT ("selectedOptionId" IS NOT NULL AND "textAnswer" IS NOT NULL)`,
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'InteractionResponse',
        constraint: 'response_skipped_matches_answer_1f9f2417',
        expression: sql`"isSkipped" = ("selectedOptionId" IS NULL AND "textAnswer" IS NULL)`,
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
