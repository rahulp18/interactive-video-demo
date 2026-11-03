#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/168ba9c94f51d7e93170c602d0fec5ec0911e4457430f1c4194ffa3883e3068c/contract';
import endContract from '../../snapshots/168ba9c94f51d7e93170c602d0fec5ec0911e4457430f1c4194ffa3883e3068c/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/26f8069f376384678d8ed024a4a9110cc30b7b4ee418f74d7249c156980e870a/contract';
import startContract from '../../snapshots/26f8069f376384678d8ed024a4a9110cc30b7b4ee418f74d7249c156980e870a/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'Video',
        column: col('shareId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addUnique({
        schema: 'public',
        table: 'Video',
        constraint: 'Video_shareId_key',
        columns: ['shareId'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
