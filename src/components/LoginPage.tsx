import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.tsx';
import {
  ShieldCheck,
  Eye,
  EyeOff,
  Lock,
  Mail,
  ArrowRight,
  AlertCircle,
  Loader2,
  CheckCircle2,
} from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { user, login, loading, error, clearError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // If user is already authenticated, redirect them to their respective dashboard
  useEffect(() => {
    if (user) {
      if (user.role === 'admin' || user.role === 'staff') {
        navigate('/admin/dashboard', { replace: true });
      } else {
        navigate('/client/dashboard', { replace: true });
      }
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearError();

    if (!email.trim()) {
      setLocalError('Please enter your corporate email address.');
      return;
    }
    if (!password) {
      setLocalError('Please enter your account password.');
      return;
    }

    const result = await login(email.trim(), password);
    if (result.success && result.role) {
      if (result.role === 'admin' || result.role === 'staff') {
        navigate('/admin/dashboard');
      } else {
        navigate('/client/dashboard');
      }
    }
  };

  const handleQuickFill = (role: 'admin' | 'client') => {
    setLocalError(null);
    clearError();
    if (role === 'admin') {
      setEmail('admin@nexus.com');
      setPassword('AdminPass123!');
    } else {
      setEmail('client@nexus.com');
      setPassword('ClientPass123!');
    }
  };

  const displayError = localError || error;

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 selection:bg-indigo-500 selection:text-white">
      {/* Background Ambience */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-950/30 via-slate-950 to-slate-950 pointer-events-none" />

      <div className="relative sm:mx-auto sm:w-full sm:max-w-md px-4">
        {/* Brand Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex h-12 w-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-cyan-500 items-center justify-center shadow-xl shadow-indigo-500/20">
            <ShieldCheck className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Nexus Corporate
          </h1>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Enterprise Financial Portal & Secure Billing Management
          </p>
        </div>

        {/* Card Box */}
        <div className="mt-8 bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur space-y-6">
          {/* Error Banner */}
          {displayError && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-2.5 animate-fadeIn">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
              <div className="leading-relaxed">{displayError}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Field */}
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5"
              >
                Corporate Email
              </label>
              <div className="relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="block w-full pl-10 pr-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="password"
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-300"
                >
                  Password
                </label>
              </div>
              <div className="relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="block w-full pl-10 pr-10 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200 focus:outline-none"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 transition-all shadow-lg shadow-indigo-600/20 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Authenticating...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In to Portal</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Quick Demo Access Bar */}
          <div className="pt-4 border-t border-slate-800">
            <p className="text-[11px] font-medium text-slate-400 text-center mb-2.5">
              Quick Sign In Presets for Verification:
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => handleQuickFill('admin')}
                className="py-1.5 px-3 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60 transition flex items-center justify-center gap-1.5"
              >
                <span className="font-semibold text-amber-400">Admin</span>
                <span className="text-[10px] text-slate-400">(Executive)</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickFill('client')}
                className="py-1.5 px-3 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60 transition flex items-center justify-center gap-1.5"
              >
                <span className="font-semibold text-emerald-400">Client</span>
                <span className="text-[10px] text-slate-400">(Acme Corp)</span>
              </button>
            </div>
          </div>
        </div>

        {/* Security Assurance Footer */}
        <div className="mt-6 text-center text-xs text-slate-500 space-y-1">
          <p className="flex items-center justify-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            <span>256-Bit Encrypted · HttpOnly Session Protection</span>
          </p>
          <p>© 2026 Nexus Corporate Technologies Inc.</p>
        </div>
      </div>
    </div>
  );
};
