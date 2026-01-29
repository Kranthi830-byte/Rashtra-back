import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from "react-router-dom";

// Pages
import Login from "./pages/Login";
import UserHome from "./pages/UserHome";
import ReportDamage from "./pages/ReportDamage";
import ComplaintStatusPage from "./pages/ComplaintStatus";
import SettingsPage from "./pages/Settings";
import AdminDashboard from "./pages/AdminDashboard";
import AdminAudit from "./pages/AdminAudit.tsx";
import AdminDataCenter from "./pages/AdminDataCenter.tsx";

// Components
import { BottomNav, SideNav, AdminSideNav, AdminMobileHeader } from "./components/UI";
import Chatbot from "./components/Chatbot";

// Types
import { UserRole } from "./types";
import { AuthProvider, useAuth } from "./contexts/AuthContext";

// Layouts
const UserLayout = ({ onLogout }: { onLogout: () => void }) => (
  <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex">
    <SideNav onLogout={onLogout} />
    <main className="flex-1 md:pl-64">
      <Outlet />
    </main>
    <Chatbot />
    <BottomNav />
  </div>
);

const AdminLayout = ({ onLogout }: { onLogout: () => void }) => (
  <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex">
    <AdminSideNav onLogout={onLogout} />
    <main className="flex-1 md:pl-64">
      <AdminMobileHeader onLogout={onLogout} />
      <Outlet />
    </main>
  </div>
);

const RequireAuth = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

const RequireAdmin = ({ children }: { children: React.ReactNode }) => {
  const { user, loading, isAdmin } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/user/home" replace />;
  return <>{children}</>;
};

const AppRoutes = () => {
  const { user, loading, isAdmin, logout } = useAuth();

  if (loading) return null;

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/login" />} />

        <Route
          path="/login"
          element={
            user ? (
              <Navigate to={isAdmin ? "/admin/dashboard" : "/user/home"} />
            ) : (
              <Login />
            )
          }
        />

        {/* USER */}
        <Route
          path="/user"
          element={
            <RequireAuth>
              <UserLayout onLogout={logout} />
            </RequireAuth>
          }
        >
          <Route path="home" element={<UserHome />} />
          <Route path="report" element={<ReportDamage />} />
          <Route path="status" element={<ComplaintStatusPage />} />
          <Route path="settings" element={<SettingsPage onLogout={logout} />} />
        </Route>

        {/* ADMIN */}
        <Route
          path="/admin"
          element={
            <RequireAdmin>
              <AdminLayout onLogout={logout} />
            </RequireAdmin>
          }
        >
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="audit" element={<AdminAudit />} />
          <Route path="data" element={<AdminDataCenter />} />
          <Route path="settings" element={<SettingsPage onLogout={logout} />} />
        </Route>
      </Routes>
    </Router>
  );
};

const App = () => (
  <AuthProvider>
    <AppRoutes />
  </AuthProvider>
);

export default App;
