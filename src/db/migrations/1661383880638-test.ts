import { MigrationInterface, QueryRunner } from "typeorm";

export class test1661383880638 implements MigrationInterface {
    name = 'test1661383880638'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "channel" ("id" SERIAL NOT NULL, "isEnabled" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_590f33ee6ee7d76437acf362e39" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "user" ADD "channelId" SERIAL NOT NULL`);
        await queryRunner.query(`ALTER TABLE "user" DROP CONSTRAINT "PK_cace4a159ff9f2512dd42373760"`);
        await queryRunner.query(`ALTER TABLE "user" ADD CONSTRAINT "PK_fe52230f2c3184ac491eb94038a" PRIMARY KEY ("id", "channelId")`);
        await queryRunner.query(`ALTER TABLE "user" ADD "channelIsenabled" boolean NOT NULL DEFAULT true`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "channelIsenabled"`);
        await queryRunner.query(`ALTER TABLE "user" DROP CONSTRAINT "PK_fe52230f2c3184ac491eb94038a"`);
        await queryRunner.query(`ALTER TABLE "user" ADD CONSTRAINT "PK_cace4a159ff9f2512dd42373760" PRIMARY KEY ("id")`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "channelId"`);
        await queryRunner.query(`DROP TABLE "channel"`);
    }

}
