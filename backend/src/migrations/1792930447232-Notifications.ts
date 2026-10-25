import { MigrationInterface, QueryRunner } from 'typeorm';

export class Notifications1792930447232 implements MigrationInterface {
  name = 'Notifications1792930447232';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."notification_account_type_enum" AS ENUM('customer', 'staff')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."notification_type_enum" AS ENUM('SHIPMENT_UPDATE')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."notification_status_enum" AS ENUM('PENDING', 'SENT', 'FAILED', 'READ')`,
    );
    await queryRunner.query(
      `CREATE TABLE "notification" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "user_id" uuid NOT NULL, "account_type" "public"."notification_account_type_enum" NOT NULL, "type" "public"."notification_type_enum" NOT NULL, "title" character varying NOT NULL, "message" text NOT NULL, "payload" jsonb NOT NULL, "status" "public"."notification_status_enum" NOT NULL DEFAULT 'PENDING', "sent_at" TIMESTAMP WITH TIME ZONE, "read_at" TIMESTAMP WITH TIME ZONE, "dismissed_at" TIMESTAMP WITH TIME ZONE, "dedupe_key" character varying NOT NULL, CONSTRAINT "UQ_b390c6bcca8179ba55a6eb95fac" UNIQUE ("dedupe_key"), CONSTRAINT "PK_705b6c7cdf9b2c2ff7ac7872cb7" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_4d7855bb46aa7d03287f9ee2b2" ON "notification" ("user_id", "status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_73bfce92922b5fdb3c378fc8b9" ON "notification" ("user_id", "created_at") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_73bfce92922b5fdb3c378fc8b9"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_4d7855bb46aa7d03287f9ee2b2"`,
    );
    await queryRunner.query(`DROP TABLE "notification"`);
    await queryRunner.query(`DROP TYPE "public"."notification_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."notification_type_enum"`);
    await queryRunner.query(
      `DROP TYPE "public"."notification_account_type_enum"`,
    );
  }
}
