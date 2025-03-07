import type { MigrationInterface, QueryRunner } from "typeorm";

export class InsertSettingsForUsers1713994509519 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const users = await queryRunner.query(`SELECT * FROM "user"`);

    for (const user of users) {
      const settings = await queryRunner.query(
        `INSERT INTO "settings" ("minViews", "minDuration", "maxDuration", "streamSync") VALUES (10000, 30, 1200, false) RETURNING "id"`
      );

      await queryRunner.query(`UPDATE "user" SET "settingsId" = ${settings[0].id} WHERE "id" = ${user.id}`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`UPDATE "user" SET "settingsId" = NULL`);
    await queryRunner.query(`DELETE FROM "settings"`);
  }
}
