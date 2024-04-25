import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUniqueConstraintToTwitchId1713998180497 implements MigrationInterface {
  name = "AddUniqueConstraintToTwitchId1713998180497";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "user"
      ADD CONSTRAINT "UQ_2589d4895dc2cf95ab12a3470cf" UNIQUE ("twitch_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "user" DROP CONSTRAINT "UQ_2589d4895dc2cf95ab12a3470cf"
    `);
  }
}
