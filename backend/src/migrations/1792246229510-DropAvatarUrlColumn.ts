import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropAvatarUrlColumn1792246229510 implements MigrationInterface {
  name = 'DropAvatarUrlColumn1792246229510';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "avatar_url"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" ADD "avatar_url" character varying`,
    );
  }
}
