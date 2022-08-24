import { BaseEntity, Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

@Entity()
export class Channel extends BaseEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column("boolean", { default: true })
  isEnabled: boolean;
}
