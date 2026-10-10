import mongoose, { Document, Model, Schema } from 'mongoose';

export type InvoiceStatus = 'draft' | 'pending' | 'paid' | 'overdue' | 'cancelled';

export interface IInvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface IInvoice extends Document {
  _id: mongoose.Types.ObjectId;
  invoiceNumber: string;
  client: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  items: IInvoiceItem[];
  subtotal: number;
  taxRate: number; // percentage (e.g. 10 for 10%)
  taxAmount: number;
  discount: number;
  totalAmount: number;
  currency: string;
  status: InvoiceStatus;
  issueDate: Date;
  dueDate: Date;
  paidAt?: Date;
  notes?: string;
  paymentTerms?: string;
  // Stripe & Payment Fields
  stripeSessionId?: string;
  stripePaymentIntentId?: string;
  paymentError?: string;
  // Receipt Tracking Fields
  receiptUrl?: string;
  receiptGeneratedAt?: Date;
  receiptSentAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const invoiceItemSchema = new Schema<IInvoiceItem>(
  {
    description: {
      type: String,
      required: [true, 'Item description is required'],
      trim: true,
      maxlength: [200, 'Description cannot exceed 200 characters'],
    },
    quantity: {
      type: Number,
      required: [true, 'Item quantity is required'],
      min: [1, 'Quantity must be at least 1'],
    },
    unitPrice: {
      type: Number,
      required: [true, 'Unit price is required'],
      min: [0, 'Unit price cannot be negative'],
    },
    amount: {
      type: Number,
      required: true,
      default: 0,
    },
  },
  { _id: false }
);

const invoiceSchema = new Schema<IInvoice>(
  {
    invoiceNumber: {
      type: String,
      required: [true, 'Invoice number is required'],
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    client: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Client ID is required'],
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Creator ID is required'],
      index: true,
    },
    items: {
      type: [invoiceItemSchema],
      required: [true, 'Invoice items are required'],
      validate: {
        validator: (v: IInvoiceItem[]) => Array.isArray(v) && v.length > 0,
        message: 'An invoice must contain at least one line item',
      },
    },
    subtotal: {
      type: Number,
      required: true,
      min: [0, 'Subtotal cannot be negative'],
      default: 0,
    },
    taxRate: {
      type: Number,
      default: 0,
      min: [0, 'Tax rate cannot be negative'],
      max: [100, 'Tax rate cannot exceed 100%'],
    },
    taxAmount: {
      type: Number,
      default: 0,
      min: [0, 'Tax amount cannot be negative'],
    },
    discount: {
      type: Number,
      default: 0,
      min: [0, 'Discount cannot be negative'],
    },
    totalAmount: {
      type: Number,
      required: true,
      min: [0, 'Total amount cannot be negative'],
      default: 0,
    },
    currency: {
      type: String,
      default: 'USD',
      uppercase: true,
      trim: true,
      maxlength: 3,
    },
    status: {
      type: String,
      enum: {
        values: ['draft', 'pending', 'paid', 'overdue', 'cancelled'],
        message: 'Status must be draft, pending, paid, overdue, or cancelled',
      },
      default: 'pending',
      index: true,
    },
    issueDate: {
      type: Date,
      default: Date.now,
    },
    dueDate: {
      type: Date,
      required: [true, 'Due date is required'],
      index: true,
    },
    paidAt: {
      type: Date,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [1000, 'Notes cannot exceed 1000 characters'],
    },
    paymentTerms: {
      type: String,
      trim: true,
      default: 'Due upon receipt',
      maxlength: [100, 'Payment terms cannot exceed 100 characters'],
    },
    // Stripe Payment & Receipt Tracking
    stripeSessionId: {
      type: String,
      sparse: true,
      index: true,
    },
    stripePaymentIntentId: {
      type: String,
      sparse: true,
      index: true,
    },
    paymentError: {
      type: String,
    },
    receiptUrl: {
      type: String,
    },
    receiptGeneratedAt: {
      type: Date,
    },
    receiptSentAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: Record<string, any>) => {
        delete ret.__v;
        return ret;
      },
    },
    toObject: {
      virtuals: true,
      transform: (_doc, ret: Record<string, any>) => {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Pre-validate hook to calculate line items, subtotal, tax and total
invoiceSchema.pre('validate', function () {
  if (this.items && this.items.length > 0) {
    let subtotalCalc = 0;

    this.items.forEach((item) => {
      item.amount = Number((item.quantity * item.unitPrice).toFixed(2));
      subtotalCalc += item.amount;
    });

    this.subtotal = Number(subtotalCalc.toFixed(2));

    const discountedSubtotal = Math.max(0, this.subtotal - (this.discount || 0));
    const taxRate = this.taxRate || 0;
    this.taxAmount = Number(((discountedSubtotal * taxRate) / 100).toFixed(2));
    this.totalAmount = Number((discountedSubtotal + this.taxAmount).toFixed(2));
  }

  // Auto-generate invoice number if not set
  if (!this.invoiceNumber) {
    const year = new Date().getFullYear();
    const randomHex = Math.floor(100000 + Math.random() * 900000);
    this.invoiceNumber = `INV-${year}-${randomHex}`;
  }
});

export const Invoice: Model<IInvoice> =
  mongoose.models.Invoice || mongoose.model<IInvoice>('Invoice', invoiceSchema);
