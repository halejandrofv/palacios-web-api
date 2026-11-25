import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EmailConfig } from '../src/config/environment';
import { businessProfileNotificationTemplate } from '../src/modules/business-profile/external-system/notifications/email/templates/business-profile-notification.template';
import { escapeHtml } from '../src/modules/business-profile/external-system/notifications/email/templates/html-escape.util';
import {
  BusinessProfileEmailService,
  type ResendClient,
} from '../src/modules/business-profile/external-system/notifications/email/business-profile-email.service';
import { NotificationError } from '@shared/errors/notification.error';
import { savedProfile } from './fixtures/business-profile';
describe('Business profile email', () => {
  it.each(['firstName', 'lastName', 'additionalMessage'] as const)('escapes %s', (field) => {
    const { html } = businessProfileNotificationTemplate({
      ...savedProfile,
      [field]: '<script>alert("x")</script>&\'',
    });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;&amp;&#39;');
  });
  it('escapes all five HTML metacharacters', () => {
    expect(escapeHtml('&<>"\'')).toBe('&amp;&lt;&gt;&quot;&#39;');
  });
  it('uses labels, inline green branding, logo fallback, footer and no message block when null', () => {
    const { html, text } = businessProfileNotificationTemplate({
      ...savedProfile,
      additionalMessage: null,
    });
    for (const value of [
      'Tax Preparation',
      'Another Accountant',
      '#132D26',
      'Palacios CPA',
      '21720 East Memorial Drive',
      'src="cid:palacios-cpa-logo"',
      'background="cid:palacios-cpa-diagonal"',
      'bgcolor="#EDF2EF"',
      'Arial,Helvetica,sans-serif',
    ])
      expect(html).toContain(value);
    expect(html).not.toContain('Additional message');
    expect(text).toContain('Reference ID: ' + savedProfile.referenceId);
    expect(html).not.toContain('<script');
  });

  describe('Resend adapter', () => {
    const send = vi.fn<ResendClient['emails']['send']>();
    const config: EmailConfig = {
      INTERNAL_NOTIFICATION_EMAIL: 'notifications@example.test',
      MAIL_FROM_EMAIL: 'info@palacioscpa.com',
      MAIL_FROM_NAME: 'Palacios CPA',
      RESEND_API_KEY: 're_test_only_not_a_real_key',
    };
    const service = new BusinessProfileEmailService(config, { emails: { send } });

    beforeEach(() => {
      send.mockReset().mockResolvedValue({
        data: { id: 'email-id' },
        error: null,
        headers: null,
      });
    });

    it('sends the existing HTML template from info@palacioscpa.com', async () => {
      await service.sendInternalNotification(savedProfile);

      const call = send.mock.calls[0];
      expect(call).toBeDefined();
      if (!call) throw new Error('Missing Resend call.');
      const [payload, options] = call;
      expect(payload.from).toBe('Palacios CPA <info@palacioscpa.com>');
      expect(payload.to).toEqual(['notifications@example.test']);
      expect(payload.replyTo).toBe(savedProfile.email);
      expect(payload.subject).toBe(`New business profile — ${savedProfile.referenceId}`);
      expect(payload.html).toContain('New business profile');
      expect(payload.text).toContain(`Reference ID: ${savedProfile.referenceId}`);
      expect(payload.attachments).toHaveLength(2);
      for (const attachment of payload.attachments ?? []) {
        expect(attachment.content).toBeTruthy();
        expect(payload.html).toContain(`cid:${attachment.contentId}`);
      }
      expect(options).toEqual({ idempotencyKey: `business-profile-${savedProfile.referenceId}` });
    });

    it('translates API and transport failures without exposing Resend details', async () => {
      send.mockResolvedValueOnce({
        data: null,
        error: {
          name: 'validation_error',
          message: 'private Resend detail',
          statusCode: 400,
        },
        headers: null,
      });
      await expect(service.sendInternalNotification(savedProfile)).rejects.toBeInstanceOf(
        NotificationError,
      );

      send.mockRejectedValueOnce(new Error('private network detail'));
      await expect(service.sendInternalNotification(savedProfile)).rejects.toBeInstanceOf(
        NotificationError,
      );
    });
  });
});
