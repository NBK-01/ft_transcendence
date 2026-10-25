import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserIsActive1792713600000 implements MigrationInterface {
  name = 'AddUserIsActive1792713600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" ADD "is_active" boolean NOT NULL DEFAULT true`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "is_active"`);
  }
}
