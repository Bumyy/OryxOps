import { useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { fetchSettings, updateSetting, promotePilot } from "../store/slices/adminSlice";
import { fetchGroups } from "../store/slices/groupSlice";
import { fetchPilots } from "../store/slices/pilotSlice";

export default function Admin() {
  const dispatch = useAppDispatch();
  const { settings } = useAppSelector((s) => s.admin);
  const { groups } = useAppSelector((s) => s.group);
  const { pilots } = useAppSelector((s) => s.pilot);

  const [promotePilotId, setPromotePilotId] = useState(0);
  const [promotePathId, setPromotePathId] = useState(0);

  useEffect(() => {
    dispatch(fetchSettings());
    dispatch(fetchGroups());
    dispatch(fetchPilots({}));
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <h1 className="text-5xl font-bold text-[--color-brand] mb-8">Admin Panel</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Settings */}
        <div className="bg-white rounded-2xl border border-[--color-brand-border] shadow-sm p-6">
          <h2 className="text-xl font-bold text-[--color-brand] mb-4">Settings</h2>
          <div className="space-y-3">
            {settings.map((s) => (
              <div key={s.setting_key} className="flex items-center justify-between py-2 border-b border-[--color-brand-border] last:border-0">
                <div>
                  <p className="font-semibold text-sm">{s.setting_key}</p>
                  <p className="text-xs text-gray-400">{s.description}</p>
                </div>
                <input
                  defaultValue={s.setting_value}
                  onBlur={(e) => dispatch(updateSetting({ key: s.setting_key, value: e.target.value }))}
                  className="border border-[--color-brand-border] rounded-lg px-3 py-1.5 text-sm w-32"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Promote Pilot */}
        <div className="bg-white rounded-2xl border border-[--color-brand-border] shadow-sm p-6">
          <h2 className="text-xl font-bold text-[--color-brand] mb-4">Promote Pilot</h2>
          <div className="space-y-3">
            <select
              value={promotePilotId}
              onChange={(e) => setPromotePilotId(Number(e.target.value))}
              className="w-full border border-[--color-brand-border] rounded-xl px-4 py-2.5"
            >
              <option value={0}>Select Pilot</option>
              {pilots.map((p) => (
                <option key={p.id} value={p.id}>{p.callsign} — {p.name}</option>
              ))}
            </select>
            <select
              value={promotePathId}
              onChange={(e) => setPromotePathId(Number(e.target.value))}
              className="w-full border border-[--color-brand-border] rounded-xl px-4 py-2.5"
            >
              <option value={0}>Select Career Path</option>
              <option value={1}>Airbus</option>
              <option value={2}>Boeing</option>
            </select>
            <button
              onClick={() => {
                if (promotePilotId && promotePathId) {
                  dispatch(promotePilot({ pilotId: promotePilotId, careerPathId: promotePathId }));
                }
              }}
              className="w-full rounded-full bg-gradient-to-br from-[--color-brand-dark] to-[--color-brand] text-white font-semibold py-2.5 hover:-translate-y-0.5 hover:shadow-lg transition-all duration-300"
            >
              Promote
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
