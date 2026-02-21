import {DIRECT_EMAIL_FROM, sendDirectEmail} from '~/lib/email-provider.server';

type PurchaseEmailDownloadItem = {
  title: string;
  quantity: number;
  imageUrl?: string | null;
  downloadUrl: string;
  isBundle?: boolean;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDisplayDate(isoDate: string | null | undefined): string | null {
  if (!isoDate) return null;
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatCurrency(amount?: string | number | null): string {
  if (typeof amount === 'number') {
    return amount.toLocaleString('en-US', {style: 'currency', currency: 'USD'});
  }
  if (typeof amount === 'string') {
    const numeric = Number(amount);
    if (Number.isFinite(numeric)) {
      return numeric.toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
      });
    }
  }
  return '$0.00';
}

function createPurchaseEmailHtml({
  orderName,
  processedAt,
  shippingAddress,
  status,
  subtotal,
  tax,
  total,
  downloadItems,
}: {
  orderName: string;
  processedAt?: string | null;
  shippingAddress?: string | null;
  status?: string | null;
  subtotal?: string | number | null;
  tax?: string | number | null;
  total?: string | number | null;
  downloadItems: PurchaseEmailDownloadItem[];
}) {
  const formattedDate = formatDisplayDate(processedAt);

  const downloadItemMarkup = downloadItems
    .map((item) => {
      const title = escapeHtml(item.title);
      const imageMarkup = item.imageUrl
        ? `<img src="${escapeHtml(item.imageUrl)}" alt="${title}" width="240" style="display:block; border-radius:12px; width:240px; height:auto; margin:12px auto;" />`
        : '';

      return `
        <div style="border:1px solid #153157; border-radius:14px; background:#00112f; padding:20px; margin-bottom:14px;">
          <div style="font-size:13px; letter-spacing:1px; text-transform:uppercase; color:#9cb3d2; text-align:center; margin-bottom:8px;">Stock Footage</div>
          <h3 style="margin:0; font-size:24px; color:#ffffff; text-align:center;">${title}</h3>
          <p style="margin:6px 0 0 0; color:#9cb3d2; text-align:center;">${
            item.isBundle
              ? 'Stock Footage Video Bundle'
              : 'Stock Footage Video'
          }</p>
          ${imageMarkup}
          <p style="margin:14px 0 0 0; color:#ffffff;">Quantity: ${item.quantity}</p>
          <div style="text-align:center; margin-top:18px;">
            <a href="${escapeHtml(item.downloadUrl)}" style="display:inline-block; padding:12px 20px; border:1px solid #2a446b; border-radius:10px; color:#ffffff; text-decoration:none; font-weight:600;">
              Download ↓
            </a>
          </div>
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
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:1120px; border:1px solid #153157; border-radius:16px; background:#000a22; padding:18px;">
            <tr>
              <td style="padding-bottom:14px;">
                <p style="margin:0 0 8px 0; font-size:30px; font-weight:700; color:#ffffff;">Thank you for your purchase! ${escapeHtml(orderName)}</p>
                ${
                  formattedDate
                    ? `<p style="margin:0; color:#bfd0e8;">Placed on ${escapeHtml(formattedDate)}</p>`
                    : ''
                }
              </td>
            </tr>
            <tr>
              <td>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td valign="top" style="width:55%; padding-right:12px;">
                      ${downloadItemMarkup}
                    </td>
                    <td valign="top" style="width:45%; padding-left:12px;">
                      <div style="border:1px solid #153157; border-radius:14px; background:#00112f; padding:18px; margin-bottom:14px;">
                        <h3 style="margin:0 0 8px 0; font-size:24px; color:#ffffff;">Shipping Address:</h3>
                        <p style="margin:0 0 14px 0; color:#ffffff;">${escapeHtml(
                          shippingAddress?.trim() || 'N/A',
                        )}</p>
                        <h3 style="margin:0 0 8px 0; font-size:24px; color:#ffffff;">Status:</h3>
                        <p style="margin:0; color:#ffffff;">${escapeHtml(
                          status?.trim() || 'Paid',
                        )}</p>
                      </div>
                      <div style="border:1px solid #153157; border-radius:14px; background:#00112f; padding:18px;">
                        <p style="margin:0 0 14px 0; color:#ffffff; display:flex; justify-content:space-between;">
                          <span>Subtotal</span><span>${escapeHtml(formatCurrency(subtotal))}</span>
                        </p>
                        <p style="margin:0 0 14px 0; color:#ffffff; display:flex; justify-content:space-between;">
                          <span>Tax</span><span>${escapeHtml(formatCurrency(tax))}</span>
                        </p>
                        <p style="margin:0; color:#ffffff; display:flex; justify-content:space-between;">
                          <span>Total</span><span>${escapeHtml(formatCurrency(total))}</span>
                        </p>
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export async function sendPurchaseDownloadEmail({
  env,
  toEmail,
  orderName,
  processedAt,
  shippingAddress,
  status,
  subtotal,
  tax,
  total,
  downloadItems,
}: {
  env: Env;
  toEmail: string;
  orderName: string;
  processedAt?: string | null;
  shippingAddress?: string | null;
  status?: string | null;
  subtotal?: string | number | null;
  tax?: string | number | null;
  total?: string | number | null;
  downloadItems: PurchaseEmailDownloadItem[];
}) {
  const sanitizedOrderName = orderName.trim() || 'Order';
  const subject = `Thank you for your purchase! ${sanitizedOrderName}`;
  const html = createPurchaseEmailHtml({
    orderName: sanitizedOrderName,
    processedAt,
    shippingAddress,
    status,
    subtotal,
    tax,
    total,
    downloadItems,
  });

  const plainBody = [
    `Thank you for your purchase! ${sanitizedOrderName}`,
    '',
    ...downloadItems.map((item) => `${item.title}: ${item.downloadUrl}`),
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
