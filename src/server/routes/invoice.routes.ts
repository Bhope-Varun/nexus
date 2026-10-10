import { Router } from 'express';
import {
  getInvoices,
  getInvoiceById,
  createInvoice,
  updateInvoice,
  updateInvoiceStatus,
  deleteInvoice,
  getInvoiceStats,
} from '../controllers/invoice.controller.ts';
import { retryReceiptDelivery } from '../controllers/payment.controller.ts';
import { authenticateToken, requireRoles } from '../middleware/auth.ts';
import { validate } from '../middleware/validate.ts';
import {
  createInvoiceSchema,
  updateInvoiceSchema,
  updateInvoiceStatusSchema,
  queryInvoiceSchema,
  idParamSchema,
} from '../validators/invoice.validator.ts';

const router = Router();

// All invoice routes require authentication
router.use(authenticateToken);

// Invoice summary & metrics (client-scoped or global)
router.get('/stats', getInvoiceStats);

// List invoices (automatically scoped by client or queryable by admin/staff)
router.get('/', validate({ query: queryInvoiceSchema }), getInvoices);

// Get single invoice (with strict IDOR ownership check for clients)
router.get('/:id', validate({ params: idParamSchema }), getInvoiceById);

// Create invoice (Admin & Staff only)
router.post(
  '/',
  requireRoles('admin', 'staff'),
  validate({ body: createInvoiceSchema }),
  createInvoice
);

// Update invoice (Admin & Staff only)
router.put(
  '/:id',
  requireRoles('admin', 'staff'),
  validate({ params: idParamSchema, body: updateInvoiceSchema }),
  updateInvoice
);

router.patch(
  '/:id',
  requireRoles('admin', 'staff'),
  validate({ params: idParamSchema, body: updateInvoiceSchema }),
  updateInvoice
);

// Update invoice status (Admin & Staff only)
router.patch(
  '/:id/status',
  requireRoles('admin', 'staff'),
  validate({ params: idParamSchema, body: updateInvoiceStatusSchema }),
  updateInvoiceStatus
);

// Delete invoice (Admin only for financial immutability)
router.delete(
  '/:id',
  requireRoles('admin'),
  validate({ params: idParamSchema }),
  deleteInvoice
);

// Resend / Retry Receipt Delivery (Authenticated & IDOR protected)
router.post(
  '/:id/receipt/resend',
  validate({ params: idParamSchema }),
  retryReceiptDelivery
);

export default router;
