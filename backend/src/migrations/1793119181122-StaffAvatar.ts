import { MigrationInterface, QueryRunner } from 'typeorm';

export class StaffAvatar1793119181122 implements MigrationInterface {
  name = 'StaffAvatar1793119181122';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "internal_user" ADD "avatar_key" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "internal_user" DROP COLUMN "avatar_key"`,
    );
  }
}
