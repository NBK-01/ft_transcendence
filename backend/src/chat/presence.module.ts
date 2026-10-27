import { Module } from '@nestjs/common';
import { PresenceService } from './presence.service';

/** Who's online (Redis): ChatGateway keeps it, contacts and profiles read it. */
@Module({
  providers: [PresenceService],
  exports: [PresenceService],
})
export class PresenceModule {}
