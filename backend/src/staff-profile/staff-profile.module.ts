import { Module } from '@nestjs/common';
import { AccessControlModule } from '../access-control/access-control.module';
import { PresenceModule } from '../chat/presence.module';
import { ContactsModule } from '../contacts/contacts.module';
import { FileStorageModule } from '../file-storage/file-storage.module';
import { InternalUsersModule } from '../internal-users/internal-users.module';
import { StaffProfileController } from './staff-profile.controller';
import { StaffProfileService } from './staff-profile.service';

@Module({
  imports: [
    InternalUsersModule,
    AccessControlModule,
    FileStorageModule,
    ContactsModule,
    PresenceModule,
  ],
  controllers: [StaffProfileController],
  providers: [StaffProfileService],
  exports: [StaffProfileService],
})
export class StaffProfileModule {}
