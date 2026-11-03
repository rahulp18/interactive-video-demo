#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/168ba9c94f51d7e93170c602d0fec5ec0911e4457430f1c4194ffa3883e3068c/contract';
import startContract from '../../snapshots/168ba9c94f51d7e93170c602d0fec5ec0911e4457430f1c4194ffa3883e3068c/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/c129e6b1f3dc6c1b918eb02e072acccedf1d21ed78408abb9e39f407592dd898/contract';
import endContract from '../../snapshots/c129e6b1f3dc6c1b918eb02e072acccedf1d21ed78408abb9e39f407592dd898/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'Video',
        column: col('isListed', 'bool', {
          notNull: true,
          default: lit(false),
          codecRef: { codecId: 'pg/bool@1' },
        }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
