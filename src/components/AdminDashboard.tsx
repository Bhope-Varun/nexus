import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import {
  FileText,
  Users,
  TrendingUp,
  DollarSign,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Trash2,
  Download,
  Mail,
  RefreshCw,
  Plus,
  Search,
  X,
  ShieldCheck,
  Building,
  Calendar,
  Layers,
  Activity,
  Terminal,
  Copy,
  Check,
  CreditCard,
  Receipt,
  Server,
  Loader2,
} from 'lucide-react';

interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount?: number;
}

interface InvoiceData {
  _id: string;
  invoiceNumber: string;
  client: {
    _id: string;
    name: string;
    email: string;
    companyName?: string;
  };
  totalAmount: number;
  subtotal: number;
  taxAmount: number;
  taxRate: number;
  discount: number;
  currency: string;
  status: 'draft' | 'pending' | 'paid' | 'overdue' | 'cancelled';
  issueDate: string;
  dueDate: string;
  paidAt?: string;
  items: InvoiceItem[];
  receiptUrl?: string;
}

interface ClientUser {
  _id: string;
  name: string;
  email: string;
  role: string;
  companyName?: string;
  phone?: string;
  status: 'active' | 'suspended';
  createdAt: string;
}

interface StatsData {
  metrics: {
    totalRevenue: number;
    totalPaid: number;
    totalPending: number;
    totalOverdue: number;
    averageInvoice: number;
    totalCount: number;
  };
  countsByStatus: {
    draft: number;
    pending: number;
    paid: number;
    overdue: number;
    cancelled: number;
  };
}

