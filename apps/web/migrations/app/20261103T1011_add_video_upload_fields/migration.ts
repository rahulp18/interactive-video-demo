#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/26f8069f376384678d8ed024a4a9110cc30b7b4ee418f74d7249c156980e870a/contract';
import endContract from '../../snapshots/26f8069f376384678d8ed024a4a9110cc30b7b4ee418f74d7249c156980e870a/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/4c71d80bc0ba558c1f7fcf20048a9ac9bb90ee487b38816710065ea0547abb46/contract';
import startContract from '../../snapshots/4c71d80bc0ba558c1f7fcf20048a9ac9bb90ee487b38816710065ea0547abb46/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, sql } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addRequiredColumnToEmptyTable({
        schema: 'public',
        table: 'Video',
        column: 'fileKey',
        type: 'text',
      }),
      this.addColumnWithTemporaryDefault({
        schema: 'public',
        table: 'Video',
        column: 'originalName',
        type: 'text',
        temporaryDefault: sql`''`,
      }),
      this.addColumnWithTemporaryDefault({
        schema: 'public',
        table: 'Video',
        column: 'sizeBytes',
        type: 'int4',
        temporaryDefault: sql`0`,
      }),
      this.addRequiredColumnToEmptyTable({
        schema: 'public',
        table: 'Video',
        column: 'uploaderId',
        type: 'int4',
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'Video',
        constraint: 'video_size_nonneg_cff0c8d9',
        expression: sql`"sizeBytes" >= 0`,
      }),
      this.addUnique({
        schema: 'public',
        table: 'Video',
        constraint: 'Video_fileKey_key',
        columns: ['fileKey'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Video',
        index: 'Video_uploaderId_idx_debae170',
        columns: ['uploaderId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Video',
        foreignKey: {
          name: 'Video_uploaderId_fkey',
          columns: ['uploaderId'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
