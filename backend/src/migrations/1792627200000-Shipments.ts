import { MigrationInterface, QueryRunner } from 'typeorm';

export class Shipments1792627200000 implements MigrationInterface {
  name = 'Shipments1792627200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."shipment_status_enum" AS ENUM('pending_sourcing', 'pending_client_decision', 'pending_payment', 'pending_payment_confirmation', 'requested', 'confirmed', 'in_transit', 'out_for_delivery', 'delivered', 'cancelled')`,
    );
    await queryRunner.query(
      `CREATE TABLE "shipment" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "tracking_id" character varying NOT NULL, "client_id" uuid NOT NULL, "status" "public"."shipment_status_enum" NOT NULL DEFAULT 'pending_sourcing', "product_url" character varying, "origin" character varying, "destination" character varying, "sender" jsonb, "recipient" jsonb, "weight_kg" numeric(10,2), CONSTRAINT "UQ_35c8d5bf53caa19c94348f9858e" UNIQUE ("tracking_id"), CONSTRAINT "PK_f51f635db95c534ca206bf7a0a4" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_9343490f90b6eebad1a94db8f4" ON "shipment" ("client_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "shipment_offer" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "shipment_id" uuid NOT NULL, "supplier_name" character varying NOT NULL, "unit_price_amount" numeric(12,2) NOT NULL, "currency" character varying(3) NOT NULL, "note" text, "rejected_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_d228f19bb06a7306c7f5bca0743" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_75fef96d0194ad1218dc81b1f9" ON "shipment_offer" ("shipment_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."shipment_file_kind_enum" AS ENUM('request_photo', 'offer_photo', 'package_photo', 'proof_of_delivery', 'other')`,
    );
    await queryRunner.query(
      `CREATE TABLE "shipment_file" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "shipment_id" uuid NOT NULL, "offer_id" uuid, "kind" "public"."shipment_file_kind_enum" NOT NULL, "storage_key" character varying NOT NULL, "name" character varying NOT NULL, "mime_type" character varying NOT NULL, "size_bytes" integer NOT NULL, CONSTRAINT "PK_814348d1b62341e18566bc87f11" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_53cdb8fa7b05627ae8f4799e87" ON "shipment_file" ("shipment_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."shipment_event_status_enum" AS ENUM('pending_sourcing', 'pending_client_decision', 'pending_payment', 'pending_payment_confirmation', 'requested', 'confirmed', 'in_transit', 'out_for_delivery', 'delivered', 'cancelled')`,
    );
    await queryRunner.query(
      `CREATE TABLE "shipment_event" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "shipment_id" uuid NOT NULL, "status" "public"."shipment_event_status_enum" NOT NULL, "location" character varying NOT NULL, CONSTRAINT "PK_225d54792e24adfffdb489fba36" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_09bd592bb708ffa4b44074aa28" ON "shipment_event" ("shipment_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "shipment_payment" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "shipment_id" uuid NOT NULL, "quantity" integer NOT NULL, "total_amount" numeric(12,2) NOT NULL, "currency" character varying(3) NOT NULL, "card_holder_name" character varying NOT NULL, "card_last4" character varying(4) NOT NULL, CONSTRAINT "REL_033e91da187f63c4d41010a007" UNIQUE ("shipment_id"), CONSTRAINT "PK_201db3dfbd1768dd1a3a6ef21d9" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "shipment" ADD CONSTRAINT "FK_9343490f90b6eebad1a94db8f42" FOREIGN KEY ("client_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "shipment_offer" ADD CONSTRAINT "FK_75fef96d0194ad1218dc81b1f9e" FOREIGN KEY ("shipment_id") REFERENCES "shipment"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "shipment_file" ADD CONSTRAINT "FK_53cdb8fa7b05627ae8f4799e87f" FOREIGN KEY ("shipment_id") REFERENCES "shipment"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "shipment_file" ADD CONSTRAINT "FK_f9a2e92584ab501f5b5c3223a06" FOREIGN KEY ("offer_id") REFERENCES "shipment_offer"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "shipment_event" ADD CONSTRAINT "FK_09bd592bb708ffa4b44074aa281" FOREIGN KEY ("shipment_id") REFERENCES "shipment"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "shipment_payment" ADD CONSTRAINT "FK_033e91da187f63c4d41010a007d" FOREIGN KEY ("shipment_id") REFERENCES "shipment"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "shipment_payment" DROP CONSTRAINT "FK_033e91da187f63c4d41010a007d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "shipment_event" DROP CONSTRAINT "FK_09bd592bb708ffa4b44074aa281"`,
    );
    await queryRunner.query(
      `ALTER TABLE "shipment_file" DROP CONSTRAINT "FK_f9a2e92584ab501f5b5c3223a06"`,
    );
    await queryRunner.query(
      `ALTER TABLE "shipment_file" DROP CONSTRAINT "FK_53cdb8fa7b05627ae8f4799e87f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "shipment_offer" DROP CONSTRAINT "FK_75fef96d0194ad1218dc81b1f9e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "shipment" DROP CONSTRAINT "FK_9343490f90b6eebad1a94db8f42"`,
    );
    await queryRunner.query(`DROP TABLE "shipment_payment"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_09bd592bb708ffa4b44074aa28"`,
    );
    await queryRunner.query(`DROP TABLE "shipment_event"`);
    await queryRunner.query(`DROP TYPE "public"."shipment_event_status_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_53cdb8fa7b05627ae8f4799e87"`,
    );
    await queryRunner.query(`DROP TABLE "shipment_file"`);
    await queryRunner.query(`DROP TYPE "public"."shipment_file_kind_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_75fef96d0194ad1218dc81b1f9"`,
    );
    await queryRunner.query(`DROP TABLE "shipment_offer"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_9343490f90b6eebad1a94db8f4"`,
    );
    await queryRunner.query(`DROP TABLE "shipment"`);
    await queryRunner.query(`DROP TYPE "public"."shipment_status_enum"`);
  }
}
