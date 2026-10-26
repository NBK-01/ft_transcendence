import { MigrationInterface, QueryRunner } from 'typeorm';

export class WebhookLog1793002142667 implements MigrationInterface {
  name = 'WebhookLog1793002142667';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."webhook_log_provider_enum" AS ENUM('carrier')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."webhook_log_status_enum" AS ENUM('RECEIVED', 'PROCESSING', 'PROCESSED', 'FAILED', 'DUPLICATE')`,
    );
    await queryRunner.query(
      `CREATE TABLE "webhook_log" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "provider" "public"."webhook_log_provider_enum" NOT NULL, "event_type" character varying NOT NULL, "resource_id" character varying, "idempotency_key" character varying, "duplicate_of_id" uuid, "payload" jsonb NOT NULL, "status" "public"."webhook_log_status_enum" NOT NULL DEFAULT 'RECEIVED', "attempts" integer NOT NULL DEFAULT '0', "error_message" text, "processed_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_d1bc4b8563dce654d52f2fd7f55" UNIQUE ("idempotency_key"), CONSTRAINT "PK_5164958b17361a85955a433d958" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_923b9ab6ace9a202cc7a5f9cd7" ON "webhook_log" ("provider", "created_at") `,
    );
    await queryRunner.query(
      `ALTER TABLE "webhook_log" ADD CONSTRAINT "FK_b4b4d23d7c0e22b5f7599963e0d" FOREIGN KEY ("duplicate_of_id") REFERENCES "webhook_log"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "webhook_log" DROP CONSTRAINT "FK_b4b4d23d7c0e22b5f7599963e0d"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_923b9ab6ace9a202cc7a5f9cd7"`,
    );
    await queryRunner.query(`DROP TABLE "webhook_log"`);
    await queryRunner.query(`DROP TYPE "public"."webhook_log_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."webhook_log_provider_enum"`);
  }
}
