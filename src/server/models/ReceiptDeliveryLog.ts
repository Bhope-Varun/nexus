import mongoose, { Document, Model, Schema } from 'mongoose';

export type ReceiptDeliveryStatus =
  | 'pending'
  | 'pdf_generated'
  | 'email_sent'
  | 'failed';

export interface IReceiptDeliveryLog extends Document {
  _id: mongoose.Types.ObjectId;
  invoiceId: mongoose.Types.ObjectId;
  status: ReceiptDeliveryStatus;
  pdfPath?: string;
  emailRecipient: string;
  emailSentAt?: Date;
  attempts: number;
  lastError?: string;
  createdAt: Date;
  updatedAt: Date;
}

const receiptDeliveryLogSchema = new Schema<IReceiptDeliveryLog>(
  {
    invoiceId: {
      type: Schema.Types.ObjectId,
      ref: 'Invoice',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'pdf_generated', 'email_sent', 'failed'],
      default: 'pending',
      index: true,
    },
    pdfPath: {
      type: String,
    },
    emailRecipient: {
      type: String,
      required: true,
      trim: true,
    },
    emailSentAt: {
      type: Date,
    },
    attempts: {
      type: Number,
      default: 0,
    },
    lastError: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

export const ReceiptDeliveryLog: Model<IReceiptDeliveryLog> =
  mongoose.models.ReceiptDeliveryLog ||
  mongoose.model<IReceiptDeliveryLog>(
    'ReceiptDeliveryLog',
    receiptDeliveryLogSchema
  );
