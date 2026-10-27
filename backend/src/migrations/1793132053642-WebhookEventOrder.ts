import { MigrationInterface, QueryRunner } from 'typeorm';

export class WebhookEventOrder1793132053642 implements MigrationInterface {
  name = 'WebhookEventOrder1793132053642';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "webhook_log" ADD "occurred_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "webhook_log" ADD "claimed_by" character varying`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."webhook_log_status_enum" RENAME TO "webhook_log_status_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."webhook_log_status_enum" AS ENUM('RECEIVED', 'PROCESSING', 'PROCESSED', 'SUPERSEDED', 'FAILED', 'DUPLICATE')`,
    );
    await queryRunner.query(
      `ALTER TABLE "webhook_log" ALTER COLUMN "status" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "webhook_log" ALTER COLUMN "status" TYPE "public"."webhook_log_status_enum" USING "status"::"text"::"public"."webhook_log_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "webhook_log" ALTER COLUMN "status" SET DEFAULT 'RECEIVED'`,
    );
    await queryRunner.query(`DROP TYPE "public"."webhook_log_status_enum_old"`);
    await queryRunner.query(
      `CREATE INDEX "IDX_0e9294b50c02b55b54ee3b8c82" ON "webhook_log" ("provider", "resource_id") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_0e9294b50c02b55b54ee3b8c82"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."webhook_log_status_enum_old" AS ENUM('RECEIVED', 'PROCESSING', 'PROCESSED', 'FAILED', 'DUPLICATE')`,
    );
    await queryRunner.query(
      `ALTER TABLE "webhook_log" ALTER COLUMN "status" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "webhook_log" ALTER COLUMN "status" TYPE "public"."webhook_log_status_enum_old" USING "status"::"text"::"public"."webhook_log_status_enum_old"`,
    );
    await queryRunner.query(
      `ALTER TABLE "webhook_log" ALTER COLUMN "status" SET DEFAULT 'RECEIVED'`,
    );
    await queryRunner.query(`DROP TYPE "public"."webhook_log_status_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."webhook_log_status_enum_old" RENAME TO "webhook_log_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "webhook_log" DROP COLUMN "claimed_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE "webhook_log" DROP COLUMN "occurred_at"`,
    );
  }
}
