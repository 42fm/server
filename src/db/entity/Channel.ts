import { BaseEntity, Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity()
export class Channel extends BaseEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column("boolean", { default: true })
  isEnabled: boolean;
}
