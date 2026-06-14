import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useAppSelector, useAppDispatch } from "../../store/hooks";
import { fetchMe, logout } from "../../store/slices/authSlice";

const navItems = [
  { path: "/", label: "Dashboard" },
  { path: "/careers", label: "Careers" },
  { path: "/groups", label: "Groups" },
  { path: "/calendar", label: "Calendar" },
  { path: "/fleet", label: "Fleet" },
  { path: "/bookings", label: "Bookings" },
  { path: "/tokens", label: "Tokens" },
  { path: "/transfers", label: "Transfers" },
];

export default function Layout() {
  const dispatch = useAppDispatch();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, token } = useAppSelector((s) => s.auth);

  useEffect(() => {
    if (token && !user) {
      dispatch(fetchMe());
    }
    if (!token) {
      navigate("/login");
    }
  }, [token, user]);

  const handleLogout = () => {
    dispatch(logout());
    navigate("/login");
  };

  if (!token) return null;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur border-b border-brand-border">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-3">
            <span className="text-2xl font-black text-brand tracking-wider">
              QRV<span className="text-brand-light">LIVE</span>
            </span>
          </Link>

          <nav className="hidden lg:flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`px-3 py-2 rounded-full text-sm font-semibold transition-colors duration-200 ${
                  location.pathname === item.path
                    ? "bg-brand text-white"
                    : "text-gray-600 hover:bg-brand-hover-bg hover:text-brand"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-4">
            {user && (
              <span className="text-sm font-semibold text-gray-700 hidden md:block">
                {user.callsign}
              </span>
            )}
            <button
              onClick={handleLogout}
              className="text-sm text-gray-500 hover:text-brand transition-colors"
            >
              Logout
            </button>
          </div>
        </div>

        {/* mobile nav */}
        <div className="lg:hidden border-t border-brand-border overflow-x-auto">
          <div className="flex gap-0 px-4">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`px-3 py-3 text-xs font-bold whitespace-nowrap border-b-2 transition-colors ${
                  location.pathname === item.path
                    ? "border-brand text-brand"
                    : "border-transparent text-gray-500"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-brand-border bg-white mt-12">
        <div className="max-w-7xl mx-auto px-6 py-6 text-center text-sm text-gray-500">
          Qatari Virtual &copy; {new Date().getFullYear()} &mdash; Live Mode
        </div>
      </footer>
    </div>
  );
}
