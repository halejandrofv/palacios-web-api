import type { CreateEmailResponse } from 'resend';
import { readEmailConfig } from '../../src/config/environment';
import { createApp } from '../../src/index';
import { BusinessProfileService } from '../../src/modules/business-profile/business/business-profile.service';
import { BusinessProfileEmailService } from '../../src/modules/business-profile/external-system/notifications/email/business-profile-email.service';
import { BusinessProfileDataAccessService } from '../../src/modules/business-profile/external-system/persistence/d1/business-profile-data-access.service';

export default createApp(
  (env) =>
    new BusinessProfileService(
      new BusinessProfileDataAccessService(env.DB),
      new BusinessProfileEmailService(
        readEmailConfig({ ...env, RESEND_API_KEY: 're_local_mock' }),
        {
          emails: {
            send: (): Promise<CreateEmailResponse> =>
              Promise.resolve({ data: { id: 'local-mock' }, error: null, headers: null }),
          },
        },
      ),
    ),
);
