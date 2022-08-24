import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  PrimaryGeneratedColumn,
  Relation,
  UpdateDateColumn,
} from "typeorm";
import { Channel } from "./Channel";

@Entity()
export class User extends BaseEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  twitch_id!: string;

  @Column()
  username!: string;

  @Column()
  display_name!: string;

  @Column()
  email!: string;

  @Column(() => Channel)
  @JoinColumn()
  channel: Relation<Channel>;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
