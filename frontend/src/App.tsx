import { Routes, Route } from "react-router-dom";
import Layout from "./components/layout/Layout";
import Dashboard from "./pages/Dashboard";
import CareerCenter from "./pages/CareerCenter";
import Groups from "./pages/Groups";
import GroupDetail from "./pages/GroupDetail";
import Calendar from "./pages/Calendar";
import Tokens from "./pages/Tokens";
import Fleet from "./pages/Fleet";
import AircraftDetail from "./pages/AircraftDetail";
import Bookings from "./pages/Bookings";
import Transfers from "./pages/Transfers";
import Admin from "./pages/Admin";
import Login from "./pages/Login";

import AdminPilots from "./pages/admin/PilotsPage";
import AdminGroups from "./pages/admin/GroupsPage";
import AdminAircraft from "./pages/admin/AircraftPage";
import AdminTokens from "./pages/admin/TokensPage";
import AdminCareers from "./pages/admin/CareersPage";
import AdminTransfers from "./pages/admin/TransfersPage";
import AdminWaves from "./pages/admin/WavesPage";
import AdminSettings from "./pages/admin/SettingsPage";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/careers" element={<CareerCenter />} />
        <Route path="/groups" element={<Groups />} />
        <Route path="/groups/:id" element={<GroupDetail />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/tokens" element={<Tokens />} />
        <Route path="/fleet" element={<Fleet />} />
        <Route path="/fleet/:id" element={<AircraftDetail />} />
        <Route path="/bookings" element={<Bookings />} />
        <Route path="/transfers" element={<Transfers />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/admin/pilots" element={<AdminPilots />} />
        <Route path="/admin/groups" element={<AdminGroups />} />
        <Route path="/admin/aircraft" element={<AdminAircraft />} />
        <Route path="/admin/tokens" element={<AdminTokens />} />
        <Route path="/admin/careers" element={<AdminCareers />} />
        <Route path="/admin/transfers" element={<AdminTransfers />} />
        <Route path="/admin/waves" element={<AdminWaves />} />
        <Route path="/admin/settings" element={<AdminSettings />} />
      </Route>
    </Routes>
  );
}
