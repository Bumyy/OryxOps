import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { login, clearError } from "../store/slices/authSlice";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { loading, error, token } = useAppSelector((s) => s.auth);

  useEffect(() => {
    if (token) {
      navigate("/");
    }
  }, [token, navigate]);

  if (token) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await dispatch(login({ email, password }));
    if (login.fulfilled.match(result)) {
      navigate("/");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-dark to-brand px-6">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black text-brand tracking-wider">
            QRV<span className="text-brand-light">LIVE</span>
          </h1>
          <p className="text-gray-500 mt-2">Qatari Virtual &mdash; Live Mode</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
              {error}
              <button onClick={() => dispatch(clearError())} className="float-right font-bold ml-2">&times;</button>
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full border border-brand-border rounded-xl px-4 py-2.5 focus:border-brand focus:ring-1 focus:ring-brand/30 transition-colors"
              placeholder="pilot@qatarivirtual.com"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full border border-brand-border rounded-xl px-4 py-2.5 focus:border-brand focus:ring-1 focus:ring-brand/30 transition-colors"
              placeholder="Enter your password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-gradient-to-br from-brand-dark to-brand text-white font-semibold py-3 hover:-translate-y-0.5 hover:shadow-lg transition-all duration-300 disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
