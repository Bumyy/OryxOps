import { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { fetchBalance, fetchTransactions } from "../store/slices/tokenSlice";

export default function Tokens() {
  const dispatch = useAppDispatch();
  const { balance, transactions } = useAppSelector((s) => s.token);

  useEffect(() => {
    dispatch(fetchBalance());
    dispatch(fetchTransactions({ limit: 50 }));
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <h1 className="text-5xl font-bold text-[--color-brand] mb-8">Tokens & Rewards</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
        <div className="bg-white rounded-2xl border border-[--color-brand-border] shadow-sm p-6">
          <p className="text-sm text-gray-500 font-semibold uppercase tracking-wider">Current Balance</p>
          <p className="text-4xl font-black text-[--color-brand] mt-2">{balance?.balance ?? 0}</p>
        </div>
        <div className="bg-white rounded-2xl border border-[--color-brand-border] shadow-sm p-6">
          <p className="text-sm text-gray-500 font-semibold uppercase tracking-wider">Total Earned</p>
          <p className="text-4xl font-black text-green-600 mt-2">{balance?.total_earned ?? 0}</p>
        </div>
        <div className="bg-white rounded-2xl border border-[--color-brand-border] shadow-sm p-6">
          <p className="text-sm text-gray-500 font-semibold uppercase tracking-wider">Total Spent</p>
          <p className="text-4xl font-black text-red-500 mt-2">{balance?.total_spent ?? 0}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-[--color-brand-border] shadow-sm overflow-hidden">
        <h2 className="text-xl font-bold text-[--color-brand] p-6 pb-0">Transaction History</h2>
        <div className="overflow-x-auto p-6">
          <table className="w-full text-sm">
            <thead className="text-left border-b border-[--color-brand-border]">
              <tr>
                <th className="px-4 py-3 font-semibold text-gray-600">Type</th>
                <th className="px-4 py-3 font-semibold text-gray-600">Amount</th>
                <th className="px-4 py-3 font-semibold text-gray-600">Description</th>
                <th className="px-4 py-3 font-semibold text-gray-600">Date</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr key={tx.id} className="border-b border-[--color-brand-border] last:border-0">
                  <td className="px-4 py-3">
                    <span className="text-xs font-bold uppercase bg-[--color-brand-pale] text-[--color-brand] px-2 py-0.5 rounded-full">
                      {tx.transaction_type.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className={`px-4 py-3 font-semibold ${tx.amount > 0 ? "text-green-600" : "text-red-500"}`}>
                    {tx.amount > 0 ? "+" : ""}{tx.amount}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{tx.description || "—"}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">{new Date(tx.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {transactions.length === 0 && (
            <div className="text-center py-8 text-gray-500">No transactions yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}
