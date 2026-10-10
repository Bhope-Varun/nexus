import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.tsx';
import { ShieldAlert, ArrowLeft, LogOut } from 'lucide-react';

export const AccessDenied: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleReturn = () => {
    if (user?.role === 'admin' || user?.role === 'staff') {
      navigate('/admin/dashboard');
    } else {
      navigate('/client/dashboard');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-slate-100">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center space-y-6 shadow-2xl">
        <div className="inline-flex h-16 w-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 items-center justify-center">
          <ShieldAlert className="h-8 w-8" />
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-bold tracking-tight text-white">
            Access Denied
          </h1>
          <p className="text-xs text-slate-400 leading-relaxed">
            Your current account credentials ({user?.email} ·{' '}
            <span className="font-mono uppercase font-semibold text-rose-400">
              {user?.role}
            </span>
            ) do not have administrative authorization to access this area.
          </p>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400 text-left font-mono">
          <div>Policy Violation: 403 Forbidden</div>
          <div>Role Required: admin / staff</div>
          <div>Enforcement: Server boundary checked</div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            onClick={handleReturn}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Return to My Portal</span>
          </button>
          <button
            onClick={async () => {
              await logout();
              navigate('/login');
            }}
            className="flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
};
