import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddSettingsTable1713993558783 implements MigrationInterface {
  name = "AddSettingsTable1713993558783";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "settings" (
        "id" SERIAL NOT NULL,
        "minViews" integer NOT NULL DEFAULT '10000',
        "minDuration" integer NOT NULL DEFAULT '30',
        "maxDuration" integer NOT NULL DEFAULT '1200',
        "streamSync" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_0669fe20e252eb692bf4d344975" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "user"
      ADD "settingsId" integer
    `);
    await queryRunner.query(`
      ALTER TABLE "user"
      ADD CONSTRAINT "UQ_390395c3d8592e3e8d8422ce853" UNIQUE ("settingsId")
    `);
    await queryRunner.query(`
      ALTER TABLE "user"
      ADD CONSTRAINT "FK_390395c3d8592e3e8d8422ce853" FOREIGN KEY ("settingsId") REFERENCES "settings"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "user" DROP CONSTRAINT "FK_390395c3d8592e3e8d8422ce853"
    `);
    await queryRunner.query(`
      ALTER TABLE "user" DROP CONSTRAINT "UQ_390395c3d8592e3e8d8422ce853"
    `);
    await queryRunner.query(`
      ALTER TABLE "user" DROP COLUMN "settingsId"
    `);
    await queryRunner.query(`
      DROP TABLE "settings"
    `);
  }
}
