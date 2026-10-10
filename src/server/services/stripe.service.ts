import Stripe from 'stripe';
import { config } from '../config/env.ts';
import type { IInvoice } from '../models/Invoice.ts';
import type { IUser } from '../models/User.ts';
import { AppError } from '../middleware/errorHandler.ts';

export const stripe = new Stripe(config.stripeSecretKey, {
  apiVersion: '2025-02-24.acacia' as any,
  typescript: true,
});

export async function createInvoiceCheckoutSession(
  invoice: IInvoice,
  client: IUser
): Promise<Stripe.Checkout.Session> {
  // Amount in smallest currency unit (e.g. cents for USD)
  const amountInCents = Math.round(invoice.totalAmount * 100);

  if (amountInCents < 50) {
    throw new AppError('Invoice amount must be at least 0.50 to create a payment session', 400);
  }

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
    {
      price_data: {
        currency: invoice.currency.toLowerCase(),
        product_data: {
          name: `Invoice #${invoice.invoiceNumber}`,
          description: `Nexus Corporate Invoice #${invoice.invoiceNumber} payment for ${client.companyName || client.name}`,
        },
        unit_amount: amountInCents,
      },
      quantity: 1,
    },
  ];

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: 'payment',
    customer_email: client.email,
    client_reference_id: invoice._id.toString(),
    line_items: lineItems,
    metadata: {
      invoiceId: invoice._id.toString(),
      invoiceNumber: invoice.invoiceNumber,
      clientId: client._id.toString(),
      expectedAmountCents: String(amountInCents),
      expectedCurrency: invoice.currency.toLowerCase(),
    },
    success_url: `${config.appUrl}/payment-success?session_id={CHECKOUT_SESSION_ID}&invoice_id=${invoice._id}`,
    cancel_url: `${config.appUrl}/payment-cancelled?invoice_id=${invoice._id}`,
  };

  const session = await stripe.checkout.sessions.create(sessionParams);
  return session;
}

export function verifyWebhookSignature(
  rawBody: Buffer | string,
  signature: string,
  webhookSecret?: string
): Stripe.Event {
  const secret = webhookSecret || config.stripeWebhookSecret;
  return stripe.webhooks.constructEvent(rawBody, signature, secret);
}
