import { useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { fetchTransfers, createTransfer } from "../store/slices/transferSlice";

export default function Transfers() {
  const dispatch = useAppDispatch();
  const { transfers } = useAppSelector((s) => s.transfer);
  const [type, setType] = useState("group_switch");
  const [toValue, setToValue] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    dispatch(fetchTransfers());
  }, []);

  const handleCreate = async () => {
    if (!toValue) return;
    setSubmitting(true);
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
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <h1 className="text-5xl font-bold text-brand mb-8">Transfer Requests</h1>

      <div className="bg-white rounded-2xl border border-brand-border shadow-sm p-6 mb-8">
        <h2 className="text-xl font-bold text-brand mb-4">New Request</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <div>
            <label htmlFor="transfer-type" className="block text-xs font-semibold text-gray-600 mb-1">
              Request Type <span className="text-red-500">*</span>
            </label>
            <select
              id="transfer-type"
              aria-label="Request Type"
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="select select-bordered w-full"
            >
              <option value="group_switch">Group Switch</option>
              <option value="career_path_switch">Career Path Switch</option>
            </select>
          </div>
          <div>
            <label htmlFor="transfer-to" className="block text-xs font-semibold text-gray-600 mb-1">
              Target Group / Path <span className="text-red-500">*</span>
            </label>
            <input
              id="transfer-to"
              aria-label="Target Group or Path Name"
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
              aria-label="Reason for transfer request"
              placeholder="Reason (optional)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="input input-bordered w-full"
            />
          </div>
        </div>
        <button
          onClick={handleCreate}
          disabled={!toValue || submitting}
          aria-label="Submit transfer request"
          className="btn btn-primary rounded-full px-6"
        >
          {submitting ? <span className="loading loading-spinner loading-xs" /> : null}
          Submit Request
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-brand-border shadow-sm overflow-hidden">
        <h2 className="text-xl font-bold text-brand p-6 pb-4">Past Requests</h2>
        <div className="overflow-x-auto">
          <table className="table w-full">
            <thead>
              <tr>
                <th>Type</th>
                <th>To</th>
                <th>Status</th>
                <th>Reviewed By</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {transfers.map((t) => (
                <tr key={t.id}>
                  <td className="font-semibold text-xs uppercase">{t.transfer_type.replace(/_/g, " ")}</td>
                  <td>{t.to_value}</td>
                  <td>
                    <span className={`badge ${
                      t.status === "approved" ? "badge-success" :
                      t.status === "denied" ? "badge-error" :
                      "badge-warning"
                    }`}>{t.status}</span>
                  </td>
                  <td>{t.reviewed_by_name || "—"}</td>
                  <td className="text-xs text-gray-400">{new Date(t.requested_at).toLocaleDateString()}</td>
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
