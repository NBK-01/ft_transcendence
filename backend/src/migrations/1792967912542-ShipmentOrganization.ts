import { MigrationInterface, QueryRunner } from 'typeorm';

export class ShipmentOrganization1792967912542 implements MigrationInterface {
  name = 'ShipmentOrganization1792967912542';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "shipment" ADD "organization_id" uuid`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_0caf7970956fa855a02864921f" ON "shipment" ("organization_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "shipment" ADD CONSTRAINT "FK_0caf7970956fa855a02864921fa" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "shipment" DROP CONSTRAINT "FK_0caf7970956fa855a02864921fa"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_0caf7970956fa855a02864921f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "shipment" DROP COLUMN "organization_id"`,
    );
  }
}
