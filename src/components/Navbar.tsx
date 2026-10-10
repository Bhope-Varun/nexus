import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.tsx';
import {
  ShieldCheck,
  LogOut,
  User,
  CreditCard,
  FileText,
  BarChart3,
  Server,
  Menu,
  X,
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const isAdminOrStaff = user?.role === 'admin' || user?.role === 'staff';

  return (
    <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Brand Wordmark */}
        <div
          onClick={() => navigate(isAdminOrStaff ? '/admin/dashboard' : '/client/dashboard')}
          className="flex items-center gap-3 cursor-pointer shrink-0"
        >
          <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-cyan-500 flex items-center justify-center shadow-md shadow-indigo-500/20">
            <ShieldCheck className="h-5 w-5 text-white" />
          </div>
          <span className="font-bold text-lg text-white tracking-tight whitespace-nowrap">
            Nexus Corporate
          </span>
        </div>

        {/* Zone 2: Navigation Links (Desktop) */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300">
          {isAdminOrStaff ? (
            <>
              <button
                onClick={() => navigate('/admin/dashboard')}
                className={`transition-colors whitespace-nowrap ${
                  location.pathname === '/admin/dashboard'
                    ? 'text-indigo-400 font-semibold'
                    : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                Executive Portal
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => navigate('/client/dashboard')}
                className={`transition-colors whitespace-nowrap ${
                  location.pathname === '/client/dashboard'
                    ? 'text-indigo-400 font-semibold'
                    : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                Client Portal
              </button>
            </>
          )}
        </nav>

        {/* Zone 3: Account Profile & Logout */}
        <div className="hidden md:flex items-center gap-4 shrink-0">
          {user ? (
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-xs font-semibold text-slate-200 leading-tight">
                  {user.name}
                </div>
                <div className="text-[11px] text-slate-400 flex items-center justify-end gap-1.5">
                  <span
                    className={`font-mono uppercase text-[10px] font-semibold ${
                      user.role === 'admin'
                        ? 'text-amber-400'
                        : user.role === 'staff'
                        ? 'text-cyan-400'
                        : 'text-emerald-400'
                    }`}
                  >
                    {user.role}
                  </span>
                  {user.companyName && (
                    <>
                      <span aria-hidden="true" className="text-slate-600">·</span>
                      <span className="truncate max-w-[120px]">{user.companyName}</span>
                    </>
                  )}
                </div>
              </div>

              <div className="h-8 w-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
                <User className="h-4 w-4" />
              </div>

              <button
                onClick={handleLogout}
                className="ml-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition-colors whitespace-nowrap"
                title="Sign out of Nexus Corporate"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          ) : (
            <button
              onClick={() => navigate('/login')}
              className="px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors whitespace-nowrap"
            >
              Sign In
            </button>
          )}
        </div>

        {/* Mobile Hamburger Button */}
        <div className="md:hidden flex items-center">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-slate-400 hover:text-white"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-800 bg-slate-900 px-4 py-4 space-y-3">
          {user ? (
            <div className="space-y-3">
              <div className="pb-2 border-b border-slate-800">
                <div className="font-semibold text-white text-sm">{user.name}</div>
                <div className="text-xs text-slate-400">{user.email} · {user.role.toUpperCase()}</div>
              </div>

              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  navigate(isAdminOrStaff ? '/admin/dashboard' : '/client/dashboard');
                }}
                className="w-full text-left py-2 text-sm text-slate-200 hover:text-indigo-400"
              >
                Dashboard
              </button>

              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleLogout();
                }}
                className="w-full text-left py-2 text-sm text-rose-400 flex items-center gap-2"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                navigate('/login');
              }}
              className="w-full py-2.5 text-center text-sm font-semibold bg-indigo-600 text-white rounded-lg"
            >
              Sign In
            </button>
          )}
        </div>
      )}
    </header>
  );
};
