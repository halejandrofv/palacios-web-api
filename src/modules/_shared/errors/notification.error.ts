import { ApplicationError } from './application.error';
export class NotificationError extends ApplicationError {
  constructor(referenceId: string) {
    super('NOTIFICATION_ERROR', referenceId);
  }
}
