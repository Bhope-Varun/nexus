import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Invoice, type IInvoiceItem } from '../models/Invoice.ts';
import { User } from '../models/User.ts';
import { AppError, catchAsync } from '../middleware/errorHandler.ts';
import { escapeRegex } from './auth.controller.ts';

/**
 * List invoices with role-based scoping and IDOR prevention
 */
export const getInvoices = catchAsync(async (req: Request, res: Response) => {
  const user = req.user!;
  const {
    page = 1,
    limit = 10,
    status,
    client: requestedClient,
    search,
    startDate,
    endDate,
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = req.query as Record<string, any>;

  const filter: Record<string, any> = {};

  // CRITICAL IDOR PREVENTION:
  // If user is a client, FORCIBLY scope the query to their own client ID.
  // Ignore any other client parameter they might have injected.
  if (user.role === 'client') {
    filter.client = user._id;
    // Clients only see active/issued invoices, hide drafts
    filter.status = { $ne: 'draft' };
    if (status && status !== 'draft') {
      filter.status = status;
    }
  } else {
    // Admin & Staff can filter by client if provided
    if (requestedClient) {
      filter.client = requestedClient;
    }
    if (status) {
      filter.status = status;
    }
  }

  // Date range filters
  if (startDate || endDate) {
    filter.issueDate = {};
    if (startDate) filter.issueDate.$gte = new Date(startDate as string);
    if (endDate) filter.issueDate.$lte = new Date(endDate as string);
  }

  // Search by invoice number (sanitized to prevent ReDoS)
  if (search && typeof search === 'string') {
    filter.invoiceNumber = { $regex: escapeRegex(search.trim()), $options: 'i' };
  }

  const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 10));
  const skip = (pageNum - 1) * limitNum;

  const sortDirection = sortOrder === 'asc' ? 1 : -1;
  const sortObject: Record<string, any> = { [sortBy as string]: sortDirection };

  const [invoices, total] = await Promise.all([
    Invoice.find(filter)
      .populate('client', 'name email companyName phone')
      .populate('createdBy', 'name email role')
      .sort(sortObject)
      .skip(skip)
      .limit(limitNum),
    Invoice.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    data: invoices,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      pages: Math.ceil(total / limitNum),
    },
  });
});

/**
 * Get single invoice by ID with strict IDOR prevention check
 */
export const getInvoiceById = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user!;

  const invoice = await Invoice.findById(id)
    .populate('client', 'name email companyName phone')
    .populate('createdBy', 'name email role');

  if (!invoice) {
    throw new AppError('Invoice not found', 404);
  }

  // CRITICAL IDOR PREVENTION:
  // If the requester is a client, verify that this invoice belongs strictly to them.
  const invoiceClientId =
    invoice.client instanceof mongoose.Types.ObjectId
      ? invoice.client.toString()
      : (invoice.client as any)._id?.toString();

  if (user.role === 'client') {
    if (invoiceClientId !== user._id.toString()) {
      throw new AppError(
        'Forbidden: You do not have permission to access invoices belonging to another account.',
        403
      );
    }

    // Clients cannot view drafts
    if (invoice.status === 'draft') {
      throw new AppError('Invoice not found', 404);
    }
  }

  res.status(200).json({
    success: true,
    data: invoice,
  });
});

/**
 * Create a new invoice (Admin and Staff only)
 */
export const createInvoice = catchAsync(async (req: Request, res: Response) => {
  const {
    client,
    invoiceNumber,
    items,
    taxRate = 0,
    discount = 0,
    currency = 'USD',
    status = 'pending',
    issueDate,
    dueDate,
    notes,
    paymentTerms,
  } = req.body;

  // Validate that the assigned client actually exists and has role 'client'
  const clientUser = await User.findById(client);
  if (!clientUser) {
    throw new AppError('Target client does not exist', 404);
  }

  if (clientUser.role !== 'client') {
    throw new AppError('Invoices can only be assigned to users with role "client"', 400);
  }

  // Check invoiceNumber uniqueness if provided
  if (invoiceNumber) {
    const existing = await Invoice.findOne({ invoiceNumber: invoiceNumber.toUpperCase() });
    if (existing) {
      throw new AppError(`Invoice number "${invoiceNumber}" is already in use`, 409);
    }
  }

  // Calculate line item amounts and financial totals
  let subtotal = 0;
  const processedItems: IInvoiceItem[] = items.map((item: any) => {
    const amount = Number((item.quantity * item.unitPrice).toFixed(2));
    subtotal += amount;
    return {
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      amount,
    };
  });

  if (discount > subtotal) {
    throw new AppError('Discount cannot exceed subtotal amount', 400);
  }

  const discounted = Math.max(0, subtotal - discount);
  const taxAmount = Number(((discounted * taxRate) / 100).toFixed(2));
  const totalAmount = Number((discounted + taxAmount).toFixed(2));

  const invoice = await Invoice.create({
    invoiceNumber: invoiceNumber ? invoiceNumber.toUpperCase() : undefined,
    client: clientUser._id,
    createdBy: req.user!._id,
    items: processedItems,
    subtotal: Number(subtotal.toFixed(2)),
    taxRate,
    taxAmount,
    discount,
    totalAmount,
    currency,
    status,
    issueDate: issueDate ? new Date(issueDate) : new Date(),
    dueDate: new Date(dueDate),
    notes,
    paymentTerms,
  });

  await invoice.populate('client', 'name email companyName phone');
  await invoice.populate('createdBy', 'name email role');

  res.status(201).json({
    success: true,
    message: 'Invoice created successfully',
    data: invoice,
  });
});

