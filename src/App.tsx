import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { LoginPage } from './components/LoginPage.tsx';
import { AdminDashboard } from './components/AdminDashboard.tsx';
import { ClientDashboard } from './components/ClientDashboard.tsx';
import { AccessDenied } from './components/AccessDenied.tsx';
import { Navbar } from './components/Navbar.tsx';
import { ShieldCheck, Loader2 } from 'lucide-react';

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-slate-100 selection:bg-indigo-500 selection:text-white">
      <div className="flex flex-col items-center space-y-4">
        <div className="h-14 w-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-cyan-500 flex items-center justify-center shadow-xl shadow-indigo-500/20">
          <ShieldCheck className="h-8 w-8 text-white" />
        </div>
        <div className="text-center space-y-1">
          <h2 className="text-lg font-bold text-white tracking-tight">Nexus Corporate</h2>
          <p className="text-xs text-slate-400">Verifying authenticated session...</p>
        </div>
        <Loader2 className="h-5 w-5 animate-spin text-indigo-400 mt-2" />
      </div>
    </div>
  );
}

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: Array<'admin' | 'staff' | 'client'>;
}

function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingScreen />;
  }

  // Unauthenticated users are redirected to /login
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Role check: Clients cannot access admin routes
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <AccessDenied />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500 selection:text-white">
      <Navbar />
      <main>{children}</main>
    </div>
  );
}

function RootRedirect() {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role === 'admin' || user.role === 'staff') {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return <Navigate to="/client/dashboard" replace />;
}

function LoginRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (user) {
    if (user.role === 'admin' || user.role === 'staff') {
      return <Navigate to="/admin/dashboard" replace />;
    }
    return <Navigate to="/client/dashboard" replace />;
  }

  return <LoginPage />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Login Route */}
          <Route path="/login" element={<LoginRoute />} />

          {/* Root Redirect based on verified role or unauthenticated state */}
          <Route path="/" element={<RootRedirect />} />

          {/* Protected Admin & Staff Dashboard */}
          <Route
            path="/admin/dashboard"
            element={
              <ProtectedRoute allowedRoles={['admin', 'staff']}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />

          {/* Protected Client Dashboard */}
          <Route
            path="/client/dashboard"
            element={
              <ProtectedRoute allowedRoles={['client', 'admin', 'staff']}>
                <ClientDashboard />
              </ProtectedRoute>
            }
          />

          {/* Access Denied Page */}
          <Route path="/access-denied" element={<AccessDenied />} />

          {/* Fallback Catch-All */}
          <Route path="*" element={<RootRedirect />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
