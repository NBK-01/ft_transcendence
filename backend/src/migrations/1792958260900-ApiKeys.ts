import { MigrationInterface, QueryRunner } from 'typeorm';

export class ApiKeys1792958260900 implements MigrationInterface {
  name = 'ApiKeys1792958260900';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "api_key" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "name" character varying(100) NOT NULL, "organization_id" uuid NOT NULL, "prefix" character varying(8) NOT NULL, "last4" character varying(4) NOT NULL, "key_hash" character varying(60) NOT NULL, "key_hmac" character varying(64) NOT NULL, "created_by_id" uuid, "last_used_at" TIMESTAMP WITH TIME ZONE, "revoked_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_6bdc1096dfb05acc47cf5eda9f0" UNIQUE ("key_hmac"), CONSTRAINT "PK_b1bd840641b8acbaad89c3d8d11" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_cdc8ac20be728fa17aba467e7e" ON "api_key" ("organization_id", "created_at") `,
    );
    await queryRunner.query(
      `ALTER TABLE "api_key" ADD CONSTRAINT "FK_f8bf75c998e043dc6ad022d28a8" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "api_key" ADD CONSTRAINT "FK_1799b360b8b068fa98feb7bef75" FOREIGN KEY ("created_by_id") REFERENCES "internal_user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "api_key" DROP CONSTRAINT "FK_1799b360b8b068fa98feb7bef75"`,
    );
    await queryRunner.query(
      `ALTER TABLE "api_key" DROP CONSTRAINT "FK_f8bf75c998e043dc6ad022d28a8"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_cdc8ac20be728fa17aba467e7e"`,
    );
    await queryRunner.query(`DROP TABLE "api_key"`);
  }
}
