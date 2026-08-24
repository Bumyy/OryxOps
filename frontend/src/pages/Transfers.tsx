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
    const res = await dispatch(createTransfer({ transfer_type: type, to_value: toValue, reason }));
    if (createTransfer.fulfilled.match(res)) {
      alert("Transfer request submitted successfully!");
      setToValue("");
      setReason("");
      dispatch(fetchTransfers());
    } else {
      alert("Failed to submit transfer request: " + (res.error?.message || "Unknown error"));
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <h1 className="text-5xl font-bold text-brand mb-8">Transfer Requests</h1>

      <div className="card bg-base-100 border border-base-300 shadow-sm p-6 mb-8">
        <h2 className="text-xl font-bold text-brand mb-4">New Request</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <div className="form-control w-full">
            <label htmlFor="transfer-type" className="label text-xs font-semibold text-base-content/70">
              Request Type
            </label>
            <select
              id="transfer-type"
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="select select-bordered w-full"
            >
              <option value="group_switch">Group Switch</option>
              <option value="career_path_switch">Career Path Switch</option>
            </select>
          </div>

          <div className="form-control w-full">
            <label htmlFor="transfer-target" className="label text-xs font-semibold text-base-content/70">
              Target Group / Path
            </label>
            <input
              id="transfer-target"
              placeholder="e.g. Airbus Fleet / Alpha Group"
              value={toValue}
              onChange={(e) => setToValue(e.target.value)}
              className="input input-bordered w-full"
            />
          </div>

          <div className="form-control w-full">
            <label htmlFor="transfer-reason" className="label text-xs font-semibold text-base-content/70">
              Reason (Optional)
            </label>
            <input
              id="transfer-reason"
              placeholder="Reason for request"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="input input-bordered w-full"
            />
          </div>
        </div>
        <div className="flex justify-start">
          <button onClick={handleCreate} className="btn btn-primary">
            Submit Request
          </button>
        </div>
      </div>

      <div className="card bg-base-100 border border-base-300 shadow-sm overflow-hidden">
        <h2 className="text-xl font-bold text-brand p-6 pb-4">Past Requests</h2>
        <div className="overflow-x-auto">
          <table className="table table-zebra w-full text-sm">
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
                  <td className="text-xs opacity-70">{new Date(t.requested_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {transfers.length === 0 && (
          <div className="text-center py-8 text-base-content/60">No transfer requests yet.</div>
        )}
      </div>
    </div>
  );
}
