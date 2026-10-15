import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InternalUser } from './internal-user.entity';
import { Role } from '../access-control/entities/role.entity';
import { InternalUsersService } from './internal-users.service';
import { InternalUsersController } from './internal-users.controller';

@Module({
  imports: [TypeOrmModule.forFeature([InternalUser, Role])],
  controllers: [InternalUsersController],
  providers: [InternalUsersService],
  exports: [InternalUsersService],
})
export class InternalUsersModule {}
