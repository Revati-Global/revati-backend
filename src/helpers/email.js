import { config } from '../config/env.js';

function escapeHtml(str) {
    if (!str || typeof str !== 'string') return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Send an email using Resend HTTP API directly (no heavy SDK dependency needed)
 *
 * @param {Object} options
 * @param {string|string[]} options.to
 * @param {string} options.subject
 * @param {string} options.html
 * @param {string} [options.replyTo]
 * @returns {Promise<{ success: boolean, id?: string, error?: string }>}
 */
export async function sendEmail({ to, subject, html, replyTo }) {
    const resendApiKey = process.env.RESEND_API_KEY;
    const fromAddress = process.env.MAIL_FROM || 'Revati Global <noreply@revatiglobal.com>';

    if (!resendApiKey || resendApiKey.trim() === '' || resendApiKey === 'your_resend_api_key_here') {
        console.warn('Resend email skipped: RESEND_API_KEY is not configured.');
        return { success: false, error: 'RESEND_API_KEY_NOT_CONFIGURED' };
    }

    try {
        const payload = {
            from: fromAddress,
            to: Array.isArray(to) ? to : [to],
            subject,
            html
        };

        if (replyTo) {
            payload.reply_to = replyTo;
        }

        const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${resendApiKey.trim()}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (!res.ok) {
            console.error('Resend API error:', data);
            return { success: false, error: data?.message || 'Failed to send email via Resend' };
        }

        return { success: true, id: data.id };
    } catch (err) {
        console.error('Email dispatch error:', err.message);
        return { success: false, error: err.message };
    }
}

/**
 * Dispatch company and customer emails for a new enquiry
 */
export async function dispatchEnquiryAlerts(enquiry) {
    const results = { company: null, customer: null };

    const istTime = new Date().toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        dateStyle: 'full',
        timeStyle: 'medium'
    });

    const companyRecipients = (process.env.ALERT_EMAIL_TO || 'info@revatiglobal.com')
        .split(',')
        .map(e => e.trim())
        .filter(Boolean);

    const safeName = escapeHtml(enquiry.name);
    const safeEmail = escapeHtml(enquiry.email);
    const safePhone = escapeHtml(enquiry.phone);
    const safeState = escapeHtml(enquiry.state || 'N/A');
    const safeCity = escapeHtml(enquiry.city || 'N/A');
    const safeInterest = escapeHtml(enquiry.interest || 'General Inquiry');
    const safeProjectType = escapeHtml(enquiry.project_type || 'N/A');
    const safeMessage = escapeHtml(enquiry.message);
    const adminUrl = process.env.ADMIN_URL || 'https://admin.revatiglobal.com';

    // 1. Company Alert Email
    const companyHtml = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #F2F1F5; margin: 0; padding: 24px;">
      <div style="max-width: 600px; margin: 0 auto; background: #FFFFFF; border-radius: 12px; overflow: hidden; border: 1px solid #D9DDE3;">
        <div style="background: #645394; padding: 24px; text-align: left;">
          <h1 style="color: #FFFFFF; margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.5px;">Revati Global &bull; New Enquiry</h1>
          <p style="color: #EAE8EF; margin: 4px 0 0 0; font-size: 13px;">Received on ${istTime}</p>
        </div>
        <div style="padding: 24px;">
          <table style="width: 100%; border-collapse: collapse; font-size: 14px; color: #35313B;">
            <tr style="border-bottom: 1px solid #F2F1F5;"><td style="padding: 10px 0; font-weight: 600; width: 140px; color: #645394;">Name:</td><td style="padding: 10px 0;">${safeName}</td></tr>
            <tr style="border-bottom: 1px solid #F2F1F5;"><td style="padding: 10px 0; font-weight: 600; color: #645394;">Email:</td><td style="padding: 10px 0;"><a href="mailto:${safeEmail}" style="color: #645394;">${safeEmail}</a></td></tr>
            <tr style="border-bottom: 1px solid #F2F1F5;"><td style="padding: 10px 0; font-weight: 600; color: #645394;">Phone:</td><td style="padding: 10px 0;"><a href="tel:${safePhone}" style="color: #645394;">${safePhone}</a></td></tr>
            <tr style="border-bottom: 1px solid #F2F1F5;"><td style="padding: 10px 0; font-weight: 600; color: #645394;">Location:</td><td style="padding: 10px 0;">${safeCity}, ${safeState}</td></tr>
            <tr style="border-bottom: 1px solid #F2F1F5;"><td style="padding: 10px 0; font-weight: 600; color: #645394;">Interest:</td><td style="padding: 10px 0; font-weight: 700;">${safeInterest}</td></tr>
            <tr style="border-bottom: 1px solid #F2F1F5;"><td style="padding: 10px 0; font-weight: 600; color: #645394;">Project Type:</td><td style="padding: 10px 0;">${safeProjectType}</td></tr>
          </table>
          <div style="margin-top: 20px; padding: 16px; background: #F2F1F5; border-radius: 8px; border-left: 4px solid #645394;">
            <p style="margin: 0 0 6px 0; font-size: 12px; font-weight: 700; color: #645394; text-transform: uppercase;">Message:</p>
            <p style="margin: 0; font-size: 14px; line-height: 1.5; color: #35313B; white-space: pre-wrap;">${safeMessage}</p>
          </div>
          <div style="margin-top: 24px; text-align: center;">
            <a href="${adminUrl}/inquiries" style="display: inline-block; background: #645394; color: #FFFFFF; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; font-size: 14px;">Open in Admin Panel</a>
          </div>
        </div>
      </div>
    </body>
    </html>
    `;

    results.company = await sendEmail({
        to: companyRecipients,
        subject: `New Enquiry: ${safeName} (${safeInterest})`,
        html: companyHtml,
        replyTo: safeEmail
    });

    // 2. Customer Confirmation Email (if customer email is present)
    if (safeEmail && safeEmail.includes('@')) {
        const customerHtml = `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"></head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #FFFFFF; color: #35313B; margin: 0; padding: 24px;">
          <div style="max-width: 540px; margin: 0 auto; border: 1px solid #D9DDE3; border-radius: 12px; padding: 32px;">
            <h1 style="color: #645394; margin: 0 0 8px 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px;">Revati Global</h1>
            <p style="color: #645394; font-size: 12px; font-weight: 600; text-transform: uppercase; margin: 0 0 24px 0; letter-spacing: 0.5px;">Modern Engineering. Reliable Solutions.</p>
            <p style="font-size: 15px; line-height: 1.6; margin: 0 0 16px 0;">Dear ${safeName},</p>
            <p style="font-size: 15px; line-height: 1.6; margin: 0 0 16px 0;">Thank you for contacting Revati Global. We have received your inquiry regarding <strong>${safeInterest}</strong>.</p>
            <p style="font-size: 15px; line-height: 1.6; margin: 0 0 24px 0;">Our engineering solutions team is reviewing your requirements and will reach out to you shortly via phone or email.</p>
            <div style="background: #F2F1F5; padding: 16px; border-radius: 8px; margin-bottom: 24px; font-size: 13px; color: #35313B;">
              <p style="margin: 0 0 4px 0; font-weight: 600; color: #645394;">Your submitted inquiry:</p>
              <p style="margin: 0; font-style: italic;">"${safeMessage}"</p>
            </div>
            <p style="font-size: 14px; line-height: 1.5; color: #35313B; margin: 0;">Warm regards,<br><strong>Revati Global Team</strong><br><a href="https://revatiglobal.com" style="color: #645394; text-decoration: none;">www.revatiglobal.com</a></p>
          </div>
        </body>
        </html>
        `;

        results.customer = await sendEmail({
            to: safeEmail,
            subject: 'Thank you for contacting Revati Global',
            html: customerHtml
        });
    }

    return results;
}
