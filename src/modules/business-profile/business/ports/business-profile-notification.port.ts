import type { BusinessProfileDto } from '../../dto/business-profile.dto';
export interface BusinessProfileNotificationPort {
  sendInternalNotification(submission: BusinessProfileDto): Promise<void>;
}
