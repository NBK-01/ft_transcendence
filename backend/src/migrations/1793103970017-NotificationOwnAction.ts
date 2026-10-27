import { MigrationInterface, QueryRunner } from 'typeorm';

export class NotificationOwnAction1793103970017 implements MigrationInterface {
  name = 'NotificationOwnAction1793103970017';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "notification" ADD "own_action" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "notification" DROP COLUMN "own_action"`,
    );
  }
}
