const RESEND_API_URL = 'https://api.resend.com/emails';
const HARDCODED_FROM_EMAIL = 'hello@adamunderwater.com';
const HARDCODED_FROM_NAME = 'Adam Underwater';
const HARDCODED_FROM_HEADER = `${HARDCODED_FROM_NAME} <${HARDCODED_FROM_EMAIL}>`;
const HARDCODED_ADMIN_NOTIFICATION_EMAIL = 'adamahussain1223@gmail.com';

type SendEmailInput = {
  env: Env;
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
};

function normalizeRecipients(to: string | string[]): string[] {
  const list = Array.isArray(to) ? to : [to];
  return list.map((value) => value.trim()).filter(Boolean);
}

export async function sendDirectEmail({
  env,
  to,
  subject,
  html,
  text,
  replyTo,
}: SendEmailInput) {
  const apiKey = env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is required for direct email sending.');
  }

  const recipients = normalizeRecipients(to);
  if (!recipients.length) {
    throw new Error('At least one recipient is required.');
  }

  const response = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: HARDCODED_FROM_HEADER,
      to: recipients,
      subject,
      html,
      text,
      reply_to: replyTo?.trim() || HARDCODED_FROM_EMAIL,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Resend email failed (${response.status}): ${errorText}`);
  }
}

export const DIRECT_EMAIL_FROM = HARDCODED_FROM_EMAIL;
export const ADMIN_NOTIFICATION_EMAIL = HARDCODED_ADMIN_NOTIFICATION_EMAIL;
