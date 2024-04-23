import { MigrationInterface, QueryRunner } from "typeorm";

export class Init1661383880638 implements MigrationInterface {
    name = 'Init1661383880638'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "channel" ("id" SERIAL NOT NULL, "isEnabled" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_590f33ee6ee7d76437acf362e39" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "user" ("id" SERIAL NOT NULL, "twitch_id" character varying NOT NULL, "username" character varying NOT NULL, "display_name" character varying NOT NULL, "email" character varying NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "channelId" SERIAL NOT NULL, "channelIsenabled" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_fe52230f2c3184ac491eb94038a" PRIMARY KEY ("id", "channelId"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "user"`);
        await queryRunner.query(`DROP TABLE "channel"`);
    }

}
