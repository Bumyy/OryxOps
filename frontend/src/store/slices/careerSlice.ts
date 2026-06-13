import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { api } from "../../api/client";

interface CareerPath {
  id: number;
  name: string;
  description: string | null;
  ranks: any[];
}

interface PilotCareer {
  id: number;
  career_path_id: number;
  career_path_name: string;
  current_rank_id: number;
  current_rank_name: string;
  sort_order: number;
}

interface CareerProgress {
  pilot_career: any;
  current_rank: any;
  next_rank: any;
  total_routes: number;
  discovered_routes: number;
  discovery_pct: number;
  route_pct_required: number;
  route_pct_complete: boolean;
  takeoffs_count: number;
  takeoffs_required: number;
  takeoffs_complete: boolean;
  landings_count: number;
  landings_required: number;
  landings_complete: boolean;
  can_promote: boolean;
}

interface CareerState {
  paths: CareerPath[];
  pathDetail: CareerPath | null;
  pilotCareers: PilotCareer[];
  progress: Record<string, CareerProgress>;
  loading: boolean;
  error: string | null;
}

const initialState: CareerState = {
  paths: [],
  pathDetail: null,
  pilotCareers: [],
  progress: {},
  loading: false,
  error: null,
};

export const fetchCareerPaths = createAsyncThunk("career/fetchPaths", () =>
  api.get<CareerPath[]>("/careers"),
);

export const fetchCareerPathDetail = createAsyncThunk(
  "career/fetchPathDetail",
  (pathId: number) => api.get<CareerPath>(`/careers/${pathId}`),
);

export const fetchPilotCareers = createAsyncThunk(
  "career/fetchPilotCareers",
  (pilotId: number) => api.get<PilotCareer[]>(`/careers/pilot/${pilotId}`),
);

export const fetchCareerProgress = createAsyncThunk(
  "career/fetchProgress",
  ({ pilotId, pathId }: { pilotId: number; pathId: number }) =>
    api.get<CareerProgress>(`/careers/pilot/${pilotId}/path/${pathId}`),
);

const careerSlice = createSlice({
  name: "career",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchCareerPaths.fulfilled, (state, action) => {
        state.paths = action.payload;
      })
      .addCase(fetchCareerPathDetail.fulfilled, (state, action) => {
        state.pathDetail = action.payload;
      })
      .addCase(fetchPilotCareers.fulfilled, (state, action) => {
        state.pilotCareers = action.payload;
      })
      .addCase(fetchCareerProgress.fulfilled, (state, action) => {
        const { pilotId, pathId } = action.meta.arg;
        state.progress[`${pilotId}_${pathId}`] = action.payload;
      });
  },
});

export default careerSlice.reducer;
