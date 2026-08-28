import { useState, useEffect } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import {
  RiArrowDownSLine,
  RiArrowLeftDoubleLine,
  RiArrowRightDoubleLine,
  RiAuctionFill,
  RiBookOpenFill,
  RiCalendar2Fill,
  RiCheckboxMultipleFill,
  RiCloudWindyFill,
  RiDashboardFill,
  RiFileList3Fill,
  RiFileTextFill,
  RiGroupFill,
  RiMap2Fill,
  RiMenuFill,
  RiMoonFill,
  RiPlaneFill,
  RiRadarFill,
  RiRocket2Fill,
  RiSettings3Fill,
  RiShoppingBag3Fill,
  RiSmartphoneFill,
  RiSunFill,
  RiTeamFill,
  RiThunderstormsFill,
  RiUser3Fill,
} from "@remixicon/react";
import { useAppSelector, useAppDispatch } from "../../store/hooks";
import { fetchMe, logout } from "../../store/slices/authSlice";
import { useCurrency } from "../../hooks/useCurrency";
import { api } from "../../api/client";

const navItems = [
  {
    path: "/",
    label: "Dashboard",
    icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1",
  },
  {
    path: "/operations",
    label: "Flight Operations",
    icon: "M12 19l9 2-9-18-9 18 9-2zm0 0v-8",
  },
  {
    path: "/groups",
    label: "Flying Groups",
    icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z",
  },
  {
    path: "/calendar",
    label: "Schedule",
    icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
  },
  {
    path: "/bookings",
    label: "My Bookings",
    icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4",
  },
  {
    path: "/shop",
    label: "Proposals Shop",
    icon: "M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z",
  },
];

const efbItems = [
  {
    path: "/efb",
    label: "OFP Briefing",
    icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
  },
  {
    path: "/efb/checklist",
    label: "Interactive Checklist",
    icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2",
  },
  {
    path: "/efb/weather",
    label: "Weather & Performance",
    icon: "M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z",
  },
  {
    path: "/efb/aircraft",
    label: "Aircraft Performance",
    icon: "M12 19l9 2-9-18-9 18 9-2zm0 0v-8",
  },
  {
    path: "/efb/charts",
    label: "Charts",
    icon: "M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7",
  },
  {
    path: "/efb/settings",
    label: "Settings",
    icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573",
  },
];

const adminItems = [
  {
    path: "/admin/pilots",
    label: "Pilots",
    icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
  },
  {
    path: "/admin/groups",
    label: "Groups",
    icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z",
  },
  {
    path: "/admin/crew-roster",
    label: "Crew Roster",
    icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z",
  },
  {
    path: "/admin/bidding",
    label: "Fleet Bidding",
    icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",
  },
  {
    path: "/admin/aircraft",
    label: "Aircraft",
    icon: "M12 19l9 2-9-18-9 18 9-2zm0 0v-8",
  },
  {
    path: "/admin/waves",
    label: "Waves",
    icon: "M13 10V3L4 14h7v7l9-11h-7z",
  },
  {
    path: "/admin/settings",
    label: "Settings",
    icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z",
  },
  {
    path: "/admin/auto-scheduler",
    label: "Auto Scheduler",
    icon: "M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4",
  },
  {
    path: "/admin/track",
    label: "Live Tracking",
    icon: "M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z",
  },
];

const navIconMap: Record<string, typeof RiPlaneFill> = {
  Dashboard: RiDashboardFill,
  "Flight Operations": RiPlaneFill,
  "Flying Groups": RiGroupFill,
  Schedule: RiCalendar2Fill,
  "My Bookings": RiFileList3Fill,
  "Proposals Shop": RiShoppingBag3Fill,
  "OFP Briefing": RiFileTextFill,
  "Interactive Checklist": RiCheckboxMultipleFill,
  "Weather & Performance": RiCloudWindyFill,
  "Aircraft Performance": RiPlaneFill,
  Charts: RiMap2Fill,
  Settings: RiSettings3Fill,
  Pilots: RiUser3Fill,
  Groups: RiGroupFill,
  "Crew Roster": RiTeamFill,
  "Fleet Bidding": RiAuctionFill,
  Aircraft: RiPlaneFill,
  Waves: RiThunderstormsFill,
  "Live Tracking": RiRadarFill,
  "Auto Scheduler": RiSettings3Fill,
};

