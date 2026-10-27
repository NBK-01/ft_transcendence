import { I18nService } from 'nestjs-i18n';

/** Builds a `emails.KEY` translation, same convention as DomainException's `errors.KEY`. */
function t(
  i18n: I18nService,
  lang: string,
  key: string,
  args?: Record<string, unknown>,
): string {
  return String(i18n.translate(`emails.${key}`, { lang, args }));
}

export class EmailTemplates {
  static otpVerification(
    i18n: I18nService,
    lang: string,
    otpCode: string,
    expiryMinutes: number = 5,
  ): { subject: string; html: string } {
    const heading = t(i18n, lang, 'OTP_HEADING');
    return {
      subject: t(i18n, lang, 'OTP_SUBJECT'),
      html: `
        <!DOCTYPE html>
        <html>
        <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .container { background-color: #f4f4f4; border-radius: 10px; padding: 30px; }
            .otp-code { background-color: #007bff; color: white; font-size: 32px; font-weight: bold; text-align: center; padding: 20px; border-radius: 5px; letter-spacing: 8px; margin: 20px 0; }
            .info { background-color: #fff; border-left: 4px solid #007bff; padding: 15px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <h2>${heading}</h2>
            <p>${t(i18n, lang, 'OTP_INTRO')}</p>
            <div class="otp-code">${otpCode}</div>
            <div class="info">
              <strong>${t(i18n, lang, 'OTP_IMPORTANT_LABEL')}</strong>
              <ul>
                <li>${t(i18n, lang, 'OTP_EXPIRES', { expiryMinutes })}</li>
                <li>${t(i18n, lang, 'OTP_NO_SHARE')}</li>
                <li>${t(i18n, lang, 'OTP_IGNORE')}</li>
              </ul>
            </div>
            <div class="footer"><p>${t(i18n, lang, 'FOOTER')}</p></div>
          </div>
        </body>
        </html>
      `,
    };
  }

  /** `resetUrl` should already include the token as a query param, built by the caller from FRONTEND_URL. */
  static passwordReset(
    i18n: I18nService,
    lang: string,
    resetUrl: string,
    resetToken: string,
    expiryMinutes: number = 15,
  ): { subject: string; html: string } {
    return {
      subject: t(i18n, lang, 'RESET_SUBJECT'),
      html: `
        <!DOCTYPE html>
        <html>
        <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .container { background-color: #f4f4f4; border-radius: 10px; padding: 30px; }
            .button { display: inline-block; background-color: #007bff; color: white; text-decoration: none; padding: 15px 30px; border-radius: 5px; font-weight: bold; margin: 20px 0; }
            .token-box { background-color: #fff; border: 2px dashed #007bff; padding: 20px; border-radius: 5px; word-break: break-all; margin: 20px 0; font-family: monospace; font-size: 14px; }
            .info { background-color: #fff; border-left: 4px solid #dc3545; padding: 15px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <h2>${t(i18n, lang, 'RESET_HEADING')}</h2>
            <p>${t(i18n, lang, 'RESET_INTRO')}</p>
            <div style="text-align: center;"><a href="${resetUrl}" class="button">${t(i18n, lang, 'RESET_BUTTON')}</a></div>
            <p>${t(i18n, lang, 'RESET_COPY_TOKEN')}</p>
            <div class="token-box">${resetToken}</div>
            <div class="info">
              <strong>${t(i18n, lang, 'RESET_SECURITY_LABEL')}</strong>
              <ul>
                <li>${t(i18n, lang, 'RESET_EXPIRES', { expiryMinutes })}</li>
                <li>${t(i18n, lang, 'RESET_IGNORE')}</li>
                <li>${t(i18n, lang, 'RESET_NO_CHANGE')}</li>
              </ul>
            </div>
            <div class="footer"><p>${t(i18n, lang, 'FOOTER')}</p></div>
          </div>
        </body>
        </html>
      `,
    };
  }
}
