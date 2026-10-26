import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserProfileFields1792800000000 implements MigrationInterface {
  name = 'AddUserProfileFields1792800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" ADD "first_name" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" ADD "last_name" character varying`,
    );
    await queryRunner.query(`ALTER TABLE "user" ADD "date_of_birth" date`);
    await queryRunner.query(
      `ALTER TABLE "user" ADD "phone_number" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "phone_number"`);
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "date_of_birth"`);
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "last_name"`);
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "first_name"`);
  }
}
