import { api } from "./client";

export interface ApplicantHours {
  full_book_hours: number;
  only_dep_hours: number;
  only_arri_hours: number;
  total_hours: number;
}

export interface BiddingApplicant {
  id: number;
  session_id: number;
  pilot_id: number;
  pilot_callsign: string;
  pilot_name?: string;
  current_group_name?: string;
  path_switch_required: boolean;
  bidding_fee_paid: number;
  path_switch_fee_paid: number;
  status: "submitted" | "awarded" | "rejected" | "withdrawn";
  applied_at: string;
  reviewed_at?: string;
  admin_notes?: string;
  hours_breakdown?: ApplicantHours;
}

export interface BiddingSession {
  id: number;
  group_id: number;
  group_name: string;
  slots_offered: number;
  bidding_fee_qar: number;
  path_switch_fee_qar: number;
  status: "open" | "under_review" | "closed" | "cancelled";
  opens_at: string;
  closes_at: string;
  created_by: number;
  creator_callsign?: string;
  notes?: string;
  applicant_count: number;
  user_applicant_status?: "submitted" | "awarded" | "rejected" | "withdrawn" | null;
  user_path_switch_required?: boolean;
  applicants?: BiddingApplicant[];
}

export interface BiddingSessionCreatePayload {
  group_id: number;
  slots_offered: number;
  bidding_fee_qar: number;
  path_switch_fee_qar: number;
  duration_days: number;
  notes?: string;
}

export interface FinalizeBiddingPayload {
  winner_pilot_ids: number[];
  admin_notes?: string;
}

export const biddingApi = {
  getSessions: () => api.get<BiddingSession[]>("/bidding/sessions"),
  createSession: (data: BiddingSessionCreatePayload) => api.post<BiddingSession>("/bidding/sessions", data),
  applyForBid: (sessionId: number) => api.post<{ detail: string; balance: number }>(`/bidding/sessions/${sessionId}/apply`),
  withdrawBid: (sessionId: number) => api.post<{ detail: string; refunded_qar: number; balance: number }>(`/bidding/sessions/${sessionId}/withdraw`),
  finalizeSession: (sessionId: number, data: FinalizeBiddingPayload) => api.post<{ detail: string }>(`/bidding/sessions/${sessionId}/finalize`, data),
  cancelSession: (sessionId: number) => api.post<{ detail: string }>(`/bidding/sessions/${sessionId}/cancel`),
};
