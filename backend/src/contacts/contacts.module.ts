import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContactsService } from './contacts.service';
import { ContactsController } from './contacts.controller';
import { Contact } from './contact.entity';
import { InternalUsersModule } from '../internal-users/internal-users.module';
import { AccessControlModule } from '../access-control/access-control.module';
import { PresenceModule } from '../chat/presence.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Contact]),
    InternalUsersModule,
    PresenceModule,
    AccessControlModule,
  ],
  controllers: [ContactsController],
  providers: [ContactsService],
  exports: [ContactsService],
})
export class ContactsModule {}
