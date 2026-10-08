import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitAuthUsers1791294788168 implements MigrationInterface {
  name = 'InitAuthUsers1791294788168';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "user" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "email" character varying NOT NULL, "password" character varying NOT NULL, "name" character varying NOT NULL, "is_verified" boolean NOT NULL DEFAULT false, CONSTRAINT "UQ_e12875dfb3b1d92d7d7c5377e22" UNIQUE ("email"), CONSTRAINT "PK_cace4a159ff9f2512dd42373760" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."otp_log_channel_enum" AS ENUM('EMAIL')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."otp_log_purpose_enum" AS ENUM('ACCOUNT_VERIFICATION', 'PASSWORD_RESET')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."otp_log_status_enum" AS ENUM('SENT', 'VERIFIED', 'FAILED', 'EXPIRED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "otp_log" ("id" SERIAL NOT NULL, "user_id" uuid, "identifier" character varying(255) NOT NULL, "channel" "public"."otp_log_channel_enum" NOT NULL DEFAULT 'EMAIL', "purpose" "public"."otp_log_purpose_enum" NOT NULL, "status" "public"."otp_log_status_enum" NOT NULL DEFAULT 'SENT', "attempts" integer NOT NULL DEFAULT '0', "sent_at" TIMESTAMP NOT NULL DEFAULT now(), "verified_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_6c1a24062e2edc3733bdefb2fb5" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "refresh_token" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "user_id" uuid NOT NULL, "token_hash" character varying NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "revoked_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_f0812282fad2e352cdaf83ef0a9" UNIQUE ("token_hash"), CONSTRAINT "PK_b575dd3c21fb0831013c909e7fe" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_6bbe63d2fe75e7f0ba1710351d" ON "refresh_token" ("user_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "otp_log" ADD CONSTRAINT "FK_8a75c0c175d7f2b54f6313c691d" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "otp_log" DROP CONSTRAINT "FK_8a75c0c175d7f2b54f6313c691d"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_6bbe63d2fe75e7f0ba1710351d"`,
    );
    await queryRunner.query(`DROP TABLE "refresh_token"`);
    await queryRunner.query(`DROP TABLE "otp_log"`);
    await queryRunner.query(`DROP TYPE "public"."otp_log_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."otp_log_purpose_enum"`);
    await queryRunner.query(`DROP TYPE "public"."otp_log_channel_enum"`);
    await queryRunner.query(`DROP TABLE "user"`);
  }
}
