#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/5c48ae4887590bab2f26465054b1ddf616d86e8dc66461de4954efcb99c4ab89/contract';
import endContract from '../../snapshots/5c48ae4887590bab2f26465054b1ddf616d86e8dc66461de4954efcb99c4ab89/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/9f1b5d47b7bff2c40e932778a39affe44f4457a63bd7aa9b799dbf75be4caf8d/contract';
import startContract from '../../snapshots/9f1b5d47b7bff2c40e932778a39affe44f4457a63bd7aa9b799dbf75be4caf8d/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, sql } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'User',
        column: col('avatar', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'User',
        constraint: 'user_avatar_format_cc016a5f',
        expression: sql`"avatar" IS NULL OR "avatar" ~ '^[a-z]{3,20}$'`,
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
