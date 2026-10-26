import { MigrationInterface, QueryRunner } from 'typeorm';

export class NotificationApiKeyTypes1793000076815 implements MigrationInterface {
  name = 'NotificationApiKeyTypes1793000076815';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."notification_type_enum" RENAME TO "notification_type_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."notification_type_enum" AS ENUM('SHIPMENT_UPDATE', 'BRANCH_CREATED', 'BRANCH_UPDATED', 'BRANCH_DEACTIVATED', 'BRANCH_STAFF_ADDED', 'BRANCH_STAFF_REMOVED', 'STAFF_ACCOUNT_CREATED', 'STAFF_ACCOUNT_UPDATED', 'STAFF_ACCOUNT_DEACTIVATED', 'CONTACT_REQUEST_RECEIVED', 'CONTACT_REQUEST_ACCEPTED', 'SUPPORT_CONVERSATION_STARTED', 'SHIPMENT_FILE_ADDED', 'PASSWORD_CHANGED', 'API_KEY_CREATED', 'API_KEY_REVOKED')`,
    );
    await queryRunner.query(
      `ALTER TABLE "notification" ALTER COLUMN "type" TYPE "public"."notification_type_enum" USING "type"::"text"::"public"."notification_type_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."notification_type_enum_old"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."notification_type_enum_old" AS ENUM('SHIPMENT_UPDATE', 'BRANCH_CREATED', 'BRANCH_UPDATED', 'BRANCH_DEACTIVATED', 'BRANCH_STAFF_ADDED', 'BRANCH_STAFF_REMOVED', 'STAFF_ACCOUNT_CREATED', 'STAFF_ACCOUNT_UPDATED', 'STAFF_ACCOUNT_DEACTIVATED', 'CONTACT_REQUEST_RECEIVED', 'CONTACT_REQUEST_ACCEPTED', 'SUPPORT_CONVERSATION_STARTED', 'SHIPMENT_FILE_ADDED', 'PASSWORD_CHANGED')`,
    );
    await queryRunner.query(
      `ALTER TABLE "notification" ALTER COLUMN "type" TYPE "public"."notification_type_enum_old" USING "type"::"text"::"public"."notification_type_enum_old"`,
    );
    await queryRunner.query(`DROP TYPE "public"."notification_type_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."notification_type_enum_old" RENAME TO "notification_type_enum"`,
    );
  }
}
