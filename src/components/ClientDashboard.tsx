import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import {
  FileText,
  CreditCard,
  Download,
  Mail,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  DollarSign,
  User,
  Building,
  Phone,
  ShieldCheck,
  Loader2,
} from 'lucide-react';

interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

interface InvoiceData {
  _id: string;
  invoiceNumber: string;
  totalAmount: number;
  subtotal: number;
  taxAmount: number;
  discount: number;
  currency: string;
  status: 'draft' | 'pending' | 'paid' | 'overdue' | 'cancelled';
  issueDate: string;
  dueDate: string;
  paidAt?: string;
  items: InvoiceItem[];
  receiptUrl?: string;
  receiptSentAt?: string;
}

export const ClientDashboard: React.FC = () => {
  const { user, token } = useAuth();
  const [invoices, setInvoices] = useState<InvoiceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payingInvoiceId, setPayingInvoiceId] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Profile edit state
  const [activeTab, setActiveTab] = useState<'invoices' | 'profile'>('invoices');
  const [profileName, setProfileName] = useState(user?.name || '');
  const [profileCompany, setProfileCompany] = useState(user?.companyName || '');
  const [profilePhone, setProfilePhone] = useState(user?.phone || '');
  const [profileSaving, setProfileSaving] = useState(false);

  const fetchInvoices = async () => {
    setLoading(true);
    setError(null);
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/invoices', {
        headers,
        credentials: 'include',
      });

      if (!res.ok) {
        throw new Error(`Failed to load invoices (HTTP ${res.status})`);
      }

      const data = await res.json();
      if (data.success) {
        setInvoices(data.data || []);
      }
    } catch (err: any) {
      setError(err.message || 'Unable to retrieve invoice history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, [token]);

  const handlePayWithStripe = async (invoiceId: string) => {
    setPayingInvoiceId(invoiceId);
    setFeedbackMessage(null);

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/payments/checkout-session', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({ invoiceId }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to initiate Stripe Checkout session');
      }

      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        setFeedbackMessage({ type: 'success', text: `Checkout Session Created: ${data.sessionId}` });
      }
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err.message || 'Checkout failed' });
    } finally {
      setPayingInvoiceId(null);
    }
  };

  const handleDownloadReceipt = async (invoiceNumber: string) => {
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const filename = `Receipt-${invoiceNumber}.pdf`;
      const res = await fetch(`/api/receipts/download/${filename}`, {
        headers,
        credentials: 'include',
      });

      if (!res.ok) {
        throw new Error(`Download failed: HTTP ${res.status}`);
      }

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
      setFeedbackMessage({ type: 'error', text: err.message || 'Receipt download failed' });
    }
  };

  const handleResendReceipt = async (invoiceId: string) => {
    setResendingId(invoiceId);
    setFeedbackMessage(null);

    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/invoices/${invoiceId}/receipt/resend`, {
        method: 'POST',
        headers,
        credentials: 'include',
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to resend receipt');
      }

      setFeedbackMessage({ type: 'success', text: 'Receipt email dispatched successfully to your registered email.' });
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err.message });
    } finally {
      setResendingId(null);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaving(true);
    setFeedbackMessage(null);

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/auth/me', {
        method: 'PATCH',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          name: profileName,
          companyName: profileCompany,
          phone: profilePhone,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to update profile');
      }

      setFeedbackMessage({ type: 'success', text: 'Profile information updated successfully.' });
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err.message });
    } finally {
      setProfileSaving(false);
    }
  };

  // Metrics calculation
  const totalBilled = invoices.reduce((acc, inv) => acc + inv.totalAmount, 0);
  const totalPaid = invoices.filter((inv) => inv.status === 'paid').reduce((acc, inv) => acc + inv.totalAmount, 0);
  const totalPending = invoices.filter((inv) => inv.status === 'pending' || inv.status === 'overdue').reduce((acc, inv) => acc + inv.totalAmount, 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Welcome Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-white">Client Portal</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono font-medium">
              Verified Client
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Welcome, <strong className="text-slate-200">{user?.name}</strong> ·{' '}
            {user?.companyName ? `${user.companyName} · ` : ''}{user?.email}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('invoices')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeTab === 'invoices'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            My Invoices
          </button>
          <button
            onClick={() => setActiveTab('profile')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeTab === 'profile'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            Company Profile
          </button>
          <button
            onClick={fetchInvoices}
            disabled={loading}
            className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-colors"
            title="Refresh Invoices"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Global Feedback Alert */}
      {feedbackMessage && (
        <div
          className={`p-4 rounded-xl text-xs flex items-center justify-between border ${
            feedbackMessage.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/20 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {feedbackMessage.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
            )}
            <span>{feedbackMessage.text}</span>
          </div>
          <button
            onClick={() => setFeedbackMessage(null)}
            className="text-slate-400 hover:text-white text-xs underline ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Financial Metrics Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-xs font-medium text-slate-400">Total Invoiced</span>
          <div className="text-2xl font-bold text-white font-mono tabular-nums">
            ${totalBilled.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <span className="text-[11px] text-slate-500 block">All lifetime invoices</span>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-xs font-medium text-emerald-400">Paid & Settled</span>
          <div className="text-2xl font-bold text-emerald-400 font-mono tabular-nums">
            ${totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <span className="text-[11px] text-slate-500 block">Verified Stripe transactions</span>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-xs font-medium text-amber-400">Balance Pending</span>
          <div className="text-2xl font-bold text-amber-400 font-mono tabular-nums">
            ${totalPending.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <span className="text-[11px] text-slate-500 block">Due for payment</span>
        </div>
      </div>

      {activeTab === 'invoices' ? (
        /* Invoices List Section */
        <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
          <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Your Invoices & Tax Receipts</h2>
            <span className="text-xs text-slate-400 font-mono">
              {invoices.length} {invoices.length === 1 ? 'Invoice' : 'Invoices'}
            </span>
          </div>

          {loading ? (
            <div className="p-12 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
              <span>Retrieving your invoices from secure ledger...</span>
            </div>
          ) : error ? (
            <div className="p-8 text-center text-rose-300 text-xs">
              <AlertCircle className="h-6 w-6 text-rose-400 mx-auto mb-2" />
              <span>{error}</span>
            </div>
          ) : invoices.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs space-y-2">
              <FileText className="h-8 w-8 text-slate-600 mx-auto" />
              <p className="font-medium text-slate-300">No Invoices Currently Issued</p>
              <p className="text-slate-500">Invoices generated by Nexus administrators will appear here.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-medium">
                    <th className="py-3 px-5">Invoice #</th>
                    <th className="py-3 px-5">Issue Date</th>
                    <th className="py-3 px-5">Due Date</th>
                    <th className="py-3 px-5 text-right">Amount</th>
                    <th className="py-3 px-5">Status</th>
                    <th className="py-3 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-slate-300">
                  {invoices.map((inv) => (
                    <tr key={inv._id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3.5 px-5 font-semibold text-white">
                        {inv.invoiceNumber}
                      </td>
                      <td className="py-3.5 px-5 font-sans text-slate-400 text-[11px]">
                        {new Date(inv.issueDate).toLocaleDateString()}
                      </td>
                      <td className="py-3.5 px-5 font-sans text-slate-400 text-[11px]">
                        {new Date(inv.dueDate).toLocaleDateString()}
                      </td>
                      <td className="py-3.5 px-5 text-right font-bold text-white tabular-nums">
                        ${inv.totalAmount.toFixed(2)} {inv.currency}
                      </td>
                      <td className="py-3.5 px-5 font-sans">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                            inv.status === 'paid'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : inv.status === 'pending'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}
                        >
                          {inv.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-right font-sans">
                        <div className="flex items-center justify-end gap-2">
                          {inv.status === 'paid' ? (
                            <>
                              <button
                                onClick={() => handleDownloadReceipt(inv.invoiceNumber)}
                                className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition"
                                title="Download PDF Receipt"
                              >
                                <Download className="h-3 w-3 text-indigo-400" />
                                <span>PDF Receipt</span>
                              </button>
                              <button
                                onClick={() => handleResendReceipt(inv._id)}
                                disabled={resendingId === inv._id}
                                className="p-1 rounded-md text-slate-400 hover:text-slate-200 transition"
                                title="Email Receipt Again"
                              >
                                <Mail className="h-3.5 w-3.5" />
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => handlePayWithStripe(inv._id)}
                              disabled={payingInvoiceId === inv._id}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 transition shadow-sm disabled:opacity-50"
                            >
                              {payingInvoiceId === inv._id ? (
                                <>
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  <span>Connecting...</span>
                                </>
                              ) : (
                                <>
                                  <CreditCard className="h-3.5 w-3.5" />
                                  <span>Pay with Stripe</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* Company Profile Tab */
        <div className="max-w-xl mx-auto bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Building className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Client Billing Profile</h2>
              <p className="text-xs text-slate-400">Details printed on official invoices and receipts</p>
            </div>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Account Contact Name</label>
              <input
                type="text"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                required
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Company / Organization</label>
              <input
                type="text"
                value={profileCompany}
                onChange={(e) => setProfileCompany(e.target.value)}
                placeholder="e.g. Acme Corp"
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Billing Phone</label>
              <input
                type="text"
                value={profilePhone}
                onChange={(e) => setProfilePhone(e.target.value)}
                placeholder="+1 (555) 000-0000"
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={profileSaving}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition disabled:opacity-50"
              >
                {profileSaving ? 'Saving Changes...' : 'Update Billing Information'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
