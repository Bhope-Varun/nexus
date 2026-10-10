import PDFDocument from 'pdfkit';
import type { IInvoice } from '../models/Invoice.ts';
import type { IUser } from '../models/User.ts';

export interface ReceiptData {
  invoice: IInvoice;
  client: IUser;
  paymentDetails: {
    transactionId?: string;
    paymentMethod?: string;
    paidAt: Date;
    amountPaid: number;
    currency: string;
  };
}

export function generateReceiptPdf(data: ReceiptData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        info: {
          Title: `Receipt-${data.invoice.invoiceNumber}`,
          Author: 'Nexus Corporate Technologies Inc.',
          Subject: `Payment Receipt for Invoice ${data.invoice.invoiceNumber}`,
        },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));

      const primaryColor = '#1e293b'; // slate-800
      const brandColor = '#4f46e5'; // indigo-600
      const accentGreen = '#059669'; // emerald-600
      const mutedColor = '#64748b'; // slate-500

      // 1. Draw Nexus Corporate Logo Badge (Vector Graphic)
      // Hexagonal corporate emblem
      doc.save();
      const logoX = 50;
      const logoY = 48;
      doc.rect(logoX, logoY, 40, 40).lineWidth(1).fillAndStroke(brandColor, brandColor);
      
      // Geometric interior icon in white
      doc.polygon(
        [logoX + 20, logoY + 8],
        [logoX + 32, logoY + 16],
        [logoX + 32, logoY + 32],
        [logoX + 20, logoY + 24]
      ).fill('#ffffff');

      doc.polygon(
        [logoX + 20, logoY + 8],
        [logoX + 8, logoY + 16],
        [logoX + 8, logoY + 32],
        [logoX + 20, logoY + 24]
      ).fill('#c7d2fe');
      doc.restore();

      // Brand Title & Subtitle
      doc
        .fontSize(20)
        .font('Helvetica-Bold')
        .fillColor(primaryColor)
        .text('NEXUS CORPORATE', 100, 50);

      doc
        .fontSize(9)
        .font('Helvetica')
        .fillColor(mutedColor)
        .text('Enterprise Financial Portal & Cloud Billing Services', 100, 72)
        .text('Nexus Corporate Technologies Inc. · Tax ID: US-EIN-84-9102847', 100, 84);

      // Top Right Receipt Details
      const formattedPaidDate = new Date(data.paymentDetails.paidAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });

      doc
        .fontSize(16)
        .font('Helvetica-Bold')
        .fillColor(brandColor)
        .text('OFFICIAL RECEIPT', 380, 50, { align: 'right' });

      doc
        .fontSize(9)
        .font('Helvetica')
        .fillColor(mutedColor)
        .text(`Receipt #: REC-${data.invoice.invoiceNumber}`, 380, 70, { align: 'right' })
        .text(`Payment Date: ${formattedPaidDate}`, 380, 82, { align: 'right' })
        .text(`Status: COMPLETED / PAID`, 380, 94, { align: 'right' });

      // Horizontal Divider
      doc
        .moveTo(50, 112)
        .lineTo(545, 112)
        .lineWidth(1)
        .strokeColor('#e2e8f0')
        .stroke();

      // 2. Client & Payment Information Grid
      const infoTop = 125;

      // Left Column: Billed To
      doc
        .fontSize(10)
        .font('Helvetica-Bold')
        .fillColor(primaryColor)
        .text('BILLED TO:', 50, infoTop);

      doc
        .fontSize(10)
        .font('Helvetica-Bold')
        .fillColor('#0f172a')
        .text(data.client.name, 50, infoTop + 16);

      if (data.client.companyName) {
        doc
          .fontSize(9)
          .font('Helvetica')
          .fillColor(mutedColor)
          .text(data.client.companyName, 50, infoTop + 30);
      }

      doc
        .fontSize(9)
        .font('Helvetica')
        .fillColor(mutedColor)
        .text(data.client.email, 50, infoTop + 44);

      if (data.client.phone) {
        doc.text(data.client.phone, 50, infoTop + 56);
      }

      // Right Column: Payment Details
      doc
        .fontSize(10)
        .font('Helvetica-Bold')
        .fillColor(primaryColor)
        .text('TRANSACTION DETAILS:', 330, infoTop);

      doc
        .fontSize(9)
        .font('Helvetica')
        .fillColor(mutedColor)
        .text(`Invoice Reference: ${data.invoice.invoiceNumber}`, 330, infoTop + 16)
        .text(`Payment Gateway: Stripe Checkout`, 330, infoTop + 28)
        .text(
          `Transaction ID: ${data.paymentDetails.transactionId || 'pi_simulated_success'}`,
          330,
          infoTop + 40
        )
        .text(`Currency: ${data.paymentDetails.currency.toUpperCase()}`, 330, infoTop + 52);

      // 3. Prominent PAID Stamp
      doc.save();
      const stampX = 380;
      const stampY = 195;
      doc.rotate(-12, { origin: [stampX, stampY] });

      // Double-bordered rubber stamp effect in emerald green
      doc
        .roundedRect(stampX - 10, stampY - 10, 150, 52, 6)
        .lineWidth(2.5)
        .strokeColor(accentGreen)
        .stroke();

      doc
        .roundedRect(stampX - 7, stampY - 7, 144, 46, 4)
        .lineWidth(1)
        .strokeColor(accentGreen)
        .stroke();

      doc
        .fontSize(16)
        .font('Helvetica-Bold')
        .fillColor(accentGreen)
        .text('★ PAID ★', stampX, stampY - 2, { width: 130, align: 'center' });

      doc
        .fontSize(7.5)
        .font('Helvetica-Bold')
        .fillColor(accentGreen)
        .text(formattedPaidDate.toUpperCase(), stampX, stampY + 16, { width: 130, align: 'center' })
        .text('VERIFIED BY NEXUS', stampX, stampY + 25, { width: 130, align: 'center' });

      doc.restore();

      // 4. Line Items Table
      const tableTop = 270;

      // Table Header Row
      doc
        .rect(50, tableTop, 495, 22)
        .fill('#f8fafc');

      doc
        .fontSize(9)
        .font('Helvetica-Bold')
        .fillColor('#334155')
        .text('ITEM DESCRIPTION', 60, tableTop + 6)
        .text('QTY', 330, tableTop + 6, { width: 40, align: 'right' })
        .text('UNIT PRICE', 385, tableTop + 6, { width: 65, align: 'right' })
        .text('AMOUNT', 465, tableTop + 6, { width: 70, align: 'right' });

      doc
        .moveTo(50, tableTop + 22)
        .lineTo(545, tableTop + 22)
        .lineWidth(1)
        .strokeColor('#cbd5e1')
        .stroke();

      // Table Rows
      let currentY = tableTop + 28;

      data.invoice.items.forEach((item, index) => {
        if (index % 2 === 1) {
          doc.rect(50, currentY - 4, 495, 20).fill('#f8fafc');
        }

        doc
          .fontSize(9)
          .font('Helvetica')
          .fillColor('#1e293b')
          .text(item.description, 60, currentY, { width: 260 })
          .text(String(item.quantity), 330, currentY, { width: 40, align: 'right' })
          .text(
            `${data.invoice.currency} ${item.unitPrice.toFixed(2)}`,
            385,
            currentY,
            { width: 65, align: 'right' }
          )
          .text(
            `${data.invoice.currency} ${item.amount.toFixed(2)}`,
            465,
            currentY,
            { width: 70, align: 'right' }
          );

        currentY += 22;
      });

      doc
        .moveTo(50, currentY + 6)
        .lineTo(545, currentY + 6)
        .lineWidth(1)
        .strokeColor('#cbd5e1')
        .stroke();

      // 5. Financial Summary Box
      const summaryTop = currentY + 16;
      const labelX = 330;
      const valueX = 465;

      doc
        .fontSize(9)
        .font('Helvetica')
        .fillColor(mutedColor)
        .text('Subtotal:', labelX, summaryTop, { width: 120, align: 'right' })
        .font('Helvetica-Bold')
        .fillColor('#1e293b')
        .text(
          `${data.invoice.currency} ${data.invoice.subtotal.toFixed(2)}`,
          valueX,
          summaryTop,
          { width: 70, align: 'right' }
        );

      if (data.invoice.discount > 0) {
        doc
          .fontSize(9)
          .font('Helvetica')
          .fillColor(mutedColor)
          .text('Discount:', labelX, summaryTop + 14, { width: 120, align: 'right' })
          .fillColor('#059669')
          .text(
            `-${data.invoice.currency} ${data.invoice.discount.toFixed(2)}`,
            valueX,
            summaryTop + 14,
            { width: 70, align: 'right' }
          );
      }

      if (data.invoice.taxAmount > 0) {
        doc
          .fontSize(9)
          .font('Helvetica')
          .fillColor(mutedColor)
          .text(`Tax (${data.invoice.taxRate}%):`, labelX, summaryTop + 28, { width: 120, align: 'right' })
          .fillColor('#1e293b')
          .text(
            `${data.invoice.currency} ${data.invoice.taxAmount.toFixed(2)}`,
            valueX,
            summaryTop + 28,
            { width: 70, align: 'right' }
          );
      }

      // Grand Total Paid Banner
      const totalBoxY = summaryTop + 46;
      doc
        .rect(320, totalBoxY, 225, 30)
        .fill('#ecfdf5');

      doc
        .fontSize(10)
        .font('Helvetica-Bold')
        .fillColor('#065f46')
        .text('TOTAL AMOUNT PAID:', 330, totalBoxY + 9, { width: 110, align: 'right' })
        .fontSize(12)
        .text(
          `${data.invoice.currency} ${data.invoice.totalAmount.toFixed(2)}`,
          445,
          totalBoxY + 8,
          { width: 90, align: 'right' }
        );

      // 6. Footer Notes & Compliance Stamp
      doc
        .fontSize(8)
        .font('Helvetica')
        .fillColor(mutedColor)
        .text(
          'This receipt serves as official proof of payment for tax and corporate accounting purposes.',
          50,
          720,
          { align: 'center', width: 495 }
        )
        .text(
          'Nexus Corporate Technologies Inc. · www.nexuscorporate.com · 24/7 Corporate Billing Support',
          50,
          732,
          { align: 'center', width: 495 }
        );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
