export class EmailTemplates {
  static otpVerification(
    otpCode: string,
    expiryMinutes: number = 5,
  ): { subject: string; html: string } {
    return {
      subject: 'Verify Your Email - OTP Code',
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
            <h2>Email Verification</h2>
            <p>Thank you for registering! Please use the following OTP code to verify your email address:</p>
            <div class="otp-code">${otpCode}</div>
            <div class="info">
              <strong>Important:</strong>
              <ul>
                <li>This code will expire in ${expiryMinutes} minutes</li>
                <li>Do not share this code with anyone</li>
                <li>If you didn't request this, please ignore this email</li>
              </ul>
            </div>
            <div class="footer"><p>This is an automated email, please do not reply.</p></div>
          </div>
        </body>
        </html>
      `,
    };
  }

  /** `resetUrl` should already include the token as a query param, built by the caller from FRONTEND_URL. */
  static passwordReset(
    resetUrl: string,
    resetToken: string,
    expiryMinutes: number = 15,
  ): { subject: string; html: string } {
    return {
      subject: 'Reset Your Password',
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
            <h2>Password Reset Request</h2>
            <p>We received a request to reset your password. Click the button below to choose a new one:</p>
            <div style="text-align: center;"><a href="${resetUrl}" class="button">Reset Password</a></div>
            <p>Or copy this reset token:</p>
            <div class="token-box">${resetToken}</div>
            <div class="info">
              <strong>Security Notice:</strong>
              <ul>
                <li>This token will expire in ${expiryMinutes} minutes</li>
                <li>If you didn't request a password reset, please ignore this email</li>
                <li>Your password won't change until you complete this flow</li>
              </ul>
            </div>
            <div class="footer"><p>This is an automated email, please do not reply.</p></div>
          </div>
        </body>
        </html>
      `,
    };
  }
}