function NavIcon({ label, size }: { label: string; size: number }) {
  const Icon = navIconMap[label] || RiPlaneFill;
  return <Icon size={size} className="flex-shrink-0" aria-hidden="true" />;
}

export default function Layout() {
  const dispatch = useAppDispatch();
  const location = useLocation();
  const { currency, setCurrency } = useCurrency();
  const navigate = useNavigate();
  const { user } = useAppSelector((s) => s.auth);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(
    location.pathname.startsWith("/admin")
  );
  const [efbOpen, setEfbOpen] = useState(location.pathname.startsWith("/efb"));
  const [handbookOpen, setHandbookOpen] = useState(
    location.pathname.startsWith("/handbook")
  );
  const [handbookSections, setHandbookSections] = useState<any[]>([]);

  const [pendingProposals, setPendingProposals] = useState<number>(0);
  const [pendingApprovals, setPendingApprovals] = useState<number>(0);
  const [notifyingStaff, setNotifyingStaff] = useState<boolean>(false);
  const [notifyingPilots, setNotifyingPilots] = useState<boolean>(false);

  const fetchNotificationCounts = async () => {
    try {
      const res = await api.get<{ pending_proposals: number; pending_approvals: number }>("/schedules/pending-notifications");
      if (res) {
        setPendingProposals(res.pending_proposals || 0);
        setPendingApprovals(res.pending_approvals || 0);
      }
    } catch {
      // ignore background errors
    }
  };

  useEffect(() => {
    fetchNotificationCounts();
    const interval = setInterval(fetchNotificationCounts, 8000);
    const handleRefresh = () => fetchNotificationCounts();
    window.addEventListener("refresh_notifications", handleRefresh);
    return () => {
      clearInterval(interval);
      window.removeEventListener("refresh_notifications", handleRefresh);
    };
  }, []);

  const handleNotifyStaff = async () => {
    setNotifyingStaff(true);
    try {
      const res = await api.post<{ detail: string; count: number }>("/schedules/notify-staff");
      alert(res.detail || "Notification sent to Staff on Discord!");
      setPendingProposals(0);
    } catch (err: any) {
      alert("Failed to notify staff: " + (err?.response?.data?.detail || err.message));
    } finally {
      setNotifyingStaff(false);
    }
  };

  const handleNotifyPilots = async () => {
    setNotifyingPilots(true);
    try {
      const res = await api.post<{ detail: string; count: number }>("/schedules/notify-pilots");
      alert(res.detail || "Notifications sent to Pilots on Discord!");
      setPendingApprovals(0);
    } catch (err: any) {
      alert("Failed to notify pilots: " + (err?.response?.data?.detail || err.message));
    } finally {
      setNotifyingPilots(false);
    }
  };

  useEffect(() => {
    const loadHandbook = async () => {
      try {
        const json = await api.get<any>("/handbook");
        setHandbookSections(json.sections || []);
      } catch (err) {
        console.warn("Failed to fetch handbook from API, trying fallbacks:", err);
        const local = localStorage.getItem("oryxops_handbook_data");
        if (local) {
          setHandbookSections(JSON.parse(local).sections || []);
        } else {
          try {
            const fallbackRes = await fetch("/handbook.json");
            if (fallbackRes.ok) {
              const fallbackJson = await fallbackRes.json();
              setHandbookSections(fallbackJson.sections || []);
            }
          } catch (fallbackErr) {
            console.error("Failed to load static fallback handbook.json:", fallbackErr);
          }
        }
      }
    };
    loadHandbook();

    const handleReload = () => loadHandbook();
    window.addEventListener("reload_handbook_sidebar", handleReload);
    return () => window.removeEventListener("reload_handbook_sidebar", handleReload);
  }, []);

  const isExecutive = Boolean(
    user?.is_executive ||
    user?.is_admin ||
    ["QRV001", "QRV002", "QRV003", "QRV004"].includes(user?.callsign?.toUpperCase() || "")
  );

  const visibleHandbookSections = handbookSections.filter((sec) => {
    if (sec.admin_only && !isExecutive) return false;
    return true;
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return localStorage.getItem("sidebar_collapsed") === "true";
  });

  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("theme") || "light";
  });

  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  useEffect(() => {
    setSidebarOpen(false);
    if (location.pathname.startsWith("/admin")) setAdminOpen(true);
    if (location.pathname.startsWith("/efb")) setEfbOpen(true);
    if (location.pathname.startsWith("/handbook")) setHandbookOpen(true);
  }, [location]);

  const handleLogout = () => {
    dispatch(logout());
    navigate("/login");
  };

  const toggleSidebarCollapsed = () => {
    const nextVal = !sidebarCollapsed;
    setSidebarCollapsed(nextVal);
    localStorage.setItem("sidebar_collapsed", String(nextVal));
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:sticky top-0 left-0 z-40 h-screen bg-white border-r border-brand-border flex flex-col transition-all duration-300 ${
          sidebarCollapsed ? "w-20" : "w-64"
        } ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div
          className={`h-14 flex items-center justify-center border-b border-brand-border flex-shrink-0 transition-all duration-300 ${
            sidebarCollapsed ? "px-2" : "px-5"
          }`}
        >
          <Link
            to="/"
            className="relative flex items-center justify-center w-full h-12 focus:outline-none overflow-hidden"
          >
            {/* Full Logo (Visible when Expanded) */}
            <img
              src={
                theme === "dark"
                  ? "/oryxops_logo_white.webp"
                  : "/oryxops_logo_colored.webp"
              }
              alt="OryxOps Logo"
              className={`absolute transition-all duration-300 transform max-h-12 w-auto object-contain ${
                sidebarCollapsed
                  ? "opacity-0 scale-75 -translate-x-10 pointer-events-none"
                  : "opacity-100 scale-100 translate-x-0"
              }`}
            />

            {/* Icon Logo (Visible when Collapsed) */}
            <img
              src={
                theme === "dark"
                  ? "/logo_only_white.webp"
                  : "/logo_only_colored.webp"
              }
              alt="OryxOps Icon"
              className={`absolute transition-all duration-300 transform max-h-10 w-auto object-contain ${
                sidebarCollapsed
                  ? "opacity-100 scale-100 translate-x-0"
                  : "opacity-0 scale-75 translate-x-10 pointer-events-none"
              }`}
            />
          </Link>
        </div>

        {/* Nav */}
        <nav
          className={`flex-1 overflow-y-auto py-2 space-y-0.5 transition-all duration-300 ${
            sidebarCollapsed ? "px-1.5 no-scrollbar" : "px-3"
          }`}
        >
          {/* Main Navigation - Requires Award ID 9 or Admin */}
          {(user?.is_executive || user?.is_admin || user?.has_pilot_access) ? (
            navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                title={sidebarCollapsed ? item.label : undefined}
                className={`flex items-center rounded-xl text-sm font-semibold transition-colors duration-200 ${
                  sidebarCollapsed ? "justify-center py-2" : "gap-3 px-3 py-2.5"
                } ${
                  location.pathname === item.path ||
                  (item.path !== "/" && location.pathname.startsWith(item.path))
                    ? "bg-brand text-white"
                    : "text-gray-600 hover:bg-brand-hover-bg hover:text-brand"
                }`}
              >
                <NavIcon label={item.label} size={20} />
                {!sidebarCollapsed && (
                  <span className="truncate">{item.label}</span>
                )}
              </Link>
            ))
          ) : (
            !sidebarCollapsed && (
              <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-3 mb-2 text-center text-amber-800 space-y-1">
                <div className="text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1">
                  <span className="flex items-center justify-center gap-1"><RiSmartphoneFill size={14} aria-hidden="true" /> EFB Standalone Mode</span>
                </div>
                <p className="text-[10px] text-amber-700 font-medium leading-tight">
                  SimBrief & Flight Tools active. Full airline portal requires Award ID 9.
                </p>
              </div>
            )
          )}

          {/* EFB section - Always visible to all users */}
          <div className="pt-3 mt-3 border-t border-brand-border">
            <button
              onClick={() => setEfbOpen(!efbOpen)}
              title={sidebarCollapsed ? "EFB Panel" : undefined}
              className={`flex items-center rounded-xl text-sm font-semibold text-gray-500 hover:bg-brand-hover-bg hover:text-brand w-full transition-colors duration-200 ${
                sidebarCollapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2.5"
              }`}
            >
              <RiFileTextFill size={20} className="flex-shrink-0" aria-hidden="true" />
              {!sidebarCollapsed && (
                <>
                  <span>EFB</span>
                  <RiArrowDownSLine size={16} className={`ml-auto transition-transform ${efbOpen ? "rotate-180" : ""}`} aria-hidden="true" />
                </>
              )}
            </button>
            {efbOpen && (
              <div
                className={`mt-0.5 space-y-0.5 ${
                  sidebarCollapsed ? "" : "ml-2"
                }`}
              >
                {efbItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    title={sidebarCollapsed ? item.label : undefined}
                    className={`flex items-center rounded-xl text-sm font-semibold transition-colors duration-200 ${
                      sidebarCollapsed
                        ? "justify-center p-2"
                        : "gap-3 px-3 py-2"
                    } ${
                      location.pathname === item.path
                        ? "bg-brand text-white"
                        : "text-gray-500 hover:bg-brand-hover-bg hover:text-brand"
                    }`}
                  >
                    <NavIcon label={item.label} size={16} />
                    {!sidebarCollapsed && (
                      <span className="truncate">{item.label}</span>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </div>

        {/* Handbook section - Always visible, but sections are user-filtered */}
        <div className="pt-3 mt-3 border-t border-brand-border">
          <button
            onClick={() => setHandbookOpen(!handbookOpen)}
            title={sidebarCollapsed ? "User Handbook" : undefined}
            className={`flex items-center rounded-xl text-sm font-semibold text-gray-500 hover:bg-brand-hover-bg hover:text-brand w-full transition-colors duration-200 ${
              sidebarCollapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2.5"
            }`}
          >
            <RiBookOpenFill size={20} className="flex-shrink-0" aria-hidden="true" />
            {!sidebarCollapsed && (
              <>
                <span>Handbook</span>
                <RiArrowDownSLine size={16} className={`ml-auto transition-transform ${handbookOpen ? "rotate-180" : ""}`} aria-hidden="true" />
              </>
            )}
          </button>
          {handbookOpen && (
            <div
              className={`mt-0.5 space-y-0.5 ${
                sidebarCollapsed ? "" : "ml-2"
              }`}
            >
              {visibleHandbookSections.map((sec) => (
                <Link
                  key={sec.id}
                  to={`/handbook/${sec.id}`}
                  title={sidebarCollapsed ? sec.title : undefined}
                  className={`flex items-center rounded-xl text-xs font-semibold transition-colors duration-200 ${
                    sidebarCollapsed
                      ? "justify-center p-2"
                      : "gap-2.5 px-3 py-2"
                  } ${
                    location.pathname === `/handbook/${sec.id}` || 
                    (location.pathname === "/handbook" && visibleHandbookSections[0]?.id === sec.id)
                      ? "bg-brand text-white font-bold"
                      : "text-gray-500 hover:bg-brand-hover-bg hover:text-brand"
                  }`}
                >
                  <span className="w-4 h-4 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 font-bold flex items-center justify-center text-[9px] flex-shrink-0">
                    {sec.chapter}
                  </span>
                  {!sidebarCollapsed && (
                    <span className="truncate">{sec.title}</span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>

          {/* Admin section - Visible to Executive or Admin */}
          {(user?.is_executive || user?.is_admin) && (
            <div className="pt-3 mt-3 border-t border-brand-border">
              <button
                onClick={() => setAdminOpen(!adminOpen)}
                title={sidebarCollapsed ? "Admin Panel" : undefined}
                className={`flex items-center rounded-xl text-sm font-semibold text-gray-500 hover:bg-brand-hover-bg hover:text-brand w-full transition-colors duration-200 ${
                  sidebarCollapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2.5"
                }`}
              >
                <RiSettings3Fill size={20} className="flex-shrink-0" aria-hidden="true" />
                {/*
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg> */}
                {!sidebarCollapsed && (
                  <>
                    <span>Admin</span>
                    <RiArrowDownSLine size={16} className={`ml-auto transition-transform ${adminOpen ? "rotate-180" : ""}`} aria-hidden="true" />
                  </>
                )}
              </button>
              {adminOpen && (
                <div
                  className={`mt-0.5 space-y-0.5 ${
                    sidebarCollapsed ? "" : "ml-2"
                  }`}
                >
                  {adminItems.map((item) => (
                    <Link
                      key={item.path}
                      to={item.path}
                      title={sidebarCollapsed ? item.label : undefined}
                      className={`flex items-center rounded-xl text-sm font-semibold transition-colors duration-200 ${
                        sidebarCollapsed
                          ? "justify-center p-2"
                          : "gap-3 px-3 py-2"
                      } ${
                        location.pathname === item.path
                          ? "bg-brand text-white"
                          : "text-gray-500 hover:bg-brand-hover-bg hover:text-brand"
                      }`}
                    >
                      <NavIcon label={item.label} size={16} />
                      {!sidebarCollapsed && (
                        <span className="truncate">{item.label}</span>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </nav>

        {/* Bottom user info */}
        <div
          className={`border-t border-brand-border p-4 flex items-center transition-all duration-300 ${
            sidebarCollapsed ? "justify-center" : "gap-3"
          }`}
        >
          <img
            src={
              user?.avatar ||
              `https://api.dicebear.com/7.x/bottts/svg?seed=${
                user?.callsign || "default"
              }`
            }
            alt=""
            className="w-9 h-9 rounded-full flex-shrink-0 bg-brand"
          />
          {!sidebarCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-800 truncate">
                {user?.name || user?.callsign || "Pilot"}
              </p>
              <div className="flex items-center gap-2">
                <p className="text-xs text-gray-400 truncate">
                  {user?.callsign}
                </p>
                <button
                  onClick={handleLogout}
                  className="text-xs text-gray-400 hover:text-brand transition-colors"
                >
                  · Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top bar */}
        <header className="h-14 border-b border-brand-border bg-white flex items-center px-4 gap-4 flex-shrink-0 sticky top-0 z-20">
          <button className="lg:hidden" onClick={() => setSidebarOpen(true)} aria-label="Open navigation">
            <RiMenuFill size={24} className="text-gray-600" aria-hidden="true" />
          </button>

          {/* Toggle sidebar button for desktop */}
          <button
            onClick={toggleSidebarCollapsed}
            className="hidden lg:block text-gray-500 hover:text-brand transition-colors p-1 rounded-lg hover:bg-gray-100"
            title={sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {sidebarCollapsed ? <RiArrowRightDoubleLine size={20} aria-hidden="true" /> : <RiArrowLeftDoubleLine size={20} aria-hidden="true" />}
          </button>

          <div className="flex-1" />
          <div className="flex items-center gap-3">
            {pendingProposals > 0 && (
              <button
                onClick={handleNotifyStaff}
                disabled={notifyingStaff}
                className="bg-brand hover:bg-brand-light text-white font-black text-xs px-3.5 py-1.5 rounded-full shadow-md transition-all flex items-center gap-1.5 cursor-pointer animate-pulse"
                title="Click to notify Staff on Discord about your submitted proposals"
              >
                <RiRocket2Fill size={14} aria-hidden="true" />
                <span>{notifyingStaff ? "Sending..." : `Notify Staff (${pendingProposals})`}</span>
              </button>
            )}

            {pendingApprovals > 0 && isExecutive && (
              <button
                onClick={handleNotifyPilots}
                disabled={notifyingPilots}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs px-3.5 py-1.5 rounded-full shadow-md transition-all flex items-center gap-1.5 cursor-pointer animate-pulse"
                title="Click to notify Pilots on Discord about approved schedules"
              >
                <RiRocket2Fill size={14} aria-hidden="true" />
                <span>{notifyingPilots ? "Sending..." : `Notify Pilots (${pendingApprovals} Approved)`}</span>
              </button>
            )}

            <button
              onClick={() => setCurrency(currency === "QAR" ? "USD" : "QAR")}
              className="text-gray-500 hover:text-brand transition-colors px-2.5 py-1.5 rounded-xl hover:bg-brand-hover-bg flex items-center justify-center cursor-pointer font-mono text-xs font-bold border border-brand-border gap-1"
              title="Switch Currency"
            >
              {currency === "QAR" ? "﷼ QAR" : "$ USD"}
            </button>
            <button
              onClick={toggleTheme}
              className="text-gray-500 hover:text-brand transition-colors p-2 rounded-xl hover:bg-brand-hover-bg flex items-center justify-center cursor-pointer"
              title={
                theme === "light"
                  ? "Switch to Dark Mode"
                  : "Switch to Light Mode"
              }
            >
              {theme === "light" ? (
                <RiMoonFill size={20} aria-hidden="true" />
              ) : (
                <RiSunFill size={20} className="text-amber-400" aria-hidden="true" />
              )}
            </button>
            <span className="text-sm font-semibold text-gray-600 hidden sm:block">
              {user?.callsign}
            </span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
