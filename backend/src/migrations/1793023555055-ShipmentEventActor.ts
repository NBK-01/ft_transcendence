import { MigrationInterface, QueryRunner } from 'typeorm';

export class ShipmentEventActor1793023555055 implements MigrationInterface {
  name = 'ShipmentEventActor1793023555055';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."shipment_event_actor_type_enum" AS ENUM('customer', 'staff', 'partner', 'carrier')`,
    );
    await queryRunner.query(
      `ALTER TABLE "shipment_event" ADD "actor_type" "public"."shipment_event_actor_type_enum"`,
    );
    await queryRunner.query(`ALTER TABLE "shipment_event" ADD "actor_id" uuid`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "shipment_event" DROP COLUMN "actor_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "shipment_event" DROP COLUMN "actor_type"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."shipment_event_actor_type_enum"`,
    );
  }
}
