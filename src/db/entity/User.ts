import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { Channel } from "./Channel.js";
import { Settings } from "./Settings.js";

@Entity()
export class User extends BaseEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true })
  twitch_id!: string;

  @Column()
  username!: string;

  @Column()
  display_name!: string;

  @Column()
  email!: string;

  @Column(() => Channel)
  @JoinColumn()
  channel!: Channel;

  @OneToOne(() => Settings)
  @JoinColumn()
  settings!: Settings;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
