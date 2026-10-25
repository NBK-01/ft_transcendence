import { QueryRunner } from 'typeorm';

/**
 * Holds work until the transaction a write belongs to commits, and drops it
 * if that rolls back, so nobody hears about a write that never happened.
 * Outside a transaction the write has already committed, so the work runs at
 * once. Each subscriber keeps its own list in queryRunner.data, under `key`.
 *
 * If the process dies between the commit and the work, the work is lost
 * (there's no outbox).
 */
export class AfterCommit {
  constructor(private readonly key: string) {}

  /** From afterInsert / afterUpdate. */
  schedule(queryRunner: QueryRunner, work: () => void): void {
    if (!queryRunner.isTransactionActive) {
      work();
      return;
    }
    queryRunner.data[this.key] ??= [];
    (queryRunner.data[this.key] as Array<() => void>).push(work);
  }

  /** From afterTransactionCommit. Releasing a savepoint also "commits": wait for the outer COMMIT. */
  committed(queryRunner: QueryRunner): void {
    if (queryRunner.isTransactionActive) {
      return;
    }
    for (const work of this.take(queryRunner)) {
      work();
    }
  }

  /**
   * From afterTransactionRollback. Drops everything waiting, even after a
   * rollback to a savepoint, which could also drop writes made before it: a
   * missed notification beats one about something that never happened.
   * Nothing nests transactions today.
   */
  rolledBack(queryRunner: QueryRunner): void {
    this.take(queryRunner);
  }

  private take(queryRunner: QueryRunner): Array<() => void> {
    const work = (queryRunner.data[this.key] as Array<() => void>) ?? [];
    delete queryRunner.data[this.key];
    return work;
  }
}
