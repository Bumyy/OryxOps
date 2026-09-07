# OryxOps — Complete User Guide & Operational Handbook
**Qatari Virtual · Official Flight Operations Manual**

---

## Table of Contents

1. [Introduction & Core Philosophy](#1-introduction--core-philosophy)
2. [Infinite Flight Live & Persistence](#2-infinite-flight-live--persistence)
3. [The Dashboard — Your Home Base](#3-the-dashboard--your-home-base)
4. [Schedule Calendar — Propose & Book Flights](#4-schedule-calendar--propose--book-flights)
5. [The OryxOps Shop — Proposal Tokens](#5-the-oryxops-shop--proposal-tokens)
6. [Flight Operations — Dispatch, Fuel & PIREP](#6-flight-operations--dispatch-fuel--pirep)
7. [Electronic Flight Bag (EFB)](#7-electronic-flight-bag-efb)
8. [Fleet Registry](#8-fleet-registry)
9. [Transfer Requests](#9-transfer-requests)
10. [Quick Reference Summary](#10-quick-reference-summary)

---

## 1. Introduction & Core Philosophy

Welcome to **OryxOps**, the flagship flight operations platform designed exclusively for **Qatari Virtual**.

In traditional virtual airline systems, management staff face the tedious task of manually creating dozens of flight schedules per day, while pilots often feel disconnected from fleet management. OryxOps completely reinvents this workflow:

- **Pilot-Driven Scheduling** — Pilots propose the exact routes they wish to fly within structured airline boundaries.
- **Economic Progression** — Earn virtual currency (QAR) on every flight to spend within the airline ecosystem.
- **Persistent World Engine** — Integrated directly with Infinite Flight Live mechanics where aircraft remain where they are parked.
- **Flight Crew Realism** — An advanced Electronic Flight Bag (EFB) featuring audio co-pilots, wind analyzers, and real-time dispatch systems.

---

## 2. Infinite Flight Live & Persistence

OryxOps operates on top of Infinite Flight's **persistent fleet model** (IF Live). Unlike standard free-flight modes where an aircraft can be spawned anywhere at any time, Live introduces physical persistence:

- **Location Continuity** — If an aircraft lands at London Heathrow (EGLL), it stays parked at EGLL until another pilot flies, ferries, or repositions it.
- **Active vs. Stored Fleet** — The active fleet size is bounded by the organization's Level (boosted by member Lifts).
- **Fleet Priority** — Active slots determine which aircraft can be assigned active schedules. Stored airframes must wait for active slot expansions before receiving flight duties.

> **IF Live** status for each aircraft is visible on the [Fleet Registry](#8-fleet-registry) page, showing whether an airframe is **Visible**, **Hangared**, or unlinked.

---

## 3. The Dashboard — Your Home Base

**Navigation:** Sidebar → Home (or the OryxOps logo)

The Dashboard is the first page you see after login. It gives a full overview of your pilot status and airline metrics.

### What you'll see on the Dashboard:

**Hero Banner (top)**
- Your live **UTC Zulu Clock** (updates every second)
- Time-based greeting (Good Morning / Afternoon / Evening)
- Your **Pilot Title** (e.g., *Captain*) and **Name**
- Your **Callsign** badge and **Rank** badge
- Your **Pilot Wallet** balance (QAR virtual currency) in the top-right corner

**Active Flight Alert (below hero)**
- If you have an active booking, a **blue banner** appears showing your booked flight number, route (e.g., OTHH → EGLL), and aircraft registration, with a quick **Open EFB** button.
- If no active booking exists, a prompt to **Browse Schedule** is shown instead.

**Stat Cards**
- **Weekly Proposals** — shows `used / total` for your current week's proposal allowance with a progress bar. Turns red when ≥ 80% used. A **Shop →** link takes you to buy more tokens.
- **Pilot Wallet** — your QAR balance plus how many Short-Haul and Long-Haul tokens you have stockpiled.

**Airline Operations Strip (dark gradient panel)**
- **Global Airline Rating** — displayed as a star rating out of 5.0, calculated as the average of all pilots' completed flight reputation scores across the whole airline.
- **Completed Flights** — total revenue legs filed across all pilots since the airline launched.

**Proposal Transactions Log**
- Shows the last 8 proposal token purchases and consumption events (purchases 🛒, consumed ✓, earned ⚡).
- Each entry shows description, flight detail (if applicable), and cost.
- A **Shop** button is in the top-right of this panel.

**Quick Actions Grid (bottom-right)**
- 4 shortcut tiles: **Fleet**, **Schedule**, **Operations**, and **EFB**.

---

## 4. Schedule Calendar — Propose & Book Flights

**Navigation:** Sidebar → Schedule Calendar

This is where the entire flight lifecycle begins. All flight proposals, approvals, and bookings happen here.

### 4.1 Understanding the Calendar

The calendar displays **one week at a time**. It has two view modes:

- **Calendar View** — a 7-day × 24-hour UTC grid. Each cell is clickable to add a flight. Flight blocks appear as colored cards draggable across time slots.
- **List View** — a sorted list of all flights for the week, showing route, times, status, and booking info.

**Controls available:**

| Control | What it does |
|---|---|
| Week navigation (← →) | Browse previous/next weeks |
| Today button | Jump back to the current week |
| Fleet registration filter | Filter by a specific aircraft registration |
| Status filter | Show: Active Flights / All / Drafts / Proposed / Approved / Cancelled |
| My Bookings toggle | Filter to only show flights you are booked on |
| Calendar / List View toggle | Switch between grid and list display |

**Week Status labels:**
- **Current Week** — Active operations week (flights should be Approved)
- **Scheduling Week** — On weekends, next week opens for proposals (flights should be Proposed)
- **Next Week** — Still accepting Draft submissions
- **Past Week** — Historical view (read-only)

**Live UTC Tracker line** — A red horizontal line appears on the current week's calendar showing the live UTC time, so you can see what's happening right now at a glance.

---

### 4.2 Flight Status Colours

| Colour | Status | Meaning |
|---|---|---|
| 🔵 Blue | **Draft** | Created but not yet submitted for review |
| 🟡 Yellow | **Proposed** | Submitted — awaiting management approval |
| 🟢 Green | **Approved** | Approved — available to be booked and flown |
| 🔴 Red | **Cancelled** | Flight cancelled |

---

### 4.3 Step-by-Step Flight Lifecycle

#### Step 1 — Create a Draft

1. Go to **Schedule Calendar**.
2. Navigate to the desired week.
3. Click any empty cell in the grid (or the **+ Add Flight** area in list view) to open the flight creation popup.
4. **Select your aircraft** — the system automatically detects the aircraft's current parked position.
5. **Select a route** — available routes are loaded based on the aircraft's current airport and aircraft type. The system shows flight number, departure, arrival, and duration.
6. Set the **departure time** (UTC) and **ground time** (minimum turnaround minutes).
7. *(Optional)* Set an **Override Dep ICAO** if you need to override the detected position with a different 4-letter ICAO code.
8. Click **Save** → the flight card appears as **Draft** (blue).

#### Step 2 — Propose the Flight

1. Click the Draft flight card.
2. Click **Propose Flight**.
3. Consumes 1 proposal token (free weekly allowance or a purchased token).
4. Card turns yellow (**Proposed**) and queues for management review.

#### Step 3 — Management Approval

- **Approved** → card turns green, available for booking.
- **Rejected** → card is cancelled; token is refunded.

#### Step 4 — Book the Flight

1. Click an approved (green) flight card.
2. Choose your booking type:
   - **Departure Only** — fly takeoff through cruise.
   - **Arrival Only** — spawn ~30 min before ETA and fly approach & landing.
   - **Both Parts (Full Flight)** — fly the complete leg.
3. Click **Book** to confirm.

---

## 5. The OryxOps Shop — Proposal Tokens

**Navigation:** Sidebar → Proposals Shop

The Shop is where you spend earned QAR to purchase extra flight proposal tokens beyond your weekly rank allowance.

### Token Types & Pricing

| Token | Validity | Cost |
|---|---|---|
| **Short-Haul Proposal Token** | Flights under 8 hours | **1,000 QAR** |
| **Long-Haul Proposal Token** | Flights 8 hours or longer | **2,000 QAR** |

---

## 6. Flight Operations — Dispatch, Fuel & PIREP

**Navigation:** Sidebar → Flight Operations

Flight Operations manages your active flight from dispatch to filing your PIREP.

1. **Dispatch Flight** — Generates passenger manifest and unlocks flight tools.
2. **SimBrief Plan** — Generates OFP pre-filled with route and payload.
3. **Fuel Calculation** — Computes fuel burn based on aircraft type and flight duration.
4. **File PIREP** — Submit final flight duration, fuel burned, and landing rate to earn QAR.

---

## 7. Electronic Flight Bag (EFB)

**Navigation:** Sidebar → EFB

The cockpit tablet suite featuring:
- **Briefing Tab** — Route, OFP, SID/STAR procedures.
- **Checklist Tab** — Interactive voice/manual co-pilot checklist.
- **Weather Tab** — Decoded METAR and runway wind components.
- **Aircraft Performance Tab** — V-speeds, flap schedules, engine data.
- **Charts Tab** — Embedded ChartFox airport charts.
- **Settings Tab** — Co-pilot and audio configuration.

---

## 8. Fleet Registry

**Navigation:** Sidebar → Fleet

The Fleet Registry displays all official aircraft in Qatari Virtual's fleet with live IF Live status, current airport, flight hours, and flight history.

---

## 9. Transfer Requests

**Navigation:** Sidebar → Transfers

Submit operational transfer and special assignment requests to management.

---

## 10. Quick Reference Summary

| Action | Navigation Path | Key Requirement / Notes |
|---|---|---|
| View your status & wallet | Dashboard (Home) | Shows rank, weekly proposals, QAR balance |
| **Create a Draft flight** | Schedule Calendar → click time cell | Route loads from current aircraft position |
| **Propose a flight** | Click Draft card → Propose Flight | Consumes 1 proposal token (free or purchased) |
| **Buy extra tokens** | Shop → Buy Token | 1,000 QAR (short-haul) / 2,000 QAR (long-haul) |
| **Book a flight** | Click Approved flight card → Book | Select: Departure Only / Arrival Only / Both Parts |
| **Dispatch flight** | Flight Operations → Dispatch Flight | Departure pilot only; generates pax count |
| **Generate SimBrief OFP** | Flight Operations → Generate SimBrief Plan | Opens SimBrief with route, pax, and flight number |
