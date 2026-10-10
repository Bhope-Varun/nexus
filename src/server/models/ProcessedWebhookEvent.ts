import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IProcessedWebhookEvent extends Document {
  _id: mongoose.Types.ObjectId;
  eventId: string;
  eventType: string;
  invoiceId?: mongoose.Types.ObjectId;
  status: 'processed' | 'ignored' | 'failed';
  details?: Record<string, any>;
  processedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const processedWebhookEventSchema = new Schema<IProcessedWebhookEvent>(
  {
    eventId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    eventType: {
      type: String,
      required: true,
      index: true,
    },
    invoiceId: {
      type: Schema.Types.ObjectId,
      ref: 'Invoice',
      index: true,
    },
    status: {
      type: String,
      enum: ['processed', 'ignored', 'failed'],
      default: 'processed',
    },
    details: {
      type: Schema.Types.Mixed,
    },
    processedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

export const ProcessedWebhookEvent: Model<IProcessedWebhookEvent> =
  mongoose.models.ProcessedWebhookEvent ||
  mongoose.model<IProcessedWebhookEvent>(
    'ProcessedWebhookEvent',
    processedWebhookEventSchema
  );
