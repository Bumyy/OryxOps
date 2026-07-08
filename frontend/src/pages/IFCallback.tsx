import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { api } from "../api/client";

export default function IFCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"connecting" | "success" | "error">("connecting");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const code = searchParams.get("code");
    const state = searchParams.get("state");

    if (!code || !state) {
      setStatus("error");
      setMessage("Missing code or state parameter.");
      return;
    }

    (async () => {
      try {
        const qs = new URLSearchParams({ code, state });
        const res = await api.get<{ status: string }>(`/infinite-flight/auth/callback?${qs}`);
        setStatus("success");
        setMessage(res.status);
      } catch (err: any) {
        setStatus("error");
        setMessage(err.message || "Failed to connect.");
      }
    })();
  }, [searchParams]);

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-brand-dark text-white">
      {status === "connecting" && (
        <>
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-light mb-4" />
          <p className="text-sm text-gray-400">Connecting to Infinite Flight...</p>
        </>
      )}
      {status === "success" && (
        <>
          <div className="text-green-400 text-5xl mb-4">&#10003;</div>
          <p className="text-lg font-semibold mb-2">Connected!</p>
          <p className="text-sm text-gray-400 mb-6">{message}</p>
          <button
            onClick={() => navigate("/admin/settings")}
            className="px-4 py-2 bg-brand-light text-black rounded-lg font-medium"
          >
            Back to Settings
          </button>
        </>
      )}
      {status === "error" && (
        <>
          <div className="text-red-400 text-5xl mb-4">&#10007;</div>
          <p className="text-lg font-semibold mb-2">Connection Failed</p>
          <p className="text-sm text-gray-400 max-w-md text-center mb-6">{message}</p>
          <button
            onClick={() => navigate("/admin/settings")}
            className="px-4 py-2 bg-brand-light text-black rounded-lg font-medium"
          >
            Back to Settings
          </button>
        </>
      )}
    </div>
  );
}
