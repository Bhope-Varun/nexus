import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { config } from '../config/env.ts';

export interface SendReceiptEmailParams {
  to: string;
  invoiceNumber: string;
  clientName: string;
  amountPaid: number;
  currency: string;
  pdfBuffer: Buffer;
  customTransporter?: Transporter;
}

export function createEmailTransporter(): Transporter {
  // If SMTP username is provided, use configured SMTP
  if (config.smtp.user) {
    return nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: {
        user: config.smtp.user,
        pass: config.smtp.pass,
      },
    });
  }

  // In test or local dev without SMTP credentials, create a simulated/json transporter
  return nodemailer.createTransport({
    streamTransport: true,
    newline: 'unix',
    buffer: true,
  } as any);
}

export async function sendReceiptEmail(
  params: SendReceiptEmailParams
): Promise<{ success: boolean; messageId?: string }> {
  const transporter = params.customTransporter || createEmailTransporter();

  const formattedAmount = `${params.currency.toUpperCase()} ${params.amountPaid.toFixed(2)}`;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
        .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
        .header { background: #1e1b4b; padding: 32px 24px; text-align: center; color: #ffffff; }
        .header h1 { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: 0.5px; }
        .header p { margin: 6px 0 0; font-size: 13px; color: #a5b4fc; }
        .body { padding: 32px 24px; }
        .status-badge { display: inline-block; background: #ecfdf5; color: #047857; font-size: 12px; font-weight: 700; padding: 4px 12px; border-radius: 9999px; margin-bottom: 16px; border: 1px solid #a7f3d0; }
        .amount-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; text-align: center; margin: 24px 0; }
        .amount-label { font-size: 12px; text-transform: uppercase; color: #64748b; font-weight: 600; letter-spacing: 0.5px; }
        .amount-value { font-size: 28px; font-weight: 800; color: #0f172a; margin-top: 4px; }
        .details-table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 13px; }
        .details-table td { padding: 10px 0; border-bottom: 1px solid #f1f5f9; }
        .details-table td.label { color: #64748b; font-weight: 500; }
        .details-table td.value { text-align: right; font-weight: 600; color: #0f172a; }
        .footer { background: #f8fafc; padding: 20px 24px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>NEXUS CORPORATE</h1>
          <p>Payment Confirmation & Official Tax Receipt</p>
        </div>
        <div class="body">
          <div class="status-badge">PAYMENT CONFIRMED</div>
          <p style="margin: 0; font-size: 15px; line-height: 1.5;">Dear <strong>${params.clientName}</strong>,</p>
          <p style="margin-top: 8px; font-size: 14px; line-height: 1.6; color: #475569;">
            We have successfully received your payment for Invoice <strong>${params.invoiceNumber}</strong>. Your official PDF receipt with tax and transaction details is attached to this email.
          </p>

          <div class="amount-box">
            <div class="amount-label">Total Amount Paid</div>
            <div class="amount-value">${formattedAmount}</div>
          </div>

          <table class="details-table">
            <tr>
              <td class="label">Invoice Number</td>
              <td class="value">${params.invoiceNumber}</td>
            </tr>
            <tr>
              <td class="label">Payment Method</td>
              <td class="value">Stripe Card Payment</td>
            </tr>
            <tr>
              <td class="label">Payment Status</td>
              <td class="value" style="color: #059669;">Completed</td>
            </tr>
          </table>

          <p style="margin-top: 24px; font-size: 13px; color: #64748b; line-height: 1.5;">
            Please retain the attached PDF for your corporate accounting and taxation records. If you have any inquiries, contact our billing department at billing@nexuscorporate.com.
          </p>
        </div>
        <div class="footer">
          Nexus Corporate Technologies Inc. &bull; Enterprise Financial Services &bull; All rights reserved.
        </div>
      </div>
    </body>
    </html>
  `;

  const info = await transporter.sendMail({
    from: config.smtp.from,
    to: params.to,
    subject: `Payment Receipt: Invoice #${params.invoiceNumber} - Nexus Corporate`,
    html: htmlContent,
    attachments: [
      {
        filename: `Receipt-${params.invoiceNumber}.pdf`,
        content: params.pdfBuffer,
        contentType: 'application/pdf',
      },
    ],
  });

  return {
    success: true,
    messageId: info.messageId,
  };
}
