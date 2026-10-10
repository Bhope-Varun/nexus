import mongoose from 'mongoose';
import { Invoice } from '../models/Invoice.ts';
import { User } from '../models/User.ts';
import { ReceiptDeliveryLog, type IReceiptDeliveryLog } from '../models/ReceiptDeliveryLog.ts';
import { generateReceiptPdf } from './pdf.service.ts';
import { getStorageService } from './storage.service.ts';
import { sendReceiptEmail } from './email.service.ts';
import { AppError } from '../middleware/errorHandler.ts';

export interface WorkflowResult {
  success: boolean;
  message: string;
  alreadySent?: boolean;
  pdfUrl?: string;
  log: IReceiptDeliveryLog;
}

export async function executeReceiptWorkflow(
  invoiceId: string | mongoose.Types.ObjectId,
  options: { forceEmailResend?: boolean; customTransporter?: any } = {}
): Promise<WorkflowResult> {
  const invoice = await Invoice.findById(invoiceId);
  if (!invoice) {
    throw new AppError('Invoice not found for receipt generation', 404);
  }

  const client = await User.findById(invoice.client);
  if (!client) {
    throw new AppError('Client account not found for receipt delivery', 404);
  }

  // Find or initialize delivery log
  let log = await ReceiptDeliveryLog.findOne({ invoiceId: invoice._id });
  if (!log) {
    log = await ReceiptDeliveryLog.create({
      invoiceId: invoice._id,
      status: 'pending',
      emailRecipient: client.email,
      attempts: 0,
    });
  }

  // Idempotency check: Never duplicate successfully sent emails unless forced
  if (log.status === 'email_sent' && !options.forceEmailResend) {
    return {
      success: true,
      message: 'Receipt already generated and delivered to client email',
      alreadySent: true,
      pdfUrl: invoice.receiptUrl,
      log,
    };
  }

  log.attempts += 1;
  const storage = getStorageService();

  // Step 1: Generate & Store PDF (only if not already generated or stored)
  let pdfBuffer: Buffer;
  const filename = `Receipt-${invoice.invoiceNumber}.pdf`;

  try {
    const fileExists = await storage.exists(filename);
    if (fileExists && log.pdfPath) {
      pdfBuffer = await storage.get(filename);
    } else {
      pdfBuffer = await generateReceiptPdf({
        invoice,
        client,
        paymentDetails: {
          transactionId: invoice.stripePaymentIntentId,
          paidAt: invoice.paidAt || new Date(),
          amountPaid: invoice.totalAmount,
          currency: invoice.currency,
        },
      });

      const storageResult = await storage.save(filename, pdfBuffer, 'application/pdf');
      invoice.receiptUrl = storageResult.url;
      invoice.receiptGeneratedAt = new Date();
      await invoice.save();

      log.pdfPath = storageResult.path;
      log.status = 'pdf_generated';
      await log.save();
    }
  } catch (pdfError: any) {
    log.status = 'failed';
    log.lastError = `PDF generation failed: ${pdfError.message}`;
    await log.save();
    throw new AppError(`Receipt PDF generation failed: ${pdfError.message}`, 500);
  }

  // Step 2: Deliver Email with PDF Attachment
  try {
    await sendReceiptEmail({
      to: client.email,
      invoiceNumber: invoice.invoiceNumber,
      clientName: client.name,
      amountPaid: invoice.totalAmount,
      currency: invoice.currency,
      pdfBuffer,
      customTransporter: options.customTransporter,
    });

    log.status = 'email_sent';
    log.emailSentAt = new Date();
    log.lastError = undefined;
    await log.save();

    invoice.receiptSentAt = new Date();
    await invoice.save();

    return {
      success: true,
      message: `Receipt successfully generated and emailed to ${client.email}`,
      alreadySent: false,
      pdfUrl: invoice.receiptUrl,
      log,
    };
  } catch (emailError: any) {
    // If email delivery fails, keep status 'failed' with error message
    // Note: PDF remains safely preserved in storage so retry won't regenerate it
    log.status = 'failed';
    log.lastError = `Email delivery failed: ${emailError.message}`;
    await log.save();

    return {
      success: false,
      message: `Receipt PDF generated, but email delivery failed: ${emailError.message}`,
      alreadySent: false,
      pdfUrl: invoice.receiptUrl,
      log,
    };
  }
}
