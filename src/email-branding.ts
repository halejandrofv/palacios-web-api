import logo from './email-assets/palacios-logo.png';
import background from './email-assets/parallax-diagonal.webp';

const logoId = 'palacios-cpa-logo';
const backgroundId = 'palacios-cpa-diagonal';

function base64(data: ArrayBuffer): string {
  const bytes = new Uint8Array(data);
  const chunkSize = 16 * 1024;
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

export const emailBranding = {
  logoSrc: `cid:${logoId}`,
  backgroundSrc: `cid:${backgroundId}`,
  attachments: [
    {
      filename: 'palacios-logo.png',
      contentId: logoId,
      contentType: 'image/png',
      content: base64(logo),
    },
    {
      filename: 'parallax-diagonal.webp',
      contentId: backgroundId,
      contentType: 'image/webp',
      content: base64(background),
    },
  ],
};
