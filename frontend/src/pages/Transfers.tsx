import { useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { fetchTransfers, createTransfer } from "../store/slices/transferSlice";

export default function Transfers() {
  const dispatch = useAppDispatch();
  const { transfers } = useAppSelector((s) => s.transfer);
  const [type, setType] = useState("group_switch");
  const [toValue, setToValue] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    dispatch(fetchTransfers());
  }, []);

  const handleCreate = async () => {
    if (!toValue.trim()) return;
    setLoading(true);
    try {
      const res = await dispatch(createTransfer({ transfer_type: type, to_value: toValue, reason }));
      if (createTransfer.fulfilled.match(res)) {
        alert("Transfer request submitted successfully!");
        setToValue("");
        setReason("");
        dispatch(fetchTransfers());
      } else {
        alert("Failed to submit transfer request: " + (res.error?.message || "Unknown error"));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <h1 className="text-5xl font-bold text-brand mb-8">Transfer Requests</h1>

      <div className="bg-white rounded-2xl border border-brand-border shadow-sm p-6 mb-8">
        <h2 className="text-xl font-bold text-brand mb-4">New Request</h2>
        <form onSubmit={(e) => { e.preventDefault(); handleCreate(); }}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div>
              <label htmlFor="transfer-type" className="block text-xs font-semibold text-gray-600 mb-1">
                Transfer Type <span className="text-red-500">*</span>
              </label>
              <select
                id="transfer-type"
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="select select-bordered w-full font-medium"
              >
                <option value="group_switch">Group Switch</option>
                <option value="career_path_switch">Career Path Switch</option>
              </select>
            </div>

            <div>
              <label htmlFor="transfer-to" className="block text-xs font-semibold text-gray-600 mb-1">
                To (Group / Path) <span className="text-red-500">*</span>
              </label>
              <input
                id="transfer-to"
                type="text"
                required
                placeholder="To (group name / path name)"
                value={toValue}
                onChange={(e) => setToValue(e.target.value)}
                className="input input-bordered w-full"
              />
            </div>

            <div>
              <label htmlFor="transfer-reason" className="block text-xs font-semibold text-gray-600 mb-1">
                Reason (Optional)
              </label>
              <input
                id="transfer-reason"
                type="text"
                placeholder="Reason (optional)"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="input input-bordered w-full"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !toValue.trim()}
            className="rounded-full bg-gradient-to-br from-brand-dark to-brand text-white font-semibold text-sm px-5 py-2 hover:-translate-y-0.5 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
            {loading ? "Submitting..." : "Submit Request"}
          </button>
        </form>
      </div>

      <div className="bg-white rounded-2xl border border-brand-border shadow-sm overflow-hidden">
        <h2 className="text-xl font-bold text-brand p-6 pb-4">Past Requests</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left bg-brand-pale">
              <tr>
                <th className="px-5 py-3 font-semibold text-gray-600">Type</th>
                <th className="px-5 py-3 font-semibold text-gray-600">To</th>
                <th className="px-5 py-3 font-semibold text-gray-600">Status</th>
                <th className="px-5 py-3 font-semibold text-gray-600">Reviewed By</th>
                <th className="px-5 py-3 font-semibold text-gray-600">Date</th>
              </tr>
            </thead>
            <tbody>
              {transfers.map((t) => (
                <tr key={t.id} className="border-t border-brand-border">
                  <td className="px-5 py-3 font-semibold text-xs uppercase">{t.transfer_type.replace(/_/g, " ")}</td>
                  <td className="px-5 py-3">{t.to_value}</td>
                  <td className="px-5 py-3">
                    <span className={`badge badge-sm font-bold uppercase ${
                      t.status === "approved" ? "badge-success" :
                      t.status === "denied" ? "badge-error" :
                      "badge-warning"
                    }`}>{t.status}</span>
                  </td>
                  <td className="px-5 py-3">{t.reviewed_by_name || "—"}</td>
                  <td className="px-5 py-3 text-xs text-gray-400">{new Date(t.requested_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {transfers.length === 0 && (
          <div className="text-center py-8 text-gray-500">No transfer requests yet.</div>
        )}
      </div>
    </div>
  );
}
