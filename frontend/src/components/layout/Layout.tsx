import { useState, useEffect } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { useAppSelector, useAppDispatch } from "../../store/hooks";
import { fetchMe, logout } from "../../store/slices/authSlice";

const navItems = [
  { path: "/", label: "Dashboard", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1" },
  { path: "/careers", label: "Career Center", icon: "M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" },
  { path: "/groups", label: "Flying Groups", icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" },
  { path: "/calendar", label: "Schedule", icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" },
  { path: "/fleet", label: "Fleet", icon: "M12 19l9 2-9-18-9 18 9-2zm0 0v-8" },
  { path: "/bookings", label: "My Bookings", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" },
  { path: "/transfers", label: "Transfers", icon: "M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" },
];

const efbItems = [
  { path: "/efb", label: "OFP Briefing", icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
  { path: "/efb/checklist", label: "Interactive Checklist", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2" },
  { path: "/efb/weather", label: "Weather & Performance", icon: "M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" },
  { path: "/efb/settings", label: "Settings", icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573" }
];

const adminItems = [
  { path: "/admin/pilots", label: "Pilots", icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" },
  { path: "/admin/groups", label: "Groups", icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" },
  { path: "/admin/aircraft", label: "Aircraft", icon: "M12 19l9 2-9-18-9 18 9-2zm0 0v-8" },
  { path: "/admin/careers", label: "Careers", icon: "M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" },
  { path: "/admin/transfers", label: "Transfers", icon: "M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" },
  { path: "/admin/waves", label: "Waves", icon: "M13 10V3L4 14h7v7l9-11h-7z" },
  { path: "/admin/settings", label: "Settings", icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" },
];

export default function Layout() {
  const dispatch = useAppDispatch();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAppSelector((s) => s.auth);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(location.pathname.startsWith("/admin"));
  const [efbOpen, setEfbOpen] = useState(location.pathname.startsWith("/efb"));
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return localStorage.getItem("sidebar_collapsed") === "true";
  });

  useEffect(() => {
    setSidebarOpen(false);
    if (location.pathname.startsWith("/admin")) setAdminOpen(true);
    if (location.pathname.startsWith("/efb")) setEfbOpen(true);
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
        <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed lg:sticky top-0 left-0 z-40 h-screen bg-white border-r border-brand-border flex flex-col transition-all duration-300 ${sidebarCollapsed ? "w-20" : "w-64"} ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        {/* Brand */}
        <div className={`h-14 flex items-center border-b border-brand-border flex-shrink-0 transition-all duration-300 ${sidebarCollapsed ? "justify-center" : "px-5"}`}>
          <Link to="/" className="text-2xl font-black text-brand tracking-wider truncate">
            {sidebarCollapsed ? "QRV" : <>QRV<span className="text-brand-light">LIVE</span></>}
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              title={sidebarCollapsed ? item.label : undefined}
              className={`flex items-center rounded-xl text-sm font-semibold transition-colors duration-200 ${
                sidebarCollapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2.5"
              } ${
                location.pathname === item.path || (item.path !== "/" && location.pathname.startsWith(item.path))
                  ? "bg-brand text-white"
                  : "text-gray-600 hover:bg-brand-hover-bg hover:text-brand"
              }`}
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
              </svg>
              {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
            </Link>
          ))}

          {/* EFB section */}
          <div className="pt-3 mt-3 border-t border-brand-border">
            <button
              onClick={() => setEfbOpen(!efbOpen)}
              title={sidebarCollapsed ? "EFB Panel" : undefined}
              className={`flex items-center rounded-xl text-sm font-semibold text-gray-500 hover:bg-brand-hover-bg hover:text-brand w-full transition-colors duration-200 ${
                sidebarCollapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2.5"
              }`}
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              {!sidebarCollapsed && (
                <>
                  <span>EFB</span>
                  <svg className={`w-4 h-4 ml-auto transition-transform ${efbOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                </>
              )}
            </button>
            {efbOpen && (
              <div className={`mt-0.5 space-y-0.5 ${sidebarCollapsed ? "" : "ml-2"}`}>
                {efbItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    title={sidebarCollapsed ? item.label : undefined}
                    className={`flex items-center rounded-xl text-sm font-semibold transition-colors duration-200 ${
                      sidebarCollapsed ? "justify-center p-2" : "gap-3 px-3 py-2"
                    } ${
                      location.pathname === item.path
                        ? "bg-brand text-white"
                        : "text-gray-500 hover:bg-brand-hover-bg hover:text-brand"
                    }`}
                  >
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                    </svg>
                    {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Admin section */}
          <div className="pt-3 mt-3 border-t border-brand-border">
            <button
              onClick={() => setAdminOpen(!adminOpen)}
              title={sidebarCollapsed ? "Admin Panel" : undefined}
              className={`flex items-center rounded-xl text-sm font-semibold text-gray-500 hover:bg-brand-hover-bg hover:text-brand w-full transition-colors duration-200 ${
                sidebarCollapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2.5"
              }`}
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {!sidebarCollapsed && (
                <>
                  <span>Admin</span>
                  <svg className={`w-4 h-4 ml-auto transition-transform ${adminOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                </>
              )}
            </button>
            {adminOpen && (
              <div className={`mt-0.5 space-y-0.5 ${sidebarCollapsed ? "" : "ml-2"}`}>
                {adminItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    title={sidebarCollapsed ? item.label : undefined}
                    className={`flex items-center rounded-xl text-sm font-semibold transition-colors duration-200 ${
                      sidebarCollapsed ? "justify-center p-2" : "gap-3 px-3 py-2"
                    } ${
                      location.pathname === item.path
                        ? "bg-brand text-white"
                        : "text-gray-500 hover:bg-brand-hover-bg hover:text-brand"
                    }`}
                  >
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                    </svg>
                    {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </nav>

        {/* Bottom user info */}
        <div className={`border-t border-brand-border p-4 flex items-center transition-all duration-300 ${sidebarCollapsed ? "justify-center" : "gap-3"}`}>
          <img
            src={user?.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${user?.callsign || "default"}`}
            alt=""
            className="w-9 h-9 rounded-full flex-shrink-0 bg-brand"
          />
          {!sidebarCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-800 truncate">{user?.name || user?.callsign || "Pilot"}</p>
              <div className="flex items-center gap-2">
                <p className="text-xs text-gray-400 truncate">{user?.callsign}</p>
                <button onClick={handleLogout} className="text-xs text-gray-400 hover:text-brand transition-colors">· Sign out</button>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top bar */}
        <header className="h-14 border-b border-brand-border bg-white flex items-center px-4 gap-4 flex-shrink-0 sticky top-0 z-20">
          <button className="lg:hidden" onClick={() => setSidebarOpen(true)}>
            <svg className="w-6 h-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          
          {/* Toggle sidebar button for desktop */}
          <button
            onClick={toggleSidebarCollapsed}
            className="hidden lg:block text-gray-500 hover:text-brand transition-colors p-1 rounded-lg hover:bg-gray-100"
            title={sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              {sidebarCollapsed ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7M19 19l-7-7 7-7" />
              )}
            </svg>
          </button>

          <div className="flex-1" />
          <span className="text-sm font-semibold text-gray-600 hidden sm:block">{user?.callsign}</span>
        </header>

        {/* Page content */}
        <main className="flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
