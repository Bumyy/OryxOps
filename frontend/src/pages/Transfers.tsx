import { useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { fetchTransfers, createTransfer } from "../store/slices/transferSlice";

export default function Transfers() {
  const dispatch = useAppDispatch();
  const { transfers } = useAppSelector((s) => s.transfer);
  const [type, setType] = useState("group_switch");
  const [toValue, setToValue] = useState("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    dispatch(fetchTransfers());
  }, []);

  const handleCreate = async () => {
    if (!toValue) return;
    await dispatch(createTransfer({ transfer_type: type, to_value: toValue, reason }));
    setToValue("");
    setReason("");
    dispatch(fetchTransfers());
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <h1 className="text-5xl font-bold text-[--color-brand] mb-8">Transfer Requests</h1>

      <div className="bg-white rounded-2xl border border-[--color-brand-border] shadow-sm p-6 mb-8">
        <h2 className="text-xl font-bold text-[--color-brand] mb-4">New Request</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <select value={type} onChange={(e) => setType(e.target.value)} className="border border-[--color-brand-border] rounded-xl px-4 py-2.5">
            <option value="group_switch">Group Switch</option>
            <option value="career_path_switch">Career Path Switch</option>
          </select>
          <input placeholder="To (group name / path name)" value={toValue} onChange={(e) => setToValue(e.target.value)} className="border border-[--color-brand-border] rounded-xl px-4 py-2.5" />
          <input placeholder="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} className="border border-[--color-brand-border] rounded-xl px-4 py-2.5" />
        </div>
        <button onClick={handleCreate} className="rounded-full bg-gradient-to-br from-[--color-brand-dark] to-[--color-brand] text-white font-semibold text-sm px-5 py-2 hover:-translate-y-0.5 hover:shadow-lg transition-all">
          Submit Request
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-[--color-brand-border] shadow-sm overflow-hidden">
        <h2 className="text-xl font-bold text-[--color-brand] p-6 pb-4">Past Requests</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left bg-[--color-brand-pale]">
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
                <tr key={t.id} className="border-t border-[--color-brand-border]">
                  <td className="px-5 py-3 font-semibold text-xs uppercase">{t.transfer_type.replace(/_/g, " ")}</td>
                  <td className="px-5 py-3">{t.to_value}</td>
                  <td className="px-5 py-3">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      t.status === "approved" ? "bg-green-100 text-green-700" :
                      t.status === "denied" ? "bg-red-100 text-red-700" :
                      "bg-yellow-100 text-yellow-700"
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