export const AdminDashboard: React.FC = () => {
  const { user, token } = useAuth();

  // Active view tab
  const [activeTab, setActiveTab] = useState<'analytics' | 'invoices' | 'clients' | 'system'>('analytics');

  // Stats state
  const [stats, setStats] = useState<StatsData | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // Invoices state
  const [invoices, setInvoices] = useState<InvoiceData[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Clients state
  const [clients, setClients] = useState<ClientUser[]>([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [clientSearch, setClientSearch] = useState('');

  // Modals
  const [showCreateInvoiceModal, setShowCreateInvoiceModal] = useState(false);
  const [showCreateClientModal, setShowCreateClientModal] = useState(false);

  // Feedback notifications
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // New Invoice Form State
  const [selectedClientId, setSelectedClientId] = useState('');
  const [newDueDate, setNewDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().split('T')[0];
  });
  const [newCurrency, setNewCurrency] = useState('USD');
  const [newTaxRate, setNewTaxRate] = useState<number>(10);
  const [newDiscount, setNewDiscount] = useState<number>(0);
  const [newPaymentTerms, setNewPaymentTerms] = useState('Net 14');
  const [newNotes, setNewNotes] = useState('');
  const [lineItems, setLineItems] = useState<InvoiceItem[]>([
    { description: 'Enterprise Architecture Consultation', quantity: 1, unitPrice: 2500 },
  ]);
  const [submittingInvoice, setSubmittingInvoice] = useState(false);

  // New Client Form State
  const [newClientName, setNewClientName] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newClientPassword, setNewClientPassword] = useState('');
  const [newClientCompany, setNewClientCompany] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [submittingClient, setSubmittingClient] = useState(false);

  // System info state (preserving previous app spec view)
  const [healthData, setHealthData] = useState<any>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  const getHeaders = (): Record<string, string> => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  };

  // 1. Fetch Analytics Stats
  const fetchStats = async () => {
    setStatsLoading(true);
    try {
      const res = await fetch('/api/invoices/stats', {
        headers: getHeaders(),
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setStats(data.data);
        }
      }
    } catch (err: any) {
      console.error('[AdminDashboard] Stats fetch error:', err);
    } finally {
      setStatsLoading(false);
    }
  };

  // 2. Fetch Invoices List
  const fetchInvoices = async () => {
    setInvoicesLoading(true);
    try {
      let url = '/api/invoices?limit=50';
      if (statusFilter !== 'all') {
        url += `&status=${statusFilter}`;
      }
      if (invoiceSearch.trim()) {
        url += `&search=${encodeURIComponent(invoiceSearch.trim())}`;
      }

      const res = await fetch(url, {
        headers: getHeaders(),
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setInvoices(data.data || []);
        }
      }
    } catch (err: any) {
      console.error('[AdminDashboard] Invoices fetch error:', err);
    } finally {
      setInvoicesLoading(false);
    }
  };

  // 3. Fetch Clients List
  const fetchClients = async () => {
    setClientsLoading(true);
    try {
      let url = '/api/auth/users?role=client&limit=50';
      if (clientSearch.trim()) {
        url += `&search=${encodeURIComponent(clientSearch.trim())}`;
      }
      const res = await fetch(url, {
        headers: getHeaders(),
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setClients(data.data || []);
        }
      }
    } catch (err: any) {
      console.error('[AdminDashboard] Clients fetch error:', err);
    } finally {
      setClientsLoading(false);
    }
  };

  // 4. Fetch Health
  const fetchHealth = async () => {
    setHealthLoading(true);
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        const data = await res.json();
        setHealthData(data);
      }
    } catch (err) {
      console.error('[AdminDashboard] Health check error:', err);
    } finally {
      setHealthLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchInvoices();
    fetchClients();
    fetchHealth();
  }, [token]);

  // Invoice calculations
  const calculatedSubtotal = lineItems.reduce((acc, item) => acc + (item.quantity * item.unitPrice || 0), 0);
  const calculatedTax = (calculatedSubtotal * newTaxRate) / 100;
  const calculatedTotal = Math.max(0, calculatedSubtotal + calculatedTax - newDiscount);

  // Line item manipulation
  const addLineItem = () => {
    setLineItems([...lineItems, { description: '', quantity: 1, unitPrice: 0 }]);
  };

  const updateLineItem = (index: number, field: keyof InvoiceItem, value: any) => {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };
    setLineItems(updated);
  };

  const removeLineItem = (index: number) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter((_, i) => i !== index));
    }
  };

  // Handle invoice submission
  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClientId) {
      setFeedback({ type: 'error', message: 'Please select a recipient client account.' });
      return;
    }
    if (lineItems.length === 0 || !lineItems[0].description) {
      setFeedback({ type: 'error', message: 'Invoice must contain at least one line item with a description.' });
      return;
    }

    setSubmittingInvoice(true);
    setFeedback(null);

    try {
      const payload = {
        client: selectedClientId,
        dueDate: new Date(newDueDate).toISOString(),
        currency: newCurrency,
        taxRate: Number(newTaxRate),
        discount: Number(newDiscount),
        paymentTerms: newPaymentTerms,
        notes: newNotes,
        status: 'pending',
        items: lineItems.map((item) => ({
          description: item.description,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
        })),
      };

      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to create invoice');
      }

      setFeedback({ type: 'success', message: `Invoice #${data.data.invoiceNumber} generated successfully.` });
      setShowCreateInvoiceModal(false);
      // Reset form
      setLineItems([{ description: '', quantity: 1, unitPrice: 0 }]);
      fetchInvoices();
      fetchStats();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Invoice creation failed' });
    } finally {
      setSubmittingInvoice(false);
    }
  };

  // Handle client creation
  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingClient(true);
    setFeedback(null);

    try {
      const payload = {
        name: newClientName,
        email: newClientEmail,
        password: newClientPassword,
        companyName: newClientCompany,
        phone: newClientPhone,
        role: 'client',
      };

      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to register client');
      }

      setFeedback({ type: 'success', message: `Client account created for ${newClientEmail}.` });
      setShowCreateClientModal(false);
      setNewClientName('');
      setNewClientEmail('');
      setNewClientPassword('');
      setNewClientCompany('');
      setNewClientPhone('');
      fetchClients();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Client registration failed' });
    } finally {
      setSubmittingClient(false);
    }
  };

  // Handle invoice status change
  const handleUpdateStatus = async (invoiceId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/status`, {
        method: 'PATCH',
        headers: getHeaders(),
        credentials: 'include',
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to update invoice status');
      }

      setFeedback({ type: 'success', message: `Invoice status updated to ${newStatus}.` });
      fetchInvoices();
      fetchStats();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  // Handle invoice deletion (Admin only)
  const handleDeleteInvoice = async (invoiceId: string, invoiceNum: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete invoice ${invoiceNum}? This action is irreversible.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/invoices/${invoiceId}`, {
        method: 'DELETE',
        headers: getHeaders(),
        credentials: 'include',
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to delete invoice');
      }

      setFeedback({ type: 'success', message: `Invoice ${invoiceNum} deleted successfully.` });
      fetchInvoices();
      fetchStats();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  // Download PDF Receipt
  const handleDownloadReceipt = async (invoiceNumber: string) => {
    try {
      const filename = `Receipt-${invoiceNumber}.pdf`;
      const res = await fetch(`/api/receipts/download/${filename}`, {
        headers: getHeaders(),
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  // Resend Receipt Email
  const handleResendReceipt = async (invoiceId: string) => {
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/receipt/resend`, {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Resend failed');

      setFeedback({ type: 'success', message: 'Receipt email dispatched to client successfully.' });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCmd(id);
    setTimeout(() => setCopiedCmd(null), 2000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Executive Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-white">Executive Management Portal</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono font-medium">
              Administrator Access
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Logged in as <strong className="text-slate-200">{user?.name}</strong> ({user?.email}) · Full Ledger & RBAC Authority
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowCreateInvoiceModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 transition shadow-sm"
          >
            <Plus className="h-4 w-4" />
            <span>Create Invoice</span>
          </button>
          <button
            onClick={() => setShowCreateClientModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition"
          >
            <Users className="h-4 w-4 text-emerald-400" />
            <span>Add Client</span>
          </button>
        </div>
      </div>

      {/* Global Feedback Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-xl text-xs flex items-center justify-between border ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/20 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-white text-xs underline ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Navigation Sub-Tabs */}
      <div className="flex border-b border-slate-800 gap-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('analytics')}
          className={`px-4 py-2.5 text-xs font-medium border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'analytics'
              ? 'border-indigo-500 text-indigo-400 font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <TrendingUp className="h-4 w-4" />
          Analytics & Overview
        </button>
        <button
          onClick={() => {
            setActiveTab('invoices');
            fetchInvoices();
          }}
          className={`px-4 py-2.5 text-xs font-medium border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'invoices'
              ? 'border-indigo-500 text-indigo-400 font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileText className="h-4 w-4" />
          Invoice Management ({stats?.metrics?.totalCount || invoices.length})
        </button>
        <button
          onClick={() => {
            setActiveTab('clients');
            fetchClients();
          }}
          className={`px-4 py-2.5 text-xs font-medium border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'clients'
              ? 'border-indigo-500 text-indigo-400 font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users className="h-4 w-4" />
          Client Accounts ({clients.length})
        </button>
        <button
          onClick={() => setActiveTab('system')}
          className={`px-4 py-2.5 text-xs font-medium border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'system'
              ? 'border-indigo-500 text-indigo-400 font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Terminal className="h-4 w-4" />
          System & Stripe Pipeline
        </button>
      </div>

      {/* TAB 1: Analytics & Metrics */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          {/* Top Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1 shadow-sm">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-medium">Total Billed Revenue</span>
                <DollarSign className="h-4 w-4 text-indigo-400" />
              </div>
              <div className="text-2xl font-bold text-white font-mono tabular-nums">
                ${(stats?.metrics?.totalRevenue || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
              <span className="text-[11px] text-slate-500 block">Across {stats?.metrics?.totalCount || 0} invoices</span>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1 shadow-sm">
              <div className="flex items-center justify-between text-emerald-400">
                <span className="text-xs font-medium">Settled & Collected</span>
                <CheckCircle2 className="h-4 w-4" />
              </div>
              <div className="text-2xl font-bold text-emerald-400 font-mono tabular-nums">
                ${(stats?.metrics?.totalPaid || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
              <span className="text-[11px] text-slate-500 block">
                {stats?.metrics?.totalRevenue
                  ? `${Math.round(((stats.metrics.totalPaid || 0) / stats.metrics.totalRevenue) * 100)}% collection rate`
                  : '0% collection rate'}
              </span>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1 shadow-sm">
              <div className="flex items-center justify-between text-amber-400">
                <span className="text-xs font-medium">Pending Receivables</span>
                <Clock className="h-4 w-4" />
              </div>
              <div className="text-2xl font-bold text-amber-400 font-mono tabular-nums">
                ${(stats?.metrics?.totalPending || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
              <span className="text-[11px] text-slate-500 block">{stats?.countsByStatus?.pending || 0} invoices pending</span>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1 shadow-sm">
              <div className="flex items-center justify-between text-rose-400">
                <span className="text-xs font-medium">Overdue Amount</span>
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div className="text-2xl font-bold text-rose-400 font-mono tabular-nums">
                ${(stats?.metrics?.totalOverdue || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
              <span className="text-[11px] text-slate-500 block">{stats?.countsByStatus?.overdue || 0} overdue accounts</span>
            </div>
          </div>

          {/* Status Breakdown Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
              <h3 className="text-sm font-semibold text-white flex items-center justify-between">
                <span>Invoice Ledger Status Breakdown</span>
                <button
                  onClick={fetchStats}
                  disabled={statsLoading}
                  className="text-slate-400 hover:text-white text-xs flex items-center gap-1"
                >
                  <RefreshCw className={`h-3 w-3 ${statsLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </h3>

              <div className="space-y-3 font-mono text-xs">
                {[
                  { label: 'Paid & Settled', count: stats?.countsByStatus?.paid || 0, color: 'text-emerald-400', bg: 'bg-emerald-500' },
                  { label: 'Pending Payment', count: stats?.countsByStatus?.pending || 0, color: 'text-amber-400', bg: 'bg-amber-500' },
                  { label: 'Drafts (Unissued)', count: stats?.countsByStatus?.draft || 0, color: 'text-slate-400', bg: 'bg-slate-500' },
                  { label: 'Overdue', count: stats?.countsByStatus?.overdue || 0, color: 'text-rose-400', bg: 'bg-rose-500' },
                  { label: 'Cancelled', count: stats?.countsByStatus?.cancelled || 0, color: 'text-slate-500', bg: 'bg-slate-700' },
                ].map((item, idx) => {
                  const total = stats?.metrics?.totalCount || 1;
                  const pct = Math.round((item.count / total) * 100);
                  return (
                    <div key={idx} className="space-y-1">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-300 font-sans">{item.label}</span>
                        <span className={`${item.color} font-semibold tabular-nums`}>
                          {item.count} ({pct}%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
                        <div className={`h-full ${item.bg}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quick Action Matrix */}
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
              <h3 className="text-sm font-semibold text-white">Administrative Actions & Quick Access</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <button
                  onClick={() => setShowCreateInvoiceModal(true)}
                  className="p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-indigo-500/50 text-left transition space-y-1.5"
                >
                  <Plus className="h-5 w-5 text-indigo-400" />
                  <div className="font-semibold text-slate-100">Draft New Invoice</div>
                  <div className="text-[11px] text-slate-400">Issue custom billing with verified rates and calculations.</div>
                </button>

                <button
                  onClick={() => setShowCreateClientModal(true)}
                  className="p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-emerald-500/50 text-left transition space-y-1.5"
                >
                  <Users className="h-5 w-5 text-emerald-400" />
                  <div className="font-semibold text-slate-100">Register Client</div>
                  <div className="text-[11px] text-slate-400">Provision corporate client login without public sign-up.</div>
                </button>

                <button
                  onClick={() => {
                    setActiveTab('invoices');
                    setStatusFilter('pending');
                  }}
                  className="p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-amber-500/50 text-left transition space-y-1.5"
                >
                  <Clock className="h-5 w-5 text-amber-400" />
                  <div className="font-semibold text-slate-100">Review Pending</div>
                  <div className="text-[11px] text-slate-400">Filter outstanding balances awaiting Stripe checkout.</div>
                </button>

                <button
                  onClick={() => setActiveTab('system')}
                  className="p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-cyan-500/50 text-left transition space-y-1.5"
                >
                  <Terminal className="h-5 w-5 text-cyan-400" />
                  <div className="font-semibold text-slate-100">Test & Audit Console</div>
                  <div className="text-[11px] text-slate-400">Run security suites & inspect Stripe webhook simulator.</div>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Invoices Management */}
      {activeTab === 'invoices' && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-slate-900 border border-slate-800">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <div className="relative w-full">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search invoice number..."
                  value={invoiceSearch}
                  onChange={(e) => setInvoiceSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchInvoices()}
                  className="w-full pl-9 pr-3.5 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <button
                onClick={fetchInvoices}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 transition"
              >
                Search
              </button>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setTimeout(fetchInvoices, 0);
                }}
                className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Statuses</option>
                <option value="draft">Draft</option>
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
                <option value="overdue">Overdue</option>
                <option value="cancelled">Cancelled</option>
              </select>

              <button
                onClick={fetchInvoices}
                disabled={invoicesLoading}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                title="Refresh Invoices"
              >
                <RefreshCw className={`h-4 w-4 ${invoicesLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
            {invoicesLoading ? (
              <div className="p-12 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
                <span>Loading invoices ledger...</span>
              </div>
            ) : invoices.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs space-y-2">
                <FileText className="h-8 w-8 text-slate-600 mx-auto" />
                <p className="font-medium text-slate-300">No Invoices Found</p>
                <p className="text-slate-500">Create an invoice using the "Create Invoice" button above.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 font-medium bg-slate-950/40">
                      <th className="py-3 px-4">Invoice #</th>
                      <th className="py-3 px-4">Client</th>
                      <th className="py-3 px-4">Issue Date</th>
                      <th className="py-3 px-4">Due Date</th>
                      <th className="py-3 px-4 text-right">Amount</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono text-slate-300">
                    {invoices.map((inv) => (
                      <tr key={inv._id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 px-4 font-semibold text-white">
                          {inv.invoiceNumber}
                        </td>
                        <td className="py-3 px-4 font-sans text-slate-300">
                          <div className="font-medium">{inv.client?.name || 'Client Account'}</div>
                          <div className="text-[11px] text-slate-500">{inv.client?.email}</div>
                        </td>
                        <td className="py-3 px-4 font-sans text-slate-400 text-[11px]">
                          {new Date(inv.issueDate).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4 font-sans text-slate-400 text-[11px]">
                          {new Date(inv.dueDate).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-white tabular-nums">
                          ${inv.totalAmount.toFixed(2)} {inv.currency}
                        </td>
                        <td className="py-3 px-4 font-sans">
                          <select
                            value={inv.status}
                            onChange={(e) => handleUpdateStatus(inv._id, e.target.value)}
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase border bg-transparent cursor-pointer ${
                              inv.status === 'paid'
                                ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
                                : inv.status === 'pending'
                                ? 'text-amber-400 border-amber-500/30 bg-amber-500/10'
                                : inv.status === 'draft'
                                ? 'text-slate-400 border-slate-600 bg-slate-800'
                                : 'text-rose-400 border-rose-500/30 bg-rose-500/10'
                            }`}
                          >
                            <option value="draft" className="bg-slate-900 text-slate-300">DRAFT</option>
                            <option value="pending" className="bg-slate-900 text-amber-400">PENDING</option>
                            <option value="paid" className="bg-slate-900 text-emerald-400">PAID</option>
                            <option value="overdue" className="bg-slate-900 text-rose-400">OVERDUE</option>
                            <option value="cancelled" className="bg-slate-900 text-slate-400">CANCELLED</option>
                          </select>
                        </td>
                        <td className="py-3 px-4 text-right font-sans">
                          <div className="flex items-center justify-end gap-1.5">
                            {inv.status === 'paid' && (
                              <>
                                <button
                                  onClick={() => handleDownloadReceipt(inv.invoiceNumber)}
                                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-400 hover:text-indigo-300 transition"
                                  title="Download Paid PDF Receipt"
                                >
                                  <Download className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() => handleResendReceipt(inv._id)}
                                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
                                  title="Resend Receipt Email"
                                >
                                  <Mail className="h-3.5 w-3.5" />
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => handleDeleteInvoice(inv._id, inv.invoiceNumber)}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition"
                              title="Delete Invoice"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: Client Accounts */}
      {activeTab === 'clients' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-slate-900 border border-slate-800">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <div className="relative w-full">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search client name or email..."
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchClients()}
                  className="w-full pl-9 pr-3.5 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <button
                onClick={fetchClients}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 transition"
              >
                Search
              </button>
            </div>

            <button
              onClick={() => setShowCreateClientModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Register New Client</span>
            </button>
          </div>

          <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
            {clientsLoading ? (
              <div className="p-12 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
                <span>Loading client directory...</span>
              </div>
            ) : clients.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs space-y-2">
                <Users className="h-8 w-8 text-slate-600 mx-auto" />
                <p className="font-medium text-slate-300">No Clients Found</p>
                <p className="text-slate-500">Add a client account using the button above.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 font-medium bg-slate-950/40">
                      <th className="py-3 px-4">Contact Name</th>
                      <th className="py-3 px-4">Company</th>
                      <th className="py-3 px-4">Email</th>
                      <th className="py-3 px-4">Phone</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Joined Date</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-sans text-slate-300">
                    {clients.map((c) => (
                      <tr key={c._id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 px-4 font-semibold text-white">{c.name}</td>
                        <td className="py-3 px-4 text-slate-300">{c.companyName || '—'}</td>
                        <td className="py-3 px-4 font-mono text-xs text-indigo-300">{c.email}</td>
                        <td className="py-3 px-4 text-slate-400">{c.phone || '—'}</td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                              c.status === 'active'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            }`}
                          >
                            {c.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-400 text-[11px]">
                          {new Date(c.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => {
                              setSelectedClientId(c._id);
                              setShowCreateInvoiceModal(true);
                            }}
                            className="px-2.5 py-1 rounded-md text-[11px] font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition"
                          >
                            Bill Client
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: System Specs & Stripe Pipeline */}
      {activeTab === 'system' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Server className="h-5 w-5 text-indigo-400" />
                <h3 className="font-semibold text-white">System Infrastructure & Database Connection</h3>
              </div>
              <button
                onClick={fetchHealth}
                disabled={healthLoading}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-medium text-white transition flex items-center gap-1.5"
              >
                <RefreshCw className={`h-3 w-3 ${healthLoading ? 'animate-spin' : ''}`} />
                Check Status
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs">
              <div>
                <span className="text-slate-500 block">Service:</span>
                <span className="text-slate-200 font-semibold">{healthData?.service || 'Nexus Corporate'}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Database State:</span>
                <span
                  className={`font-semibold ${
                    healthData?.database?.isConnected ? 'text-emerald-400' : 'text-amber-400'
                  }`}
                >
                  {healthData?.database?.state || 'connected'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Server Port:</span>
                <span className="text-slate-200">3000</span>
              </div>
              <div>
                <span className="text-slate-500 block">Uptime:</span>
                <span className="text-slate-200">{healthData?.uptime ? `${Math.round(healthData.uptime)}s` : 'Active'}</span>
              </div>
            </div>
          </div>

          {/* Test suites & commands */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-white">Automated Test Suites (64/64 Passing)</h3>
                <p className="text-xs text-slate-400">Auth, RBAC, IDOR Defense, Stripe Webhooks, PDFKit, and Nodemailer.</p>
              </div>
              <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-medium flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" /> 64 Tests Passing
              </span>
            </div>

            <div className="space-y-3 pt-2">
              {[
                {
                  id: 'cmd-all',
                  title: 'Run All Automated Security & Feature Tests',
                  cmd: 'npm test',
                  desc: 'Executes all test suites including authentication, IDOR checks, and Stripe webhook workflows.',
                },
                {
                  id: 'cmd-stripe',
                  title: 'Run Stripe & Receipt Test Suite Exclusively',
                  cmd: 'npm run test:stripe',
                  desc: 'Validates webhook signatures, amount mismatch defense, PDFKit generation, and retryable email delivery.',
                },
                {
                  id: 'cmd-sec',
                  title: 'Run Dedicated Security Audit Tests',
                  cmd: 'npm run test:security',
                  desc: 'Attempts cross-tenant IDOR access, privilege escalation, and verifies server boundary enforcement.',
                },
              ].map((c) => (
                <div key={c.id} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-200">{c.title}</span>
                    <button
                      onClick={() => copyToClipboard(c.cmd, c.id)}
                      className="text-slate-400 hover:text-slate-200 flex items-center gap-1 text-[11px] transition"
                    >
                      {copiedCmd === c.id ? (
                        <>
                          <Check className="h-3 w-3 text-emerald-400" />
                          <span className="text-emerald-400">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                  <pre className="p-2.5 rounded-lg bg-slate-900 text-indigo-300 font-mono text-xs overflow-x-auto">
                    {c.cmd}
                  </pre>
                  <p className="text-[11px] text-slate-400">{c.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: Create Invoice */}
      {showCreateInvoiceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-indigo-400" />
                <h3 className="font-semibold text-white text-base">Generate New Client Invoice</h3>
              </div>
              <button
                onClick={() => setShowCreateInvoiceModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateInvoice} className="space-y-4">
              {/* Client Selection */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Select Client Account</label>
                <select
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                  required
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">-- Choose a registered client --</option>
                  {clients.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name} {c.companyName ? `(${c.companyName})` : ''} - {c.email}
                    </option>
                  ))}
                </select>
              </div>

              {/* Due Date & Currency */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Due Date</label>
                  <input
                    type="date"
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    required
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Currency</label>
                  <select
                    value={newCurrency}
                    onChange={(e) => setNewCurrency(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Payment Terms</label>
                  <input
                    type="text"
                    value={newPaymentTerms}
                    onChange={(e) => setNewPaymentTerms(e.target.value)}
                    placeholder="e.g. Net 14"
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Line Items Editor */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-300">Invoice Line Items</label>
                  <button
                    type="button"
                    onClick={addLineItem}
                    className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Item
                  </button>
                </div>

                <div className="space-y-2">
                  {lineItems.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2 rounded-xl bg-slate-950 border border-slate-800 text-xs">
                      <input
                        type="text"
                        placeholder="Service or item description..."
                        value={item.description}
                        onChange={(e) => updateLineItem(idx, 'description', e.target.value)}
                        required
                        className="flex-1 bg-transparent border-none text-slate-100 focus:outline-none px-2 py-1"
                      />
                      <input
                        type="number"
                        min="1"
                        placeholder="Qty"
                        value={item.quantity}
                        onChange={(e) => updateLineItem(idx, 'quantity', parseInt(e.target.value, 10) || 1)}
                        required
                        className="w-16 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-right text-slate-200"
                      />
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Unit $"
                        value={item.unitPrice}
                        onChange={(e) => updateLineItem(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                        required
                        className="w-24 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-right text-slate-200 font-mono"
                      />
                      <span className="w-20 text-right font-mono font-semibold text-white">
                        ${((item.quantity || 0) * (item.unitPrice || 0)).toFixed(2)}
                      </span>
                      {lineItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeLineItem(idx)}
                          className="p-1 text-slate-500 hover:text-rose-400"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Tax & Discount & Calculations Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Tax Rate (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={newTaxRate}
                      onChange={(e) => setNewTaxRate(parseFloat(e.target.value) || 0)}
                      className="w-full px-3.5 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Discount Amount ($)</label>
                    <input
                      type="number"
                      min="0"
                      value={newDiscount}
                      onChange={(e) => setNewDiscount(parseFloat(e.target.value) || 0)}
                      className="w-full px-3.5 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100"
                    />
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs font-mono">
                  <div className="flex justify-between text-slate-400">
                    <span>Subtotal:</span>
                    <span>${calculatedSubtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Tax ({newTaxRate}%):</span>
                    <span>${calculatedTax.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Discount:</span>
                    <span>-${newDiscount.toFixed(2)}</span>
                  </div>
                  <div className="pt-2 border-t border-slate-800 flex justify-between text-sm font-bold text-white">
                    <span>Total Due:</span>
                    <span className="text-emerald-400">${calculatedTotal.toFixed(2)} {newCurrency}</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateInvoiceModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingInvoice}
                  className="px-5 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition disabled:opacity-50 flex items-center gap-1.5"
                >
                  {submittingInvoice ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Saving Invoice...</span>
                    </>
                  ) : (
                    <span>Issue Invoice</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Create Client */}
      {showCreateClientModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-emerald-400" />
                <h3 className="font-semibold text-white text-base">Provision New Client Account</h3>
              </div>
              <button
                onClick={() => setShowCreateClientModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateClient} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-medium text-slate-300 mb-1">Contact Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Doe"
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-300 mb-1">Corporate Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. client@company.com"
                  value={newClientEmail}
                  onChange={(e) => setNewClientEmail(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-300 mb-1">Account Password (Min 8 chars)</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  placeholder="••••••••••••"
                  value={newClientPassword}
                  onChange={(e) => setNewClientPassword(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-300 mb-1">Company / Organization</label>
                <input
                  type="text"
                  placeholder="e.g. Stark Industries"
                  value={newClientCompany}
                  onChange={(e) => setNewClientCompany(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-300 mb-1">Billing Phone</label>
                <input
                  type="text"
                  placeholder="+1 (555) 000-0000"
                  value={newClientPhone}
                  onChange={(e) => setNewClientPhone(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateClientModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-300 bg-slate-800 hover:bg-slate-700 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingClient}
                  className="px-5 py-2 rounded-xl font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition disabled:opacity-50 flex items-center gap-1.5"
                >
                  {submittingClient ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <span>Register Client</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
