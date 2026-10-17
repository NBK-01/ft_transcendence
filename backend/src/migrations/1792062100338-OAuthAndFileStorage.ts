import { MigrationInterface, QueryRunner } from 'typeorm';

export class OAuthAndFileStorage1792062100338 implements MigrationInterface {
  name = 'OAuthAndFileStorage1792062100338';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."auth_provider_user_provider_enum" AS ENUM('email', 'google')`,
    );
    await queryRunner.query(
      `CREATE TABLE "auth_provider_user" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "user_id" uuid NOT NULL, "provider" "public"."auth_provider_user_provider_enum" NOT NULL, "provider_id" character varying NOT NULL, "email" character varying NOT NULL, "name" character varying NOT NULL, "profile_picture" character varying, CONSTRAINT "UQ_f4a3c647030eeea729763acc266" UNIQUE ("provider", "provider_id"), CONSTRAINT "PK_b258701252799b59135e88cc953" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."user_auth_provider_enum" AS ENUM('email', 'google')`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" ADD "auth_provider" "public"."user_auth_provider_enum" NOT NULL DEFAULT 'email'`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" ADD "avatar_url" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" ADD "avatar_key" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" ALTER COLUMN "password" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "auth_provider_user" ADD CONSTRAINT "FK_d8a4c7c6d32402c1492ecd11186" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "auth_provider_user" DROP CONSTRAINT "FK_d8a4c7c6d32402c1492ecd11186"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" ALTER COLUMN "password" SET NOT NULL`,
    );
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "avatar_key"`);
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "avatar_url"`);
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "auth_provider"`);
    await queryRunner.query(`DROP TYPE "public"."user_auth_provider_enum"`);
    await queryRunner.query(`DROP TABLE "auth_provider_user"`);
    await queryRunner.query(
      `DROP TYPE "public"."auth_provider_user_provider_enum"`,
    );
  }
}
