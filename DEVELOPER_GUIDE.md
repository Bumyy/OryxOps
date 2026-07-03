# ✈️ OryxOps Full-Stack Developer Guide

Welcome to **OryxOps (QRV Live)**! This document serves as a comprehensive guide for developers onboarding onto this project. It outlines the core architecture, data models, logic engines, and implementation details of both the FastAPI backend and React frontend.

---

## 📌 System Overview & Aim
OryxOps is an Electronic Flight Bag (EFB) and virtual airline flight operations dashboard designed for simulation pilots flying under the **Qatari Virtual (QRV)** banner.

### Key Objectives:
1. **Interactive Checklist Co-Pilot**: A hands-free, voice-driven checklist assistant that reads challenges and listens for specific pilot responses using speech synthesis and fuzzy string matching.
2. **Weather & Performance Hub**: A real-time meteorological portal that proxies data from the NOAA Aviation Weather Center, decodes flight categories, and projects wind components (headwind, tailwind, crosswind) onto active runways.
3. **Flight Booking & Schedules**: Integrated SimBrief flight plan parsing, routing calendar, and active booking control.
4. **Flying Groups & Fleet Control**: Coordination of schedules, pilot ranks, transfer statistics, and active group assignments.

---

## 🏗️ System Architecture

```text
               +--------------------------------------+
               |             React Client             |
               |         (Vite, Tailwind, Redux)      |
               +------------------+-------------------+
                                  |
                        HTTPS (REST API JSON)
                                  |
                                  v
               +--------------------------------------+
               |           FastAPI Backend            |
               |        (Uvicorn, Python, Pydantic)   |
               +------------------+-------------------+
                                  |
                          SQLAlchemy (Async)
                                  v
               +--------------------------------------+
               |           MySQL Database             |
               |          (Remote / Local)            |
               +--------------------------------------+
```

---

## 📂 Project Directory Structure

```text
OryxOps/
├── backend/                  # FastAPI Application
│   ├── app/
│   │   ├── api/              # Endpoints & Router Maps
│   │   │   ├── endpoints/    # Feature routers (auth, efb, bookings, etc.)
│   │   │   └── router.py     # Central API Router Registration
│   │   ├── core/             # Core configurations (database, security, deps)
│   │   ├── models/           # SQLAlchemy DB Models (live_models.py)
│   │   ├── schemas/          # Pydantic Schemas (data validation)
│   │   ├── services/         # Business logic layer
│   │   └── main.py           # FastAPI Application entrypoint
│   ├── requirements.txt      # Python Dependencies
│   └── run.py                # Backend dev server startup script
├── frontend/                 # Vite React TypeScript Application
│   ├── src/
│   │   ├── api/              # Fetch wrapper client (client.ts)
│   │   ├── assets/           # Static assets & checklist JSON configurations
│   │   ├── components/       # UI Components & EFB modules
│   │   ├── hooks/            # Custom React Hooks
│   │   ├── pages/            # View Pages (Dashboard, EFB, Calendar, Admin)
│   │   ├── store/            # Redux Toolkit global store & slices
│   │   ├── App.tsx           # Router mappings & Auth Initializer
│   │   └── main.tsx          # React application entrypoint
│   ├── package.json          # Node Dependencies & scripts
│   └── vite.config.ts        # Vite configuration & dev proxy
├── untracked_token_files/    # Legacy reward token code preserves (ignored)
└── start_app.bat             # Full-Stack Local Launcher script
```

---

## 🎛️ Frontend System (`frontend/`)

### 1. State Management (Redux Toolkit)
The application uses Redux Toolkit to manage global state asynchronously. The store is configured in `frontend/src/store/store.ts`.
- **authSlice**: Manages login/logout states, JWT token storage in `localStorage`, and fetches user profiles.
- **pilotSlice**: Tracks callsigns, flight logs, careers, and avatar URLs.
- **bookingSlice**: Handles scheduling, active pilot flight reservations, and dispatch statuses.
- **discoverySlice**: Tracks custom route explorations and exploration stats.
- **groupSlice**: Coordinates team flying groups, members, and group-assigned fleet.

### 2. Interactive Voice Co-Pilot Engine
Located in `frontend/src/components/efb/EFBChecklist.tsx`, the co-pilot utilizes browser Speech API interfaces to establish a hands-free cockpit checklist workflow.

#### Voice Flow & Gating State Machine:
```text
  [Idle / Wait]
        │ (Start Co-Pilot)
        v
  [SPEAKING_CHALLENGE] ──> (Deactivates Mic) ──> Speaks Item Challenge (TTS)
        │
        v
  [SPEAKING_RESPONSE] ──> (Deactivates Mic) ──> Speaks Expected Response State
        │
        v
  [LISTENING] ──────────> (Activates Mic) ────> Listens to Pilot
        │
        ├── (Speech Detected) ──> [VALIDATING] ──> Similarity Check (Jaro-Winkler)
        │                                             │
        │                                             ├── (Score >= 82%) ──> [SUCCESS] ──> (Chime & Checkbox) ──> [Next Item]
        │                                             └── (Score < 82%) ───> [LISTENING] (Re-listens)
        v
  [Mic Error / Pause]
```

