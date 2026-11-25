import { emailBranding } from '../../../../../../email-branding';
import type { BusinessProfileDto } from '../../../../dto/business-profile.dto';
import { LABELS } from '../../../../domain/business-profile.enums';
import { escapeHtml } from './html-escape.util';
export function businessProfileNotificationTemplate(profile: BusinessProfileDto): {
  html: string;
  text: string;
} {
  const rows: [string, string][] = [
    ['Reference ID', profile.referenceId],
    ['Name', `${profile.firstName} ${profile.lastName}`],
    ['Email', profile.email],
    ['Phone', profile.phone],
    ['Preferred Contact Method', LABELS[profile.preferredContactMethod]],
    ['Business Structure', LABELS[profile.businessStructure]],
    ['Services', profile.services.map((value) => LABELS[value]).join(', ')],
    ['Annual Revenue', LABELS[profile.annualRevenue]],
    ['Team Size', LABELS[profile.teamSize]],
    ['Accounting Method', LABELS[profile.accountingMethod]],
    ['Submitted At', profile.createdAt.toISOString() + ' (UTC)'],
  ];
  const details = rows
    .map(
      ([label, value]) =>
        `<tr><th align="left" valign="top" style="padding:10px;border-bottom:1px solid #D8E3DE;color:#132D26;">${escapeHtml(label)}</th><td style="padding:10px;border-bottom:1px solid #D8E3DE;color:#2C4138;word-break:break-word;">${escapeHtml(value)}</td></tr>`,
    )
    .join('');
  const message =
    profile.additionalMessage === null
      ? ''
      : `<div style="margin-top:28px;padding:20px;background:#EDF2EF;border-left:4px solid #58B58B;"><h3 style="color:#132D26;">Additional message</h3><p style="color:#2C4138;word-break:break-word;">${escapeHtml(profile.additionalMessage).replace(/\r?\n/g, '<br>')}</p></div>`;
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
  </head>
  <body style="margin:0;background:#F7F8F5;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F7F8F5;">
      <tr>
        <td align="center" style="padding:24px 12px;">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px;background:#FFFFFF;">
            <tr>
              <td align="center" bgcolor="#EDF2EF" background="${emailBranding.backgroundSrc}" style="padding:24px 32px;background-color:#EDF2EF;background-image:url('${emailBranding.backgroundSrc}');background-position:center;background-size:cover;background-repeat:no-repeat;">
                <img src="${emailBranding.logoSrc}" alt="Palacios CPA Accounting" width="280" style="display:block;width:280px;max-width:100%;height:auto;border:0;color:#132D26;font-size:20px;font-weight:700;">
              </td>
            </tr>
            <tr>
              <td style="padding:28px 32px;color:#2C4138;">
                <h1 style="font-size:24px;color:#132D26;">New business profile</h1>
                <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;font-size:14px;">${details}</table>
                ${message}
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px;background:#132D26;color:#80AB98;font-size:12px;line-height:1.6;">
                <strong style="color:#FFFFFF;">Palacios CPA Accounting</strong><br>
                Tax Compliance, Tax Advisory &amp; Accounting<br>
                21720 East Memorial Drive, Porter, Texas 77365
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
  return {
    html,
    text:
      rows.map(([label, value]) => `${label}: ${value}`).join('\n') +
      (profile.additionalMessage === null
        ? ''
        : '\n\nAdditional message\n' + profile.additionalMessage),
  };
}
