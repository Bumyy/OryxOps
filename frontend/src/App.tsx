// Trigger deployment update
import { useState, useEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "./store/hooks";
import { fetchMe, logout } from "./store/slices/authSlice";
import { fetchAircraftSpecs } from "./store/slices/aircraftSlice";

import Layout from "./components/layout/Layout";
import Dashboard from "./pages/Dashboard";
import CareerCenter from "./pages/CareerCenter";
import Groups from "./pages/Groups";
import GroupDetail from "./pages/GroupDetail";
import Calendar from "./pages/Calendar";
import Fleet from "./pages/Fleet";
import AircraftDetail from "./pages/AircraftDetail";
import Bookings from "./pages/Bookings";
import Operations from "./pages/Operations";
import Transfers from "./pages/Transfers";
import Admin from "./pages/Admin";
import Login from "./pages/Login";
import EFB from "./pages/EFB";

import AdminPilots from "./pages/admin/PilotsPage";
import AdminGroups from "./pages/admin/GroupsPage";
import AdminAircraft from "./pages/admin/AircraftPage";
import AdminCareers from "./pages/admin/CareersPage";
import AdminTransfers from "./pages/admin/TransfersPage";
import AdminWaves from "./pages/admin/WavesPage";
import AdminSettings from "./pages/admin/SettingsPage";
import AdminAutoScheduler from "./pages/admin/AutoSchedulerPage";
import IFCallback from "./pages/IFCallback";

function AuthInitializer({ children }: { children: React.ReactNode }) {
  const dispatch = useAppDispatch();
  const token = useAppSelector((state) => state.auth.token);
  const user = useAppSelector((state) => state.auth.user);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      if (!token) {
        setInitializing(false);
        return;
      }
      try {
        const result = await dispatch(fetchMe());
        if (fetchMe.rejected.match(result)) {
          dispatch(logout());
        } else {
          dispatch(fetchAircraftSpecs());
        }
      } catch (err) {
        console.error("Auth check failed:", err);
        dispatch(logout());
      } finally {
        setInitializing(false);
      }
    };
    checkAuth();
  }, [token, dispatch]);

  if (initializing) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-brand-dark text-white">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-light mb-4"></div>
        <p className="text-sm text-gray-400">Loading OryxOps...</p>
      </div>
    );
  }

  return <>{children}</>;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, token } = useAppSelector((state) => state.auth);

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (!user) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-brand-dark text-white">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-light mb-4"></div>
        <p className="text-sm text-gray-400">Loading profile...</p>
      </div>
    );
  }

  return <>{children}</>;
}

function PilotAccessRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAppSelector((state) => state.auth);
  const location = useLocation();

  const isEfbRoute = location.pathname.startsWith("/efb");
  const isAllowed = user?.has_pilot_access || user?.is_admin;

  if (!isAllowed && !isEfbRoute) {
    return <Navigate to="/efb" replace />;
  }

  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAppSelector((state) => state.auth);

  if (!user?.is_admin) {
    return <Navigate to="/efb" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <AuthInitializer>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/oauth/if-callback" element={<IFCallback />} />
        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          {/* Public EFB Tools for all authenticated users */}
          <Route path="/efb" element={<EFB />} />
          <Route path="/efb/checklist" element={<EFB />} />
          <Route path="/efb/weather" element={<EFB />} />
          <Route path="/efb/aircraft" element={<EFB />} />
          <Route path="/efb/charts" element={<EFB />} />
          <Route path="/efb/settings" element={<EFB />} />

          {/* Full Pilot Routes - Requires Award ID 9 or Admin */}
          <Route path="/" element={<PilotAccessRoute><Dashboard /></PilotAccessRoute>} />
          <Route path="/careers" element={<PilotAccessRoute><CareerCenter /></PilotAccessRoute>} />
          <Route path="/groups" element={<PilotAccessRoute><Groups /></PilotAccessRoute>} />
          <Route path="/groups/:id" element={<PilotAccessRoute><GroupDetail /></PilotAccessRoute>} />
          <Route path="/calendar" element={<PilotAccessRoute><Calendar /></PilotAccessRoute>} />
          <Route path="/fleet" element={<PilotAccessRoute><Fleet /></PilotAccessRoute>} />
          <Route path="/fleet/:id" element={<PilotAccessRoute><AircraftDetail /></PilotAccessRoute>} />
          <Route path="/bookings" element={<PilotAccessRoute><Bookings /></PilotAccessRoute>} />
          <Route path="/operations" element={<PilotAccessRoute><Operations /></PilotAccessRoute>} />
          <Route path="/transfers" element={<PilotAccessRoute><Transfers /></PilotAccessRoute>} />

          {/* Admin Routes - Requires Admin Permission or Executive Callsign */}
          <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />
          <Route path="/admin/pilots" element={<AdminRoute><AdminPilots /></AdminRoute>} />
          <Route path="/admin/groups" element={<AdminRoute><AdminGroups /></AdminRoute>} />
          <Route path="/admin/aircraft" element={<AdminRoute><AdminAircraft /></AdminRoute>} />
          <Route path="/admin/careers" element={<AdminRoute><AdminCareers /></AdminRoute>} />
          <Route path="/admin/transfers" element={<AdminRoute><AdminTransfers /></AdminRoute>} />
          <Route path="/admin/waves" element={<AdminRoute><AdminWaves /></AdminRoute>} />
          <Route path="/admin/settings" element={<AdminRoute><AdminSettings /></AdminRoute>} />
          <Route path="/admin/auto-scheduler" element={<AdminRoute><AdminAutoScheduler /></AdminRoute>} />
        </Route>
      </Routes>
    </AuthInitializer>
  );
}
