import nodemailer, { Transporter } from 'nodemailer';
import { config } from '../config';

// =====================================================
// Email Configuration
// =====================================================

interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from: string;
}

// Default email config (using ethereal for testing)
const emailConfig: EmailConfig = {
  host: process.env.SMTP_HOST || 'smtp.ethereal.email',
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
  from: process.env.SMTP_FROM || 'VPM System <noreply@vpm.com>',
};

// =====================================================
// Email Service
// =====================================================

export class EmailService {
  private static transporter: Transporter | null = null;
  private static isConfigured: boolean = false;

  /**
   * Initialize the email transporter
   */
  static async initialize(): Promise<void> {
    try {
      // Check if SMTP is configured
      if (!emailConfig.auth.user || !emailConfig.auth.pass) {
        console.log('📧 Email service not configured - using console logging for OTPs');
        this.isConfigured = false;
        return;
      }

      this.transporter = nodemailer.createTransport({
        host: emailConfig.host,
        port: emailConfig.port,
        secure: emailConfig.secure,
        auth: emailConfig.auth,
      });

      // Verify connection
      await this.transporter.verify();
      this.isConfigured = true;
      console.log('📧 Email service initialized successfully');
    } catch (error) {
      console.error('📧 Email service initialization failed:', error);
      this.isConfigured = false;
    }
  }

  /**
   * Check if email service is available
   */
  static isAvailable(): boolean {
    return this.isConfigured && this.transporter !== null;
  }

  /**
   * Send an email
   */
  static async sendEmail(
    to: string,
    subject: string,
    html: string,
    text?: string
  ): Promise<boolean> {
    try {
      if (!this.isAvailable()) {
        // Log to console if email not configured (development mode)
        console.log('═'.repeat(50));
        console.log('📧 EMAIL (console mode)');
        console.log(`To: ${to}`);
        console.log(`Subject: ${subject}`);
        console.log('─'.repeat(50));
        console.log(text || html);
        console.log('═'.repeat(50));
        return true;
      }

      await this.transporter!.sendMail({
        from: emailConfig.from,
        to,
        subject,
        html,
        text: text || html.replace(/<[^>]*>/g, ''),
      });

      return true;
    } catch (error) {
      console.error('Failed to send email:', error);
      return false;
    }
  }

  /**
   * Send OTP email for login verification
   */
  static async sendLoginOTP(email: string, otp: string, userName: string): Promise<boolean> {
    const subject = 'Your Login Verification Code - VPM System';
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #1976d2; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px; background: #f5f5f5; }
          .otp-box { background: white; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px; }
          .otp-code { font-size: 32px; font-weight: bold; color: #1976d2; letter-spacing: 5px; }
          .warning { color: #f44336; font-size: 12px; margin-top: 20px; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔐 Login Verification</h1>
          </div>
          <div class="content">
            <p>Hello <strong>${userName}</strong>,</p>
            <p>You're trying to log in to the Visitor & Parcel Management System. Use the verification code below to complete your login:</p>
            <div class="otp-box">
              <div class="otp-code">${otp}</div>
              <p style="color: #666; font-size: 14px; margin-top: 10px;">This code expires in 5 minutes</p>
            </div>
            <p class="warning">⚠️ If you didn't request this code, please ignore this email and ensure your account is secure.</p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} Visitor & Parcel Management System</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
Hello ${userName},

Your login verification code is: ${otp}

This code expires in 5 minutes.

If you didn't request this code, please ignore this email.

- VPM System
    `;

    return this.sendEmail(email, subject, html, text);
  }

  /**
   * Send OTP email for password reset
   */
  static async sendPasswordResetOTP(email: string, otp: string, userName: string): Promise<boolean> {
    const subject = 'Password Reset Code - VPM System';
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #f44336; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px; background: #f5f5f5; }
          .otp-box { background: white; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px; }
          .otp-code { font-size: 32px; font-weight: bold; color: #f44336; letter-spacing: 5px; }
          .warning { color: #f44336; font-size: 12px; margin-top: 20px; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔑 Password Reset</h1>
          </div>
          <div class="content">
            <p>Hello <strong>${userName}</strong>,</p>
            <p>We received a request to reset your password. Use the code below to proceed:</p>
            <div class="otp-box">
              <div class="otp-code">${otp}</div>
              <p style="color: #666; font-size: 14px; margin-top: 10px;">This code expires in 10 minutes</p>
            </div>
            <p class="warning">⚠️ If you didn't request a password reset, please contact your administrator immediately.</p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} Visitor & Parcel Management System</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
Hello ${userName},

Your password reset code is: ${otp}

This code expires in 10 minutes.

If you didn't request this, please contact your administrator.

- VPM System
    `;

    return this.sendEmail(email, subject, html, text);
  }

  /**
   * Send 2FA enabled notification
   */
  static async send2FAEnabledNotification(email: string, userName: string): Promise<boolean> {
    const subject = 'Two-Factor Authentication Enabled - VPM System';
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4caf50; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px; background: #f5f5f5; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ 2FA Enabled</h1>
          </div>
          <div class="content">
            <p>Hello <strong>${userName}</strong>,</p>
            <p>Two-Factor Authentication has been successfully enabled on your account.</p>
            <p>From now on, you'll need to enter a verification code when logging in to add an extra layer of security.</p>
            <p>If you didn't make this change, please contact your administrator immediately.</p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} Visitor & Parcel Management System</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail(email, subject, html);
  }
}

export default EmailService;
