import {json, type ActionFunctionArgs} from '@shopify/remix-oxygen';
import {
  ADMIN_NOTIFICATION_EMAIL,
  sendDirectEmail,
} from '~/lib/email-provider.server';

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function action({request, context}: ActionFunctionArgs) {
  const body = await request.json();
  try {
    const entries = Object.entries(body as Record<string, unknown>);
    const htmlRows = entries
      .map(
        ([key, value]) =>
          `<tr><td style="padding:6px 10px; border:1px solid #ddd;"><strong>${escapeHtml(
            key,
          )}</strong></td><td style="padding:6px 10px; border:1px solid #ddd;">${escapeHtml(
            String(value ?? ''),
          )}</td></tr>`,
      )
      .join('');

    await sendDirectEmail({
      env: context.env,
      to: ADMIN_NOTIFICATION_EMAIL,
      subject: 'New stock footage licensing form submission',
      text: JSON.stringify(body, null, 2),
      html: `
        <h2>New stock footage licensing form submission</h2>
        <table cellspacing="0" cellpadding="0" style="border-collapse: collapse;">
          ${htmlRows}
        </table>
      `,
    });

    return json({success: true});
  } catch (error) {
    console.error(error);
    return json({error: 'request failed', status: 500});
  }
}

export async function loader() {
  return new Response(null, {status: 405});
}