- **Mic Gating**: The microphone is explicitly turned off during Text-to-Speech (TTS) announcements to prevent the co-pilot from hearing and validating its own voice readback.
- **Fuzzy String Matching**: Uses Levenshtein and Jaro-Winkler distance algorithms to project score coefficients. A spoken phrase is accepted if its similarity is $\ge 82\%$ against the target checklist response.
- **Web Audio Oscillators**: Replaces heavy audio file payloads by synthesizing real-time radio click mic-pops (VHF radio carrier static) and success alert chimes using native Web Audio API oscillators (`OscillatorNode`).

### 3. Weather & Performance Hub
Located in `frontend/src/components/efb/EFBWeather.tsx`.
- **METAR Decoders**: Decodes parameters like temperature spreads, wind direction/speeds/gusts, altimeter conversions ($hPa \leftrightarrow inHg$), and parses VFR/MVFR/IFR rules.
- **Runway Wind Calculator**: Projecting wind vectors using trigonometric formulas:
  $$\text{Headwind} = \text{Wind Speed} \times \cos(\theta)$$
  $$\text{Crosswind} = \text{Wind Speed} \times \sin(\theta)$$
  Auto-resolves planned runway headings and provides reciprocal calculation options (e.g. `16R` vs `34L`).

---

## ⚙️ Backend System (`backend/`)

### 1. Database & Models
Defined in `backend/app/models/live_models.py`, SQLAlchemy maps Python classes asynchronously to MySQL tables:
- **Pilot**: Stores pilot records, encrypted passwords, ratings, and active flight stats.
- **LiveFlightBooking**: Tracks active flight reservations. Contains a `booking_type` column (`"departure"`, `"arrival"`, or `"both"`) to handle airport bookings.
- **LiveFlyingGroup**: Links pilots together under virtual airline subgroups for multiplayer sessions.
- **Permission & StaffRole**: Dictates administrative authorization levels.

### 2. Authentication Dependencies
Authentication is handled via JWT tokens using FastAPI dependency injection in `backend/app/core/dependencies.py`:
- **CORS Bypass**: Cross-Origin Resource Sharing is mapped via FastAPI middleware to whitelist local development servers (`http://localhost:3000`) and the production site.
- **HTTPBearer Mapping**: Configured with `auto_error=False` to manually handle missing authentication headers. It raises a clean `401 Unauthorized` instead of the default `403 Forbidden` code to prevent the client fetch wrapper from misinterpreting the unauthenticated state.
- **Trailing Slash Redirect Resolution**: `/api/auth/me` and `/api/auth/me/` are bound together in `backend/app/api/endpoints/auth.py` to prevent redirection loops that strip the `Authorization` header on browser redirects.

### 3. Weather Proxy Controller
Because aviation weather REST services block direct client requests via CORS policies, the route `/api/efb/weather` (defined in `backend/app/api/endpoints/efb.py`) acts as an API proxy. It queries the NOAA server, extracts the last 5 hours of weather METAR history, removes duplicates, compiles the active TAF forecast, and serves a sanitized payload to the React frontend.

---

## 🛠️ Local Development Setup

### Prerequisites
- Python 3.12+
- Node.js 18+
- MySQL Server (if running local DB)

### Running Locally
To launch both servers concurrently, run the automated launcher script at the root:
```bash
./start_app.bat
```
Alternatively, start them manually in separate terminal windows:

#### Start Backend:
```bash
cd backend
venv\Scripts\activate
pip install -r requirements.txt
python run.py
```
*Backend runs on: `http://localhost:8000`*

#### Start Frontend:
```bash
cd frontend
npm install
npm run dev
```
*Frontend runs on: `http://localhost:3000`*

---

## 🚀 Production Deployment Checklist

When deploying to production, follow these crucial guidelines:

### 1. Database Schema Sync
Ensure your database tables match the `backend/app/models/live_models.py` definitions. 
> [!IMPORTANT]
> If adding new columns like `booking_type` to `live_flight_bookings`, make sure the database user has `ALTER` privileges. If the user lacks permission, manually run the migration SQL statement on your database:
> ```sql
> ALTER TABLE live_flight_bookings ADD COLUMN booking_type VARCHAR(20) NOT NULL DEFAULT 'both';
> ```

### 2. Frontend Assets Compiling
The React application is built locally and outputted to the `frontend/dist/` directory, which is excluded from Git tracking via `.gitignore`.
> [!WARNING]
> Simply pulling from Git will **not** update the frontend code on your production server. After pulling changes on the host, you **MUST** run:
> ```bash
> cd frontend
> npm install
> npm run build
> ```
> This compiles the React TypeScript source tree and generates updated production-ready HTML/JS/CSS assets.
