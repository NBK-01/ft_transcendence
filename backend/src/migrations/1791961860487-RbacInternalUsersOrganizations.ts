import { MigrationInterface, QueryRunner } from 'typeorm';

export class RbacInternalUsersOrganizations1791961860487 implements MigrationInterface {
  name = 'RbacInternalUsersOrganizations1791961860487';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "organization" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "name" character varying NOT NULL, "description" character varying, "contact_email" character varying, "is_active" boolean NOT NULL DEFAULT true, CONSTRAINT "UQ_c21e615583a3ebbb0977452afb0" UNIQUE ("name"), CONSTRAINT "PK_472c1f99a32def1b0abb219cd67" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "role" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "name" character varying NOT NULL, "description" character varying, CONSTRAINT "UQ_ae4578dcaed5adff96595e61660" UNIQUE ("name"), CONSTRAINT "PK_b36bcfe02fc8de3c57a8b2391c2" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "internal_user" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "email" character varying NOT NULL, "password" character varying NOT NULL, "name" character varying NOT NULL, "is_active" boolean NOT NULL DEFAULT true, "role_id" uuid, "organization_id" uuid, "force_logout_after" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_f218c2ea078a637699d4d492693" UNIQUE ("email"), CONSTRAINT "PK_6363e7e769284a0fe407d9a3109" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "internal_refresh_token" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "user_id" uuid NOT NULL, "token_hash" character varying(64) NOT NULL, "device_info" character varying, "ip_address" character varying(45), "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "UQ_2997858c57f8d984687ded26996" UNIQUE ("token_hash"), CONSTRAINT "PK_51e37698a914eee12444568d438" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_b9aa763691fdd133ece202595c" ON "internal_refresh_token" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "permission" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "name" character varying NOT NULL, "description" character varying, CONSTRAINT "UQ_240853a0c3353c25fb12434ad33" UNIQUE ("name"), CONSTRAINT "PK_3b8b97af9d9d8807e41e6f48362" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "role_permission" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "role_id" uuid NOT NULL, "permission_id" uuid NOT NULL, CONSTRAINT "UQ_19a94c31d4960ded0dcd0397759" UNIQUE ("role_id", "permission_id"), CONSTRAINT "PK_96c8f1fd25538d3692024115b47" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "internal_user" ADD CONSTRAINT "FK_a8ff9abd79e828b49007dec3dce" FOREIGN KEY ("role_id") REFERENCES "role"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "internal_user" ADD CONSTRAINT "FK_87c2e5aea2c0a5f064797d924f7" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "role_permission" ADD CONSTRAINT "FK_3d0a7155eafd75ddba5a7013368" FOREIGN KEY ("role_id") REFERENCES "role"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "role_permission" ADD CONSTRAINT "FK_e3a3ba47b7ca00fd23be4ebd6cf" FOREIGN KEY ("permission_id") REFERENCES "permission"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    // Seed data — matches src/access-control/seed-data/rbac-seed-data.ts exactly.
    // "customer" is intentionally not a role: customers are a structurally separate
    // table (user) with no role at all.
    await queryRunner.query(`
            INSERT INTO "role" ("name", "description") VALUES
                ('admin', 'Full access, including organization and staff management'),
                ('dispatcher', 'Creates and manages shipments within their organization'),
                ('driver', 'Handles shipments assigned directly to them'),
                ('support', 'Read-only access across organizations and shipments')
        `);

    await queryRunner.query(`
            INSERT INTO "permission" ("name", "description") VALUES
                ('organizations:manage', 'Create, update, deactivate organizations and manage staff membership'),
                ('organizations:read', 'View organizations and their staff'),
                ('shipments:create', 'Create a new shipment'),
                ('shipments:read:own', 'Read shipments assigned directly to the caller'),
                ('shipments:read:org', 'Read shipments within the caller''s organization'),
                ('shipments:read:all', 'Read any shipment, any organization'),
                ('shipments:update:own', 'Update shipments assigned directly to the caller'),
                ('shipments:update:org', 'Update shipments within the caller''s organization'),
                ('shipments:assign', 'Assign a shipment to a driver'),
                ('shipments:cancel', 'Cancel a shipment')
        `);

    const rolePermissionMatrix: [string, string][] = [
      ['admin', 'organizations:manage'],
      ['admin', 'organizations:read'],
      ['admin', 'shipments:read:all'],
      ['admin', 'shipments:create'],
      ['admin', 'shipments:update:org'],
      ['admin', 'shipments:assign'],
      ['admin', 'shipments:cancel'],
      ['dispatcher', 'organizations:read'],
      ['dispatcher', 'shipments:create'],
      ['dispatcher', 'shipments:read:org'],
      ['dispatcher', 'shipments:update:org'],
      ['dispatcher', 'shipments:assign'],
      ['driver', 'organizations:read'],
      ['driver', 'shipments:read:own'],
      ['driver', 'shipments:update:own'],
      ['support', 'organizations:read'],
      ['support', 'shipments:read:all'],
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
    await queryRunner.query(
      `ALTER TABLE "role_permission" DROP CONSTRAINT "FK_e3a3ba47b7ca00fd23be4ebd6cf"`,
    );
    await queryRunner.query(
      `ALTER TABLE "role_permission" DROP CONSTRAINT "FK_3d0a7155eafd75ddba5a7013368"`,
    );
    await queryRunner.query(
      `ALTER TABLE "internal_user" DROP CONSTRAINT "FK_87c2e5aea2c0a5f064797d924f7"`,
    );
    await queryRunner.query(
      `ALTER TABLE "internal_user" DROP CONSTRAINT "FK_a8ff9abd79e828b49007dec3dce"`,
    );
    await queryRunner.query(`DROP TABLE "role_permission"`);
    await queryRunner.query(`DROP TABLE "permission"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_b9aa763691fdd133ece202595c"`,
    );
    await queryRunner.query(`DROP TABLE "internal_refresh_token"`);
    await queryRunner.query(`DROP TABLE "internal_user"`);
    await queryRunner.query(`DROP TABLE "role"`);
    await queryRunner.query(`DROP TABLE "organization"`);
  }
}
