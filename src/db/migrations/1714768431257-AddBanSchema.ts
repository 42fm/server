import { MigrationInterface, QueryRunner } from "typeorm";

export class AddBanSchema1714768431257 implements MigrationInterface {
  name = "AddBanSchema1714768431257";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "ban" (
        "id" SERIAL NOT NULL,
        "channel_twitch_id" character varying NOT NULL,
        "user_twitch_id" character varying NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_071cddb7d5f18439fd992490618" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_7541ee602bc337cf46be95833e" ON "ban" ("channel_twitch_id", "user_twitch_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX "public"."IDX_7541ee602bc337cf46be95833e"
    `);
    await queryRunner.query(`
      DROP TABLE "ban"
    `);
  }
}
