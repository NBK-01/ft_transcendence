import { MigrationInterface, QueryRunner } from 'typeorm';

export class RefreshTokenRedesign1791731183047 implements MigrationInterface {
  name = 'RefreshTokenRedesign1791731183047';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "refresh_token" DROP COLUMN "revoked_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" ADD "force_logout_after" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_token" ADD "device_info" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_token" ADD "ip_address" character varying(45)`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_token" DROP CONSTRAINT "UQ_f0812282fad2e352cdaf83ef0a9"`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_token" DROP COLUMN "token_hash"`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_token" ADD "token_hash" character varying(64) NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_token" ADD CONSTRAINT "UQ_f0812282fad2e352cdaf83ef0a9" UNIQUE ("token_hash")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "refresh_token" DROP CONSTRAINT "UQ_f0812282fad2e352cdaf83ef0a9"`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_token" DROP COLUMN "token_hash"`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_token" ADD "token_hash" character varying NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_token" ADD CONSTRAINT "UQ_f0812282fad2e352cdaf83ef0a9" UNIQUE ("token_hash")`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_token" DROP COLUMN "ip_address"`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_token" DROP COLUMN "device_info"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" DROP COLUMN "force_logout_after"`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_token" ADD "revoked_at" TIMESTAMP WITH TIME ZONE`,
    );
  }
}
