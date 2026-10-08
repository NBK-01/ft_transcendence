import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { User } from '../../users/user.entity';

export enum OtpChannel {
  EMAIL = 'EMAIL',
}

export enum OtpPurpose {
  ACCOUNT_VERIFICATION = 'ACCOUNT_VERIFICATION',
  PASSWORD_RESET = 'PASSWORD_RESET',
}

export enum OtpStatus {
  SENT = 'SENT',
  VERIFIED = 'VERIFIED',
  FAILED = 'FAILED',
  EXPIRED = 'EXPIRED',
}

/** Audit log — the actual verification state machine lives in Redis (OtpChallenge), see otp.service.ts. */
@Entity('otp_log')
export class OtpLog {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId!: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'user_id' })
  user!: User | null;

  @Column({ length: 255 })
  identifier!: string;

  @Column({ type: 'enum', enum: OtpChannel, default: OtpChannel.EMAIL })
  channel!: OtpChannel;

  @Column({ type: 'enum', enum: OtpPurpose })
  purpose!: OtpPurpose;

  @Column({ type: 'enum', enum: OtpStatus, default: OtpStatus.SENT })
  status!: OtpStatus;

  @Column({ type: 'int', default: 0 })
  attempts!: number;

  @CreateDateColumn({ name: 'sent_at' })
  sentAt!: Date;

  @Column({ name: 'verified_at', type: 'timestamptz', nullable: true })
  verifiedAt!: Date | null;
}
