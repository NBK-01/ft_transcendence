import { Injectable, Logger } from '@nestjs/common';
import { AuthContextService } from '../../common/context/auth-context.service';
import { NotificationRecipient } from '../../notifications/notifications.service';
import { JobType } from '../constants/job-type';
import { ActionNotificationEvent } from '../events/action-notification.event';
import { QueueService } from './queue.service';

/**
 * Where the action triggers (ActionSubscriber, ActionSignalsListener) hand
 * over: it enqueues the ACTION_NOTIFICATION job, through QueueService like
 * every other job.
 */
@Injectable()
export class ActionNotifier {
  private readonly logger = new Logger(ActionNotifier.name);

  constructor(
    private readonly queueService: QueueService,
    private readonly authContext: AuthContextService,
  ) {}

  /** The signed-in account, read from the request's context: call it while the request that acts is running. */
  actor(): NotificationRecipient | null {
    const user = this.authContext.getUser();
    return user ? { id: user.id, accountType: user.accountType } : null;
  }

  /**
   * Builds the job data (which may need a read, e.g. a branch's staff) and
   * enqueues it, in the background: the write it's about has committed, so
   * the request neither waits for this nor fails because of it. A failure is
   * logged. `build` returns null when there's nothing to say.
   */
  notify(build: () => Promise<ActionNotificationEvent | null>): void {
    build()
      .then(
        (event) =>
          event &&
          this.queueService.enqueue(JobType.ACTION_NOTIFICATION, event),
      )
      .catch((error: unknown) =>
        this.logger.error(
          `Could not enqueue an action notification: ${String(error)}`,
        ),
      );
  }
}