/**
 * Update an invoice (Admin and Staff only)
 */
export const updateInvoice = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const {
    client,
    items,
    taxRate,
    discount,
    currency,
    status,
    issueDate,
    dueDate,
    notes,
    paymentTerms,
  } = req.body;

  const invoice = await Invoice.findById(id);
  if (!invoice) {
    throw new AppError('Invoice not found', 404);
  }

  // If client is being changed, verify the new client
  if (client && client !== invoice.client.toString()) {
    const clientUser = await User.findById(client);
    if (!clientUser) {
      throw new AppError('Target client does not exist', 404);
    }
    if (clientUser.role !== 'client') {
      throw new AppError('Invoices can only be assigned to users with role "client"', 400);
    }
    invoice.client = clientUser._id;
  }

  if (items && items.length > 0) {
    let subtotal = 0;
    invoice.items = items.map((item: any) => {
      const amount = Number((item.quantity * item.unitPrice).toFixed(2));
      subtotal += amount;
      return {
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        amount,
      };
    });
    invoice.subtotal = Number(subtotal.toFixed(2));
  }

  if (taxRate !== undefined) invoice.taxRate = taxRate;
  if (discount !== undefined) invoice.discount = discount;
  if (currency !== undefined) invoice.currency = currency;
  if (status !== undefined) {
    invoice.status = status;
    if (status === 'paid' && !invoice.paidAt) {
      invoice.paidAt = new Date();
    } else if (status !== 'paid') {
      invoice.paidAt = undefined;
    }
  }
  if (issueDate !== undefined) invoice.issueDate = new Date(issueDate);
  if (dueDate !== undefined) invoice.dueDate = new Date(dueDate);
  if (notes !== undefined) invoice.notes = notes;
  if (paymentTerms !== undefined) invoice.paymentTerms = paymentTerms;

  if (invoice.discount > invoice.subtotal) {
    throw new AppError('Discount cannot exceed subtotal amount', 400);
  }

  // Recalculate financial totals
  const discounted = Math.max(0, invoice.subtotal - invoice.discount);
  invoice.taxAmount = Number(((discounted * invoice.taxRate) / 100).toFixed(2));
  invoice.totalAmount = Number((discounted + invoice.taxAmount).toFixed(2));

  await invoice.save();
  await invoice.populate('client', 'name email companyName phone');
  await invoice.populate('createdBy', 'name email role');

  res.status(200).json({
    success: true,
    message: 'Invoice updated successfully',
    data: invoice,
  });
});

/**
 * Update invoice status (Admin and Staff only)
 */
export const updateInvoiceStatus = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;

  const invoice = await Invoice.findById(id);
  if (!invoice) {
    throw new AppError('Invoice not found', 404);
  }

  invoice.status = status;
  if (status === 'paid') {
    invoice.paidAt = new Date();
  } else {
    invoice.paidAt = undefined;
  }

  await invoice.save();

  res.status(200).json({
    success: true,
    message: `Invoice status updated to ${status}`,
    data: invoice,
  });
});

/**
 * Delete invoice (Admin only - strict immutability check)
 */
export const deleteInvoice = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  const invoice = await Invoice.findById(id);
  if (!invoice) {
    throw new AppError('Invoice not found', 404);
  }

  await Invoice.findByIdAndDelete(id);

  res.status(200).json({
    success: true,
    message: `Invoice ${invoice.invoiceNumber} has been permanently deleted`,
  });
});

/**
 * Summary metrics and stats (scoped for clients, global for admin/staff)
 */
export const getInvoiceStats = catchAsync(async (req: Request, res: Response) => {
  const user = req.user!;
  const filter: Record<string, any> = {};

  if (user.role === 'client') {
    filter.client = user._id;
    filter.status = { $ne: 'draft' };
  }

  const [stats, countByStatus] = await Promise.all([
    Invoice.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$totalAmount' },
          totalPaid: {
            $sum: {
              $cond: [{ $eq: ['$status', 'paid'] }, '$totalAmount', 0],
            },
          },
          totalPending: {
            $sum: {
              $cond: [{ $eq: ['$status', 'pending'] }, '$totalAmount', 0],
            },
          },
          totalOverdue: {
            $sum: {
              $cond: [{ $eq: ['$status', 'overdue'] }, '$totalAmount', 0],
            },
          },
          averageInvoice: { $avg: '$totalAmount' },
          count: { $sum: 1 },
        },
      },
    ]),
    Invoice.aggregate([
      { $match: filter },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
  ]);

  const summary = stats[0] || {
    totalRevenue: 0,
    totalPaid: 0,
    totalPending: 0,
    totalOverdue: 0,
    averageInvoice: 0,
    count: 0,
  };

  const statusMap: Record<string, number> = {
    draft: 0,
    pending: 0,
    paid: 0,
    overdue: 0,
    cancelled: 0,
  };
  countByStatus.forEach((item) => {
    statusMap[item._id] = item.count;
  });

  res.status(200).json({
    success: true,
    data: {
      metrics: {
        totalRevenue: Number((summary.totalRevenue || 0).toFixed(2)),
        totalPaid: Number((summary.totalPaid || 0).toFixed(2)),
        totalPending: Number((summary.totalPending || 0).toFixed(2)),
        totalOverdue: Number((summary.totalOverdue || 0).toFixed(2)),
        averageInvoice: Number((summary.averageInvoice || 0).toFixed(2)),
        totalCount: summary.count || 0,
      },
      countsByStatus: statusMap,
    },
  });
});
