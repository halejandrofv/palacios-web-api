import type { CreateEmailOptions, CreateEmailRequestOptions, CreateEmailResponse } from 'resend';
import type { EmailConfig } from '../../../../../config/environment';
import { emailBranding } from '../../../../../email-branding';
import { NotificationError } from '@shared/errors/notification.error';
import type { BusinessProfileNotificationPort } from '../../../business/ports/business-profile-notification.port';
import type { BusinessProfileDto } from '../../../dto/business-profile.dto';
import { businessProfileNotificationTemplate } from './templates/business-profile-notification.template';

export interface ResendClient {
  emails: {
    send(
      payload: CreateEmailOptions,
      options?: CreateEmailRequestOptions,
    ): Promise<CreateEmailResponse>;
  };
}

export class BusinessProfileEmailService implements BusinessProfileNotificationPort {
  constructor(
    private readonly config: EmailConfig,
    private readonly resend: ResendClient,
  ) {}

  async sendInternalNotification(profile: BusinessProfileDto): Promise<void> {
    try {
      const template = businessProfileNotificationTemplate(profile);
      const { data, error } = await this.resend.emails.send(
        {
          from: `${this.config.MAIL_FROM_NAME} <${this.config.MAIL_FROM_EMAIL}>`,
          to: [this.config.INTERNAL_NOTIFICATION_EMAIL],
          replyTo: profile.email,
          subject: `New business profile — ${profile.referenceId}`,
          attachments: emailBranding.attachments,
          ...template,
        },
        {
          idempotencyKey: `business-profile-${profile.referenceId}`,
        },
      );
      if (error !== null || data === null || !data.id)
        throw new NotificationError(profile.referenceId);
    } catch {
      throw new NotificationError(profile.referenceId);
    }
  }
}
