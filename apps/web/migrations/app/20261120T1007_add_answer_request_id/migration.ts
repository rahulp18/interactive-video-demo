#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/9f1b5d47b7bff2c40e932778a39affe44f4457a63bd7aa9b799dbf75be4caf8d/contract';
import endContract from '../../snapshots/9f1b5d47b7bff2c40e932778a39affe44f4457a63bd7aa9b799dbf75be4caf8d/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/e918ee1aab6a927861624ad49ab995cda83801c669acead563454c3f4678eabe/contract';
import startContract from '../../snapshots/e918ee1aab6a927861624ad49ab995cda83801c669acead563454c3f4678eabe/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'InteractionResponse',
        column: col('lastRequestId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
