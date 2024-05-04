import { BaseEntity, Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

@Entity()
@Index(["channel_twitch_id", "user_twitch_id"], { unique: true })
export class Ban extends BaseEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  channel_twitch_id!: string;

  @Column()
  user_twitch_id!: string;

  @CreateDateColumn()
  created_at!: Date;
}
