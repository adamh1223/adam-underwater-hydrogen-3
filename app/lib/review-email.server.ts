import {DIRECT_EMAIL_FROM, sendDirectEmail} from '~/lib/email-provider.server';

type ReviewEmailPrintItem = {
  title: string;
  imageUrl?: string | null;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function createReviewRequestEmailHtml({
  orderName,
  orderUrl,
  printItems,
}: {
  orderName: string;
  orderUrl: string;
  printItems: ReviewEmailPrintItem[];
}) {
  const printItemMarkup = printItems
    .map((item) => {
      const title = escapeHtml(item.title);
      const imageMarkup = item.imageUrl
        ? `<img src="${escapeHtml(item.imageUrl)}" alt="${title}" width="240" style="display:block; border-radius:12px; width:240px; height:auto; margin:12px auto;" />`
        : '';

      return `
        <div style="border:1px solid #153157; border-radius:14px; background:#00112f; padding:20px; margin-bottom:14px;">
          <div style="font-size:13px; letter-spacing:1px; text-transform:uppercase; color:#9cb3d2; text-align:center; margin-bottom:8px;">Framed Canvas Print</div>
          <h3 style="margin:0; font-size:24px; color:#ffffff; text-align:center;">${title}</h3>
          ${imageMarkup}
        </div>
      `;
    })
    .join('\n');

  return `<!doctype html>
<html>
  <body style="margin:0; padding:0; background:#020b1f; color:#ffffff; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#020b1f; padding:22px 10px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px; border:1px solid #153157; border-radius:16px; background:#000a22; padding:28px;">
            <tr>
              <td style="padding-bottom:20px; text-align:center;">
                <p style="margin:0 0 12px 0; font-size:28px; font-weight:700; color:#ffffff;">Review your order for discount</p>
                <p style="margin:0 0 6px 0; font-size:14px; color:#9cb3d2;">${escapeHtml(orderName)}</p>
              </td>
            </tr>
            <tr>
              <td style="padding-bottom:24px;">
                <p style="margin:0; font-size:16px; line-height:1.6; color:#bfd0e8; text-align:center;">
                  Leave a review with an image and/or video on your recent order to receive a <strong style="color:#ffffff;">$20 off</strong> discount code.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding-bottom:24px;">
                ${printItemMarkup}
              </td>
            </tr>
            <tr>
              <td style="text-align:center; padding-bottom:16px;">
                <a href="${escapeHtml(orderUrl)}" style="display:inline-block; padding:14px 28px; background:#1a3a6b; border:1px solid #2a5599; border-radius:10px; color:#ffffff; text-decoration:none; font-weight:600; font-size:16px;">
                  Leave review and claim discount
                </a>
              </td>
            </tr>
            <tr>
              <td style="text-align:center;">
                <p style="margin:0; font-size:12px; color:#6b7f9e;">
                  Discount code will be generated after you submit a review with an image or video.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export async function sendReviewRequestEmail({
  env,
  toEmail,
  orderName,
  orderUrl,
  printItems,
}: {
  env: Env;
  toEmail: string;
  orderName: string;
  orderUrl: string;
  printItems: ReviewEmailPrintItem[];
}) {
  const subject = 'Review your order for discount';
  const html = createReviewRequestEmailHtml({orderName, orderUrl, printItems});

  const plainBody = [
    'Review your order for discount',
    '',
    'Leave a review with an image and/or video on your recent order to receive a $20 off discount code.',
    '',
    ...printItems.map((item) => `- ${item.title}`),
    '',
    `Leave your review here: ${orderUrl}`,
  ].join('\n');

  await sendDirectEmail({
    env,
    to: toEmail.trim(),
    subject,
    html,
    text: plainBody,
    replyTo: DIRECT_EMAIL_FROM,
  });
}
