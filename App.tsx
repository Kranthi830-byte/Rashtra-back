import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';

// Pages
import Login from './pages/Login';
import UserHome from './pages/UserHome';
import ReportDamage from './pages/ReportDamage';
import ComplaintStatusPage from './pages/ComplaintStatus';
import SettingsPage from './pages/Settings';
import AdminDashboard, { AdminAudit, AdminDataCenter } from './pages/AdminDashboard';

// Components
import { BottomNav, SideNav, AdminSideNav, AdminMobileHeader } from './components/UI.tsx';
import Chatbot from './components/Chatbot';

// Types & Services
import { UserRole } from './types';
import { MOCK_ADMIN } from './constants';
import { FirestoreService } from './services/firestoreService';
import { GeoPoint } from 'firebase/firestore';

import { StorageService } from './services/storageService';

const testUpload = async () => {
  try {
    // 1. Convert your local test image to a File object
    // Note: 'road.jpg' must be in your 'public' folder for this fetch to work in dev
    const response = await fetch('/road-2.jpg'); 
    const blob = await response.blob();
    const testFile = new File([blob], "road-2.jpg", { type: "image/jpeg" });

    console.log("📤 Uploading real image to Storage...");
    const realImageUrl = await StorageService.uploadPotholeImage(testFile);

    // 2. Create the Firestore report with the REAL URL
    const reportId = await FirestoreService.createPotholeReport({
      userId: "test-user-001",
      location: {
        latitude: 17.3850,
        longitude: 78.4867,
        geopoint: new GeoPoint(17.3850, 78.4867),
        address: "Charminar Road, Hyderabad"
      },
      roadInfo: { type: 'MAIN', importance: 4 },
      severity: { score: 7, area: 0.8, confidence: 0.92 },
      detection: {
        boundingBox: { x: 0, y: 0, width: 100, height: 100 },
        imageUrl: realImageUrl // Now using the actual Firebase Storage URL!
      },
      status: 'reported',
      metadata: {} as any 
    });

    console.log("✅ Success! Real image report created with ID:", reportId);
  } catch (e) {
    console.error("❌ Real image test failed:", e);
  }
};

// --- LAYOUTS ---
const UserLayout = ({ onLogout }: { onLogout: () => void }) => (
  <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-white flex">
    <SideNav onLogout={onLogout} />
    <main className="flex-1 pb-20 md:pb-0 md:pl-64 min-h-screen transition-all">
      <div className="h-full overflow-y-auto">
        <Outlet />
      </div>
    </main>
    <Chatbot />
    <BottomNav />
  </div>
);

const AdminLayout = ({ onLogout }: { onLogout: () => void }) => (
  <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white flex">
    <AdminSideNav onLogout={onLogout} />
    <main className="flex-1 md:pl-64 min-h-screen transition-all flex flex-col">
       <AdminMobileHeader onLogout={onLogout} />
       <div className="flex-1 overflow-y-auto">
         <Outlet />
       </div>
    </main>
  </div>
);

// --- MAIN APP COMPONENT ---
const App = () => {
  const [userRole, setUserRole] = useState<UserRole | null>(null);

  // Safely trigger the test upload once on mount
  useEffect(() => {
    console.log("🚀 Firebase Check: Running test upload...");
    testUpload();
  }, []);

  const handleLogin = (role: UserRole) => {
    setUserRole(role);
  };

  const handleLogout = () => {
    setUserRole(null);
    // Optional: window.location.reload(); 
  };

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        
        <Route 
          path="/login" 
          element={userRole ? <Navigate to={userRole === UserRole.ADMIN ? "/admin/dashboard" : "/user/home"} replace /> : <Login onLogin={handleLogin} />} 
        />

        {/* User Routes */}
        <Route path="/user" element={userRole === UserRole.USER ? <UserLayout onLogout={handleLogout} /> : <Navigate to="/login" replace />}>
          <Route path="home" element={<UserHome />} />
          <Route path="report" element={<ReportDamage />} />
          <Route path="status" element={<ComplaintStatusPage />} />
          <Route path="settings" element={<SettingsPage onLogout={handleLogout} />} />
        </Route>

        {/* Admin Routes */}
        <Route path="/admin" element={userRole === UserRole.ADMIN ? <AdminLayout onLogout={handleLogout} /> : <Navigate to="/login" replace />}>
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="audit" element={<AdminAudit />} />
          <Route path="data" element={<AdminDataCenter />} />
          <Route path="settings" element={<SettingsPage onLogout={handleLogout} user={MOCK_ADMIN} />} />
        </Route>

      </Routes>
    </Router>
  );
};

export default App;