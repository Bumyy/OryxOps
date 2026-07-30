# OryxOps — Complete User Guide & Operational Handbook
**Qatari Virtual · Official Flight Operations & Career Mode Manual**

---

## Table of Contents

1. [Introduction & Core Philosophy](#1-introduction--core-philosophy)
2. [Infinite Flight Live & Persistence](#2-infinite-flight-live--persistence)
3. [Pilot Ranks, Career Paths & Groups](#3-pilot-ranks-career-paths--groups)
4. [The Dashboard — Your Home Base](#4-the-dashboard--your-home-base)
5. [Schedule Calendar — Propose & Book Flights](#5-schedule-calendar--propose--book-flights)
6. [The OryxOps Shop — Proposal Tokens](#6-the-oryxops-shop--proposal-tokens)
7. [Flight Operations — Dispatch, Fuel & PIREP](#7-flight-operations--dispatch-fuel--pirep)
8. [Electronic Flight Bag (EFB)](#8-electronic-flight-bag-efb)
9. [Fleet Registry](#9-fleet-registry)
10. [Flying Groups](#10-flying-groups)
11. [Career Center](#11-career-center)
12. [Transfer Requests](#12-transfer-requests)
13. [Quick Reference Summary](#13-quick-reference-summary)

---

## 1. Introduction & Core Philosophy

Welcome to **OryxOps**, the flagship operations platform and custom career mode designed exclusively for **Qatari Virtual**.

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

> **IF Live** status for each aircraft is visible on the [Fleet Registry](#9-fleet-registry) page, showing whether an airframe is **Visible**, **Hangared**, or unlinked.

---

## 3. Pilot Ranks, Career Paths & Groups

### 3.1 Pilot Ranks

Access to aircraft is governed by your **Pilot Rank** and assigned **Fleet Group**. OryxOps features four primary operational ranks per career pathway:

| Rank | Pathway | Weekly Free Proposals |
|---|---|---|
| First Officer | Airbus or Boeing | 3 proposals / week |
| Captain | Airbus or Boeing | 7 proposals / week |
| Senior First Officer | Airbus or Boeing | 3 proposals / week |
| (next rank) | — | — |

> Ranks are assigned and promoted by staff through the Admin panel. You can view your current rank on the [Dashboard](#4-the-dashboard--your-home-base) and your full rank ladder in the [Career Center](#11-career-center).

---

### 3.2 Fleet Groups & Capacity Formula

The airline's fleet is organized into 6 operational groups. Group capacities are governed by a strict slot formula:

```
Max Pilot Slots per Group = 2 + (2 × Number of Aircraft in Group)
```

| Group | Allocated Aircraft | Aircraft Count | Max Pilot Slots |
|---|---|---|---|
| Airbus Alpha | 3× A350-1000 (A35K), 2× A380-800 (A388) | 5 | 12 |
| Airbus Bravo | 3× A350-900 (A359), 2× A330-300 (A333) | 5 | 12 |
| Airbus Charlie | 1× A350-900 (A359), 1× A321-200 (A321) | 2 | 6 |
| Boeing Delta | 3× 777-300ER (B77W), 2× 787-8 (B788) | 5 | 12 |
| Boeing Echo | 3× 777-200LR (B77L), 2× 777-300ER (B77W) | 5 | 12 |
| Boeing Foxtrot | 2× 787-8 (B788), 1× 777-200LR (B77L) | 3 | 8 |

> **Capacity bars** on the [Flying Groups](#10-flying-groups) page show live slot usage for each group. Green = plenty of open slots, Amber = filling up, Red = full.

---

## 4. The Dashboard — Your Home Base

**Navigation:** Sidebar → Home (or the OryxOps logo)

The Dashboard is the first page you see after login. It gives a full overview of your pilot status and airline metrics.

![Dashboard Overview — placeholder: screenshot of the pilot dashboard showing rank banner, active booking, stat cards, and airline metrics strip]

### What you'll see on the Dashboard:

**Hero Banner (top)**
- Your live **UTC Zulu Clock** (updates every second)
- Time-based greeting (Good Morning / Afternoon / Evening)
- Your **Pilot Title** (e.g., *Captain*) and **Name**
- Your **Callsign** badge, **Group** badge, and **Rank** badge
- Your **Pilot Wallet** balance (QAR virtual currency) in the top-right corner

**Active Flight Alert (below hero)**
- If you have an active booking, a **blue banner** appears showing your booked flight number, route (e.g., OTHH → EGLL), and aircraft registration, with a quick **Open EFB** button.
- If no active booking exists, a prompt to **Browse Schedule** is shown instead.

**Stat Cards (3 cards)**
- **Current Rank** — your rank name and career path. Clicking takes you to [Career Center](#11-career-center).
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
- 4 shortcut tiles: **Fleet**, **Groups**, **Schedule**, and **EFB**.

---

## 5. Schedule Calendar — Propose & Book Flights

**Navigation:** Sidebar → Schedule Calendar

This is where the entire flight lifecycle begins. All flight proposals, approvals, and bookings happen here.

![Schedule Calendar view — placeholder: screenshot showing the weekly calendar grid with flight blocks in draft/proposed/approved colors]

### 5.1 Understanding the Calendar

The calendar displays **one week at a time**, filtered by **Flying Group**. It has two view modes:

- **Calendar View** — a 7-day × 24-hour UTC grid. Each cell is clickable to add a flight. Flight blocks appear as colored cards draggable across time slots.
- **List View** — a sorted list of all flights for the week, showing route, times, status, and booking info.

**Controls available:**

| Control | What it does |
|---|---|
| Group selector (dropdown) | Switch between flying groups to see their flights |
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

**Wave Windows** — Green (departure wave) or Blue (arrival wave) shaded bands appear on the calendar to indicate the management-defined scheduling windows. Flights should ideally fall within these bands.

---

### 5.2 Flight Status Colours

| Colour | Status | Meaning |
|---|---|---|
| 🔵 Blue | **Draft** | Created but not yet submitted for review |
| 🟡 Yellow | **Proposed** | Submitted — awaiting management approval |
| 🟢 Green | **Approved** | Approved — available to be booked and flown |
| 🔴 Red | **Cancelled** | Flight cancelled |

---

### 5.3 Step-by-Step Flight Lifecycle

#### Step 1 — Create a Draft

1. Go to **Schedule Calendar** → select your flying group.
2. Navigate to the desired week.
3. Click any empty cell in the grid (or the **+ Add Flight** area in list view) to open the flight creation popup.
4. **Select your aircraft** — the system automatically detects the aircraft's current parked position.
5. **Select a route** — available routes are loaded based on the aircraft's current airport and aircraft type. The system shows flight number, departure, arrival, and duration.
6. Set the **departure time** (UTC) and **ground time** (minimum turnaround minutes).
7. *(Optional)* Set an **Override Dep ICAO** if you need to override the detected position with a different 4-letter ICAO code.
8. Click **Save** → the flight card appears as **Draft** (blue).

> **Position Mismatch Warnings** — If a scheduled flight departs from a different airport than where the aircraft will actually be (based on previous scheduled arrivals), a red warning banner appears. Similarly, **Ground Time Warnings** appear if the gap between consecutive flights is shorter than the required ground time. Warnings can be dismissed individually.

---

#### Step 2 — Propose the Flight (Spend a Token)

Once your Draft is ready:

1. Click the flight card to open it.
2. Click **Propose Flight**.
3. This consumes **1 Proposal Token** from your weekly allowance (or a purchased token if your free allowance is used up).
4. The card turns **yellow (Proposed)** and is queued for management review.

**Weekly Free Allowances:**

| Rank | Free Proposals / Week |
|---|---|
| First Officer | 3 |
| Captain | 7 |

> **Token Refund Guarantee** — If management **rejects** your proposal, your token or QAR fee is automatically refunded. If **approved**, the token is consumed.

---

#### Step 3 — Management Approval

Management reviews all proposed flights and either **approves** or **rejects** them.

- **Approved** → card turns green. The flight is now available to be booked and flown.
- **Rejected** → card is cancelled; your token/QAR is refunded.

> Executives can also use the **Approve Proposed Flights** bulk button to approve all proposed flights for the week at once. They can also **Clone Last Week**'s schedule to the current week as drafts.

---

#### Step 4 — Book the Flight

Once a flight is **Approved**, any eligible pilot in the group can book it:

1. Click the approved flight card.
2. Choose your **Booking Type**:
   - **Departure Only** — You fly the takeoff and climb out, hand off to the arrival pilot at cruise.
   - **Arrival Only** — You join the in-progress flight approximately 30 minutes before ETA and fly the approach and landing.
   - **Both Parts (Full Flight)** — You fly the entire leg from pushback at departure to gate at destination.
3. Click **Book** → your booking is confirmed and visible on the flight card.

---

#### 5.4 Editing & Managing Flights

- **Drag & Drop** (Calendar View) — Admins and executives can drag flight blocks to reschedule them to a new day/time slot.
- **Edit Times** — Click a flight card and edit departure/arrival times directly.
- **Delete / Cancel** — Available on your own Draft or Proposed flights.

---

## 6. The OryxOps Shop — Proposal Tokens

**Navigation:** Sidebar → Shop  (or Dashboard → **Shop →** link)

![OryxOps Shop — placeholder: screenshot of the proposal shop showing short-haul and long-haul token products with Buy Token buttons]

The Shop is where you spend your earned QAR to **pre-purchase extra proposal tokens** beyond your weekly free allowance.

**Your wallet balance** is displayed at the top-right of the shop page.

### Token Products

| Product | Flight Duration | Cost | Effect |
|---|---|---|---|
| **Short-Haul Proposal Token** | Under 8 hours (< 8h) | 1,000 QAR | Consumed instead of charging 1,000 QAR when proposing a short-haul flight beyond your free weekly limit |
| **Long-Haul Proposal Token** | 8 hours or more (≥ 8h) | 2,000 QAR | Consumed instead of charging 2,000 QAR when proposing a long-haul flight beyond your free weekly limit |

### How Tokens Work

1. Purchase tokens in the Shop using your QAR balance.
2. Tokens are stored in your account (visible on Dashboard stat card and Shop page).
3. When you go to propose a flight **beyond your free weekly limit**, the system automatically uses a stored token of the right type (short or long) instead of charging your wallet directly.
4. Tokens are consumed only if management **approves** your proposal. If rejected → token is refunded.

> **Insufficient Funds** — The Buy button is disabled and labelled "Insufficient Funds" if your wallet balance is below the token cost.

Your current token holdings are shown in the **Your Proposal Tokens** panel:
- **Short-Haul Tokens** count
- **Long-Haul Tokens** count

---

## 7. Flight Operations — Dispatch, Fuel & PIREP

**Navigation:** Sidebar → Flight Operations

![Flight Operations page — placeholder: screenshot of the dispatch deck, fuel estimator, and PIREP form]

This is where you manage everything **after booking and before/during the actual flight**. It requires an **active booking** — if you have no current booking, the page shows a message prompting you to book a flight first.

### 7.1 Active Booking Overview Card

At the top of the page, your current booked flight is displayed:
- **Route** (e.g., OTHH → EGLL)
- **Flight Number**
- **Aircraft Registration & ICAO type** (e.g., A7-ALM / A35K)
- **Crew Layout** — "Solo Flight" (same pilot departure and arrival) or "Split Crew"
- **Pax Count** — generated when you dispatch (or "Not generated" before dispatch)
- **Status** — ⏳ Pre-flight or 🟢 Dispatched

A **Cancel Booking** button is available for either the departure or arrival pilot.

---

### 7.2 Departure Dispatch Deck

Before the flight can begin, the **Departure Pilot** must click **🚀 Dispatch Flight**.

What dispatching does:
- Generates a dynamic **passenger manifest** (pax count) based on the airline's Global Reputation rating.
- Unlocks the active operations tools (fuel calculator, webhook, PIREP form).
- Shows an animated **Passenger Boarding Modal** showing seats filling up.

> Only the **departure pilot** can dispatch. The arrival pilot sees a "Waiting for takeoff pilot to dispatch" notice.

---

### 7.3 Active Operations (After Dispatch)

Once dispatched, the full operations dashboard unlocks:

#### Fleet Movement Broadcast (Webhook)
A dark **📡 Fleet Movement Broadcast** panel lets you click **Send Webhook Status** to publish a live enroute status ping to the **#fleet-logs** Discord channel.

#### Aviation Flight Planning Links
- **🔗 Generate SimBrief Dispatch Plan** — Opens SimBrief with your route, pax, aircraft, and flight number pre-filled.
- **🌐 FlightAware live tracker** — Opens FlightAware to track your real-world equivalent route.

#### ⛽ Fuel Burn Estimator
Enter your flight duration (hours + minutes) and the tool calculates the estimated fuel burn for your aircraft type:

| Aircraft ICAO | Hourly Burn Rate |
|---|---|
| A321 | 2,700 kg/hr |
| A330 / A333 | 5,500 kg/hr |
| A359 / A35K | 5,800 kg/hr |
| A380 / A388 | 11,500 kg/hr |
| B77W / B77L | 6,800 kg/hr |
| B788 | (standard narrowbody ~2,400 kg/hr) |

Click **Calculate Estimate** → the estimated burn is shown in kg.
Click **Copy to PIREP** → the value is automatically pasted into the PIREP fuel field.

---

### 7.4 File Manual PIREP

After landing, the **arrival pilot** (or the solo pilot if flying both parts) files the PIREP:

| Field | What to Enter |
|---|---|
| **Flight Duration** | Actual hours and minutes flown |
| **Fuel Burned (kg)** | Total fuel consumed (use the Fuel Estimator above) |
| **Landing Smoothness (FPM)** | Your landing rate in feet per minute |
| **Flight Diverted?** | Toggle ON if you landed at an alternate airport |
| **Actual Landing Airport (ICAO)** | Only shown if Diverted toggle is ON — enter the 4-letter ICAO code |

Click **✅ File PIREP & Finish Leg** to submit.

- The flight is marked **Completed** and sent for staff review.
- Your QAR earnings are processed based on the flight.
- The airline's **Global Reputation Rating** is updated.

> **Only the assigned arrival pilot can file the PIREP.** If you are the departure-only pilot, you cannot submit it.

---

### 7.5 The Airline Economic Flywheel

```
High Pilot Performance
        ↓
Increases Global Airline Rating (e.g., ★ 3.88 Stars)
        ↓
Boosts Passenger Demand (higher pax count on dispatch)
        ↓
Increases QAR Earnings for all pilots!
```

---

## 8. Electronic Flight Bag (EFB)

**Navigation:** Sidebar → EFB  (also accessible via **Open EFB** button from Dashboard active booking banner)

The EFB is your full in-flight cockpit tablet. It requires an active booking to unlock most features. It has 6 tabs:

![EFB Tabs — placeholder: screenshot of the EFB top-tab navigation bar showing Briefing, Checklist, Weather, Aircraft, Charts, Settings]

---

### 8.1 Briefing Tab

The Briefing tab is the home page of the EFB.

**Data Sources:** The EFB can display data from:
- **Your Active Booking** (default) — pulls route, aircraft, and flight details from your booked flight.
- **SimBrief OFP** (if you've set your SimBrief Pilot ID in settings) — automatically fetches your latest filed Operational Flight Plan.

**Displayed information (when SimBrief OFP is loaded):**
- Origin / Destination airports
- Estimated departure time (ETD) and arrival time (ETA)
- Flight duration and route distance
- Cruise altitude, planned fuel, payload
- SID / STAR procedures
- Embedded PDF link to the full SimBrief OFP

A **Refresh OFP** button lets you re-fetch the latest plan from SimBrief at any time.

---

### 8.2 Checklist Tab (Interactive Voice Co-Pilot)

![EFB Checklist — placeholder: screenshot of the interactive checklist showing phase sections like PRE-FLIGHT, ENGINE START, TAKEOFF, CRUISE, DESCENT, APPROACH, SHUTDOWN]

The EFB Checklist is **fully dynamic** — values are calculated from your aircraft type, payload percentage, and flight direction.

**Checklist phases include:**
- PRE-FLIGHT NOTAMS
- ENGINE START (sequence varies by aircraft — e.g., Engine 2 first on A350)
- BEFORE TAXI
- BEFORE TAKEOFF
- TAKEOFF (Flaps, N1 target, VR speed — all calculated for your load)
- CLIMB (V/S targets, speed profile, step climb recommendations)
- CRUISE
- DESCENT (Speed profile per phase)
- APPROACH (Flap deployment schedule)
- AFTER LANDING
- SHUTDOWN

**Co-Pilot Modes:**
- **Manual** — Tap each checklist item to check it off.
- **Voice** — Say the trigger keyword (default: *"check"*) or speak the response value → the co-pilot validates your voice response and advances to the next item automatically.
- **Keyboard** — Use a configured keyboard shortcut key (default: Space bar) to advance items.

The **Voice Co-Pilot Engine** uses the Web Speech API with:
- Fuzzy response matching (Levenshtein distance algorithm) so you don't need to say the exact value
- Phonetic pronunciation dictionary (e.g., "METAR" becomes "Mee tar", "FL350" becomes "flight level 350", ICAO codes are spelled out letter-by-letter)
- Radio mic click sound between transmissions
- Checklist progress is **saved to browser cache** — if you close the EFB and re-open it, your progress is preserved.

---

### 8.3 Weather Tab (METAR & Diversion Finder)

![EFB Weather — placeholder: screenshot showing decoded METAR report for departure and arrival airports with the 3-step METAR timeline]

The Weather tab provides:

- **METAR Decoded Report** — Full decoded weather for departure and arrival airports (wind, visibility, ceiling, temperature, QNH).
- **3-Step METAR Timeline** — Syncs with Infinite Flight's weather cycle. Shows METAR at three time steps so you can anticipate changing conditions on approach.
- **Runway Wind Vector Analysis** — Calculates headwind/tailwind (longitudinal) and crosswind (lateral) components for your selected runway heading. Enter the runway heading and get the exact wind components.
- **Automated Diversion Finder** — If weather at destination is poor, the system searches nearby eligible alternate airfields and ranks them by distance and suitability.

---

### 8.4 Aircraft Tab (Performance & Engine Start)

![EFB Aircraft Performance — placeholder: screenshot of the engine start sequence card and flap retraction speed schedule for the selected aircraft]

Provides airframe-specific technical references:

- **Engine Start Sequence** — Shows the correct order to start engines for your specific aircraft type (e.g., Engine 2 → Engine 1 for Airbus narrowbodies, right-to-left for some wide-bodies).
- **Engine Stable Percentage** — The N1/N2 percentage at which to confirm engine stability before proceeding.
- **Flap Retraction Schedule** — Shows the exact speeds (knots) at which to retract flaps during climb-out and deploy during approach.
- **Step Climb Advisor** — Based on your load percentage, recommends step climb altitude changes during cruise for fuel efficiency.
- **Landing Data Table** — Approach speeds and flap settings based on your current load.

> Performance data is **load-aware** — values change dynamically based on your actual payload percentage.

---

### 8.5 Charts Tab (ChartFox Integration)

![EFB Charts — placeholder: screenshot of ChartFox airport diagram embedded inside the EFB charts tab]

The Charts tab embeds **ChartFox** airport charts directly within the EFB interface:

- Search for any airport by ICAO code.
- Browse available charts: Airport Diagram, SID, STAR, Approach, Ground.
- View high-definition charts without leaving the EFB.

---

### 8.6 Settings Tab (Voice Engine & Telemetry)

![EFB Settings — placeholder: screenshot of the co-pilot voice settings panel showing voice selection, speed, pitch, and keyword fields]

Configure your co-pilot and EFB behaviour:

**Voice Engine Settings:**
| Setting | Description |
|---|---|
| Co-Pilot Voice | Select from all available browser speech voices |
| Speech Rate | Speed of the co-pilot's speech (0.5× — 2.0×) |
| Speech Pitch | Pitch of the voice (0.5 — 2.0) |
| Trigger Keyword | Voice command word to start a response (default: *"check"*) |
| Input Mode | Voice / Keyboard / Manual |
| Keyboard Key | Key to advance checklist in keyboard mode (default: Space) |

**Co-Pilot Behaviour Settings:**
| Setting | Description |
|---|---|
| Play Chime | Toggle entry/exit chime sounds |
| Auto-Advance | Auto move to next item after a valid response |
| Auto-Collapse | Auto-collapse completed sections |
| Show Floating Button | Show/hide the floating co-pilot control button |

**Checklist Overrides:**
- **Aircraft Override** — manually select a different aircraft type for the checklist (useful if your booking aircraft differs from what you're flying in IF).
- **Load Override** — manually set a payload percentage instead of using the SimBrief-calculated value.
- **Direction Override** — force East or West cruise profile.

---

## 9. Fleet Registry

**Navigation:** Sidebar → Fleet

![Fleet Registry — placeholder: screenshot of the Fleet Registry page showing airframe cards grouped by Flying Group, with IF Live status badges]

The Fleet Registry shows **all aircraft** in Qatari Virtual's fleet, organized by their assigned Flying Group.

**Your assigned group** is always displayed first and highlighted with a blue ring.

### Aircraft Card Information

Each aircraft card shows:
- **Registration** (e.g., A7-ALM)
- **Aircraft type & livery** (e.g., Airbus A350-1000)
- **Status badge** — Parked 🟢 / Flying 🔵 / Maintenance 🟡
- **IF Live badge** — if the airframe is linked to Infinite Flight Live
- **Infinite Flight Live data** (if connected) — IF registration, organization name, and visibility status (Visible / Hangared)
- **Current Airport** (📍 e.g., OTHH)
- **Total Flight Hours** (🕐 e.g., 142h)
- **Total Legs flown** (✈ e.g., 38 legs)
- **Current Pilot** (shown if a pilot is currently assigned)

Click any aircraft card to view its **detailed airframe profile** at `/fleet/:id`.

### Sync All Locations Button

Admins can click **🔄 Sync All Locations** to pull the latest position data from Infinite Flight Live for all linked aircraft. A progress bar shows sync status. The system applies a 3-second delay between active aircraft syncs to respect IF Live's API rate limits (20 requests/minute).

---

## 10. Flying Groups

**Navigation:** Sidebar → Groups

![Flying Groups — placeholder: screenshot of the Flying Groups page showing group cards with pilot slot counts, aircraft counts, and capacity bars]

The Flying Groups page shows all operational pilot groups in the airline.

**Your assigned group** is pinned to the top with a blue "★ YOUR ASSIGNED GROUP" ribbon.

### Group Card Information

Each group card displays:
- **Group name** (e.g., Airbus Alpha)
- **Active / Inactive** status badge
- **Pilot Slots** — current member count vs. max slots (e.g., 8 / 12)
- **Slot availability badge** — "X Slots Open" or "FULL (members/max)"
- **Fleet count** — number of aircraft assigned to this group
- **Capacity usage progress bar** — green (open), amber (>75% full), red (full)
- **Capacity formula note** — `2 + (aircraft × 2) = max slots`
- **Period dates** — the start and end date of this group's operational period

Click any group card to go to its **Group Detail page** (`/groups/:id`) showing the group's scheduled flights and pilot roster.

---

## 11. Career Center

**Navigation:** Sidebar → Career Center

![Career Center — placeholder: screenshot of the Career Center page showing two career path cards (Airbus pathway and Boeing pathway) and the rank ladder]

The Career Center tracks your long-term progression as a pilot.

### Career Paths

There are two main career pathways (managed by staff):
- **Airbus Pathway** — First Officer → Senior First Officer → Captain progression on Airbus fleet
- **Boeing Pathway** — First Officer → Senior First Officer → Captain progression on Boeing fleet

> Career path enrollment is done by staff in the Admin → Pilots panel. You cannot self-enroll.

Click any path card to expand your progress details.

### Rank Ladder

Shows your full rank progression for the selected path. Each rank node shows:
- **Rank name** (e.g., Boeing First Officer)
- **Requirements** — route discovery %, required takeoffs, required landings
- **Aircraft types** accessible at that rank

Current rank is highlighted in blue; completed past ranks in green.

### Progress Details

For your current rank, the progress panel shows three metrics:

| Metric | Description |
|---|---|
| **Route Discovery** | % of available routes for your rank you've flown, vs. required % |
| **Takeoffs** | Number of takeoffs logged vs. required count |
| **Landings** | Number of landings logged vs. required count |

When all three metrics are met, a green **"Ready for promotion"** banner appears. Contact staff for the actual promotion.

### Aircraft Qualifications

Shows which aircraft types are **Unlocked** (accessible at your current rank) vs. **Locked** (accessible at a future rank). Unlocked types appear in green.

---

## 12. Transfer Requests

**Navigation:** Sidebar → Transfers

The Transfer Requests page allows you to formally request a change from management.

### Transfer Types

| Type | When to Use |
|---|---|
| **Group Switch** | Request to be moved from your current flying group to a different one |
| **Career Path Switch** | Request to switch from the Airbus pathway to Boeing pathway (or vice versa) |

### Submitting a Request

1. Select the **Transfer Type** from the dropdown.
2. Enter the **Destination** — the name of the target group or career path.
3. Add an optional **Reason** for the request.
4. Click **Submit Request**.

### Tracking Past Requests

All your submitted transfer requests appear in the table below with:
- **Type** — group switch or career path switch
- **To** — the requested destination
- **Status** badge — Pending 🟡 / Approved 🟢 / Denied 🔴
- **Reviewed By** — the staff member who processed it
- **Date** — when the request was submitted

---

## 13. Quick Reference Summary

| Action | Navigation Path | Key Requirement / Notes |
|---|---|---|
| View your status & wallet | Dashboard (Home) | Shows rank, weekly proposals, QAR balance |
| **Create a Draft flight** | Schedule Calendar → click a time cell → select aircraft & route | Aircraft must match your group; route loads from current aircraft position |
| **Propose a flight** | Click Draft card → Propose Flight | Consumes 1 proposal token (free or purchased) |
| **Buy extra tokens** | Shop → Buy Token | 1,000 QAR (short-haul) / 2,000 QAR (long-haul) |
| **Book a flight** | Click Approved flight card → Book | Select: Departure Only / Arrival Only / Both Parts |
| **Dispatch flight** | Flight Operations → Dispatch Flight | Departure pilot only; generates pax count & unlocks tools |
| **Generate SimBrief OFP** | Flight Operations → Generate SimBrief Dispatch Plan | Opens SimBrief with route, pax, and flight number pre-filled |
| **Estimate fuel** | Flight Operations → Fuel Burn Estimator | Enter HH:MM; uses aircraft-specific burn rates |
| **File PIREP** | Flight Operations → File PIREP & Finish Leg | Arrival pilot only; enter duration, fuel, FPM |
| **Open EFB** | Dashboard active booking → Open EFB (or Sidebar → EFB) | Must have active booking |
| **Use voice checklist** | EFB → Checklist tab → say trigger keyword | Default keyword: "check"; fuzzy voice matching |
| **Check weather** | EFB → Weather tab | Decoded METAR, 3-step timeline, diversion finder |
| **View runway winds** | EFB → Weather tab → Runway Wind Vector | Enter runway heading; get headwind/crosswind components |
| **Access charts** | EFB → Charts tab | ChartFox embedded; search by ICAO code |
| **View fleet** | Fleet Registry | Shows all airframes grouped by group; click for detail |
| **Request group transfer** | Transfers → New Request → Group Switch | Enter target group name + optional reason |
| **View career progress** | Career Center → select path card | Shows route %, takeoffs, landings vs. requirements |

---

*OryxOps User Handbook · Qatari Virtual · Version 1.0*
*This document is maintained by the operations team and reflects the current live build of OryxOps.*
