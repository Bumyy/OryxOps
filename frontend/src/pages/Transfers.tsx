import { useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { fetchTransfers, createTransfer } from "../store/slices/transferSlice";

export default function Transfers() {
  const dispatch = useAppDispatch();
  const { transfers } = useAppSelector((s) => s.transfer);
  const [type, setType] = useState("group_switch");
  const [toValue, setToValue] = useState("");
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    dispatch(fetchTransfers());
  }, [dispatch]);

  const handleCreate = async () => {
    if (!toValue || isSubmitting) return;
    setIsSubmitting(true);
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
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <h1 className="text-5xl font-bold text-brand mb-8">Transfer Requests</h1>

      <div className="bg-base-100 rounded-2xl border border-brand-border shadow-sm p-6 mb-8">
        <h2 className="text-xl font-bold text-brand mb-4">New Request</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="transfer-type-select" className="text-xs font-bold text-gray-500 uppercase">
              Request Type
            </label>
            <select
              id="transfer-type-select"
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="select select-bordered select-sm w-full font-medium"
            >
              <option value="group_switch">Group Switch</option>
              <option value="career_path_switch">Career Path Switch</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="transfer-to-input" className="text-xs font-bold text-gray-500 uppercase">
              Target (Group / Path) <span className="text-red-500">*</span>
            </label>
            <input
              id="transfer-to-input"
              placeholder="e.g. Flight Operations"
              value={toValue}
              onChange={(e) => setToValue(e.target.value)}
              className="input input-bordered input-sm w-full font-medium"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="transfer-reason-input" className="text-xs font-bold text-gray-500 uppercase">
              Reason (Optional)
            </label>
            <input
              id="transfer-reason-input"
              placeholder="Brief reason for transfer"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="input input-bordered input-sm w-full font-medium"
            />
          </div>
        </div>

        <button
          onClick={handleCreate}
          disabled={!toValue || isSubmitting}
          aria-label="Submit transfer request"
          className="btn btn-primary btn-sm rounded-full font-semibold px-6 disabled:opacity-50"
        >
          {isSubmitting ? (
            <>
              <span className="loading loading-spinner loading-xs" />
              Submitting...
            </>
          ) : (
            "Submit Request"
          )}
        </button>
      </div>

      <div className="bg-base-100 rounded-2xl border border-brand-border shadow-sm overflow-hidden">
        <h2 className="text-xl font-bold text-brand p-6 pb-4">Past Requests</h2>
        <div className="overflow-x-auto">
          <table className="table w-full text-sm">
            <thead className="bg-base-200">
              <tr>
                <th className="px-5 py-3 font-semibold text-xs uppercase">Type</th>
                <th className="px-5 py-3 font-semibold text-xs uppercase">To</th>
                <th className="px-5 py-3 font-semibold text-xs uppercase">Status</th>
                <th className="px-5 py-3 font-semibold text-xs uppercase">Reviewed By</th>
                <th className="px-5 py-3 font-semibold text-xs uppercase">Date</th>
              </tr>
            </thead>
            <tbody>
              {transfers.map((t) => (
                <tr key={t.id} className="border-t border-brand-border">
                  <td className="px-5 py-3 font-semibold text-xs uppercase">{t.transfer_type.replace(/_/g, " ")}</td>
                  <td className="px-5 py-3">{t.to_value}</td>
                  <td className="px-5 py-3">
                    <span
                      className={`badge badge-sm font-bold uppercase ${
                        t.status === "approved"
                          ? "badge-success"
                          : t.status === "denied"
                          ? "badge-error"
                          : "badge-warning"
                      }`}
                    >
                      {t.status}
                    </span>
                  </td>
                  <td className="px-5 py-3">{t.reviewed_by_name || "—"}</td>
                  <td className="px-5 py-3 text-xs opacity-70">{new Date(t.requested_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {transfers.length === 0 && (
          <div className="text-center py-8 opacity-70">No transfer requests yet.</div>
        )}
      </div>
    </div>
  );
}
