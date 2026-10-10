import { User } from '../models/User.ts';
import { Invoice } from '../models/Invoice.ts';
import { generateReceiptPdf } from '../services/pdf.service.ts';
import { getStorageService } from '../services/storage.service.ts';

export async function seedInitialData(): Promise<void> {
  try {
    const adminExists = await User.findOne({ email: 'admin@nexus.com' });
    let admin = adminExists;

    if (!adminExists) {
      console.log('[Seed] Seeding default administrator account: admin@nexus.com');
      admin = await User.create({
        name: 'Nexus Administrator',
        email: 'admin@nexus.com',
        password: 'AdminPass123!',
        role: 'admin',
        companyName: 'Nexus Corporate Technologies',
      });
    }

    const clientExists = await User.findOne({ email: 'client@nexus.com' });
    let client = clientExists;

    if (!clientExists) {
      console.log('[Seed] Seeding default client account: client@nexus.com');
      client = await User.create({
        name: 'Alex Rivera',
        email: 'client@nexus.com',
        password: 'ClientPass123!',
        role: 'client',
        companyName: 'Acme Global Technologies Inc.',
        phone: '+1 (555) 234-5678',
      });
    }

    const staffExists = await User.findOne({ email: 'staff@nexus.com' });
    if (!staffExists) {
      await User.create({
        name: 'Sarah Connor',
        email: 'staff@nexus.com',
        password: 'StaffPass123!',
        role: 'staff',
        companyName: 'Nexus Corporate Operations',
      });
    }

    // Seed sample invoices for client if none exist
    if (client && admin) {
      const invoiceCount = await Invoice.countDocuments({ client: client._id });
      if (invoiceCount === 0) {
        console.log('[Seed] Seeding sample invoices for client@nexus.com');

        // 1. Paid Invoice with Generated Receipt
        const paidInvoice = await Invoice.create({
          invoiceNumber: 'INV-2026-0001',
          client: client._id,
          createdBy: admin._id,
          status: 'paid',
          currency: 'USD',
          taxRate: 10,
          discount: 100,
          issueDate: new Date(Date.now() - 86400000 * 7),
          dueDate: new Date(Date.now() + 86400000 * 14),
          paidAt: new Date(Date.now() - 86400000 * 3),
          stripePaymentIntentId: 'pi_3PseedSamplePaid12345',
          items: [
            { description: 'Cloud Architecture & Zero-Trust Infrastructure', quantity: 1, unitPrice: 3500 },
            { description: 'Enterprise Portal Multi-Tenant Licensing', quantity: 1, unitPrice: 1500 },
          ],
        });

        // Generate and save receipt PDF
        try {
          const storage = getStorageService();
          const filename = `Receipt-${paidInvoice.invoiceNumber}.pdf`;
          const pdfBuffer = await generateReceiptPdf({
            invoice: paidInvoice,
            client,
            paymentDetails: {
              transactionId: paidInvoice.stripePaymentIntentId,
              paidAt: paidInvoice.paidAt!,
              amountPaid: paidInvoice.totalAmount,
              currency: paidInvoice.currency,
            },
          });
          const storageRes = await storage.save(filename, pdfBuffer);
          paidInvoice.receiptUrl = storageRes.url;
          paidInvoice.receiptGeneratedAt = new Date();
          await paidInvoice.save();
        } catch (err: any) {
          console.warn('[Seed] Receipt PDF generation note:', err.message);
        }

        // 2. Pending Invoice ready for Stripe Checkout
        await Invoice.create({
          invoiceNumber: 'INV-2026-0002',
          client: client._id,
          createdBy: admin._id,
          status: 'pending',
          currency: 'USD',
          taxRate: 8,
          discount: 0,
          issueDate: new Date(),
          dueDate: new Date(Date.now() + 86400000 * 14),
          paymentTerms: 'Net 14',
          items: [
            { description: 'Quarterly Infrastructure Retainer (Q4)', quantity: 1, unitPrice: 2200 },
            { description: 'Continuous Compliance & IDOR Auditing', quantity: 1, unitPrice: 800 },
          ],
        });

        // 3. Draft Invoice
        await Invoice.create({
          invoiceNumber: 'INV-2026-0003',
          client: client._id,
          createdBy: admin._id,
          status: 'draft',
          currency: 'USD',
          taxRate: 10,
          discount: 50,
          issueDate: new Date(),
          dueDate: new Date(Date.now() + 86400000 * 30),
          items: [
            { description: 'Custom Payment Integration Services', quantity: 5, unitPrice: 200 },
          ],
        });

        console.log('[Seed] Sample invoices created successfully.');
      }
    }
  } catch (err: any) {
    console.warn('[Seed] Notice during seed check:', err.message);
  }
}
