import { BaseEntity, Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity()
export class Settings extends BaseEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column("int", { default: 10_000 })
  minViews: number;

  @Column("int", { default: 30 })
  minDuration: number;

  @Column("int", { default: 1_200 })
  maxDuration: number;

  @Column("bool", { default: false })
  streamSync: boolean;
}
