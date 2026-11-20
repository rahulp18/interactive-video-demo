#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/51937ca0771907531560fa3c0bb9151b1581de27230b563a0be854de495677bc/contract';
import startContract from '../../snapshots/51937ca0771907531560fa3c0bb9151b1581de27230b563a0be854de495677bc/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/eb150eb2888477c1b3fd9720dd42516664f3e86f581952e84aef3f497de256a5/contract';
import endContract from '../../snapshots/eb150eb2888477c1b3fd9720dd42516664f3e86f581952e84aef3f497de256a5/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit, sql } from '@prisma/orm-postgres/migration';
import postgres from '@prisma/orm-postgres/runtime';
import { contractFromJson } from '@prisma/orm-postgres/static';

// Lazily connecting; only used to build the typed query plans for the data transform below.
const { sql: db, contract } = postgres({ contract: contractFromJson<End>(endContract) });

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'User',
        column: col('role', 'text', {
          notNull: true,
          default: lit('STUDENT'),
          codecRef: { codecId: 'pg/text@1' },
        }),
      }),
      // Every account that exists when this runs predates roles and was made through the teacher-facing app, so it keeps
      // the teacher experience. New registrations get the column default (STUDENT).
      this.dataTransform(contract, 'backfill-user-role-teacher', {
        check: () => db.public.User.select('id').where((f, fns) => fns.eq(f.role, 'STUDENT')).limit(1),
        run: () => db.public.User.update({ role: 'TEACHER' }).where((f, fns) => fns.eq(f.role, 'STUDENT')),
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'User',
        constraint: 'User_role_check_b921956f',
        expression: sql`"role" IN ('STUDENT', 'TEACHER')`,
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
