import { MigrationInterface, QueryRunner } from 'typeorm';

export class ContactsAndChat1792405785426 implements MigrationInterface {
  name = 'ContactsAndChat1792405785426';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."contact_status_enum" AS ENUM('pending', 'accepted', 'blocked')`,
    );
    await queryRunner.query(
      `CREATE TABLE "contact" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "requester_id" uuid NOT NULL, "addressee_id" uuid NOT NULL, "status" "public"."contact_status_enum" NOT NULL DEFAULT 'pending', CONSTRAINT "UQ_a639be95bbfb10accf90ad8b0a5" UNIQUE ("requester_id", "addressee_id"), CONSTRAINT "PK_2cbbe00f59ab6b3bb5b8d19f989" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."conversation_type_enum" AS ENUM('staff_dm', 'support')`,
    );
    await queryRunner.query(
      `CREATE TABLE "conversation" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "type" "public"."conversation_type_enum" NOT NULL, "customer_id" uuid, "participant_a_id" uuid, "participant_b_id" uuid, CONSTRAINT "UQ_8cb887e01c7aa9c10555da04aff" UNIQUE ("customer_id"), CONSTRAINT "UQ_9bab0d458696c4697ac2ae447d2" UNIQUE ("participant_a_id", "participant_b_id"), CONSTRAINT "PK_864528ec4274360a40f66c29845" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."message_sender_type_enum" AS ENUM('customer', 'staff')`,
    );
    await queryRunner.query(
      `CREATE TABLE "message" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "conversation_id" uuid NOT NULL, "sender_id" uuid NOT NULL, "sender_type" "public"."message_sender_type_enum" NOT NULL, "content" text NOT NULL, CONSTRAINT "PK_ba01f0a3e0123651915008bc578" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_7fe3e887d78498d9c9813375ce" ON "message" ("conversation_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."conversation_participant_participant_type_enum" AS ENUM('customer', 'staff')`,
    );
    await queryRunner.query(
      `CREATE TABLE "conversation_participant" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "conversation_id" uuid NOT NULL, "participant_id" uuid NOT NULL, "participant_type" "public"."conversation_participant_participant_type_enum" NOT NULL, "last_read_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_f610928afdc50a27c75985e2935" UNIQUE ("conversation_id", "participant_id", "participant_type"), CONSTRAINT "PK_326cbb9ee8891f8e29157bda911" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "contact" ADD CONSTRAINT "FK_c8b2537305d4133341ce1a07bff" FOREIGN KEY ("requester_id") REFERENCES "internal_user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "contact" ADD CONSTRAINT "FK_0b61785a5e29bb9d204c3f7ed3f" FOREIGN KEY ("addressee_id") REFERENCES "internal_user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "message" ADD CONSTRAINT "FK_7fe3e887d78498d9c9813375ce2" FOREIGN KEY ("conversation_id") REFERENCES "conversation"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "conversation_participant" ADD CONSTRAINT "FK_f6f41e6c7af3a1ffaab8787c2b7" FOREIGN KEY ("conversation_id") REFERENCES "conversation"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    // Seed data — matches src/access-control/seed-data/rbac-seed-data.ts exactly.
    await queryRunner.query(`
            INSERT INTO "permission" ("name", "description") VALUES
                ('chat:support:access', 'View and reply to any customer support conversation')
        `);

    const rolePermissionMatrix: [string, string][] = [
      ['admin', 'chat:support:access'],
      ['support', 'chat:support:access'],
    ];

    for (const [roleName, permissionName] of rolePermissionMatrix) {
      await queryRunner.query(
        `INSERT INTO "role_permission" ("role_id", "permission_id")
                 SELECT r.id, p.id FROM "role" r, "permission" p
                 WHERE r.name = $1 AND p.name = $2`,
        [roleName, permissionName],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            DELETE FROM "role_permission" WHERE "permission_id" = (
                SELECT id FROM "permission" WHERE name = 'chat:support:access'
            )
        `);
    await queryRunner.query(
      `DELETE FROM "permission" WHERE name = 'chat:support:access'`,
    );

    await queryRunner.query(
      `ALTER TABLE "conversation_participant" DROP CONSTRAINT "FK_f6f41e6c7af3a1ffaab8787c2b7"`,
    );
    await queryRunner.query(
      `ALTER TABLE "message" DROP CONSTRAINT "FK_7fe3e887d78498d9c9813375ce2"`,
    );
    await queryRunner.query(
      `ALTER TABLE "contact" DROP CONSTRAINT "FK_0b61785a5e29bb9d204c3f7ed3f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "contact" DROP CONSTRAINT "FK_c8b2537305d4133341ce1a07bff"`,
    );
    await queryRunner.query(`DROP TABLE "conversation_participant"`);
    await queryRunner.query(
      `DROP TYPE "public"."conversation_participant_participant_type_enum"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_7fe3e887d78498d9c9813375ce"`,
    );
    await queryRunner.query(`DROP TABLE "message"`);
    await queryRunner.query(`DROP TYPE "public"."message_sender_type_enum"`);
    await queryRunner.query(`DROP TABLE "conversation"`);
    await queryRunner.query(`DROP TYPE "public"."conversation_type_enum"`);
    await queryRunner.query(`DROP TABLE "contact"`);
    await queryRunner.query(`DROP TYPE "public"."contact_status_enum"`);
  }
}
