import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OtpService } from './otp.service';
import { OtpConfigService } from './config/otp-config.service';
import { OtpLog } from './entities/otp-log.entity';

@Module({
  imports: [TypeOrmModule.forFeature([OtpLog])],
  providers: [OtpService, OtpConfigService],
  exports: [OtpService],
})
export class OtpModule {}
