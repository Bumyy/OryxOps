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
      </Route>
    </Routes>
  );
}
