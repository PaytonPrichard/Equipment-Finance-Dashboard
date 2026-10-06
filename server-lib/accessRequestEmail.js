// ============================================================
// Confirmation sent to whoever submits the Request Access form.
//
// The form is public, so the address is whatever anyone typed. The message
// is therefore fixed: nothing the visitor entered (name, firm, notes) is
// repeated in it. Echoing input would let a stranger send their own text to
// someone else's inbox from our domain. /api/request-access rate limits
// submissions to 5 an hour per IP.
// ============================================================

const DEMO_URL = 'https://www.gettranche.app/?demo=1';
const REPLY_TO = 'team@gettranche.app';

function confirmationEmail() {
  const subject = 'We got your Tranche request';
  const text = [
    'Thanks for requesting a trial of Tranche. We review every request and reply within one business day.',
    '',
    `In the meantime, the demo runs on a sample deal with no login: ${DEMO_URL}`,
    '',
    'Questions? Reply to this email.',
  ].join('\n');
  const html = `
    <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; color: #111827;">
      <div style="border-bottom: 1px solid #e5e7eb; padding-bottom: 12px; margin-bottom: 20px;">
        <strong style="font-size: 16px;">Tranche</strong>
      </div>
      <p style="font-size: 15px; line-height: 1.6; margin: 0 0 14px;">
        Thanks for requesting a trial of Tranche. We review every request and reply within one business day.
      </p>
      <p style="font-size: 15px; line-height: 1.6; margin: 0 0 14px;">
        In the meantime, the demo runs on a sample deal with no login:
        <a href="${DEMO_URL}" style="color: #111827;">gettranche.app/?demo=1</a>
      </p>
      <p style="font-size: 15px; line-height: 1.6; margin: 0;">Questions? Reply to this email.</p>
    </div>
  `;
  return { subject, text, html, replyTo: REPLY_TO };
}

module.exports = { confirmationEmail, DEMO_URL, REPLY_TO };
