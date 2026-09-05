import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAppSelector } from "../store/hooks";
import { api } from "../api/client";

export interface HandbookSection {
  id: string;
  chapter: number;
  title: string;
  category: string;
  icon?: string;
  badge?: string;
  summary?: string;
  content: string;
  image_url?: string;
  image_caption?: string;
  app_route?: string;
  app_route_label?: string;
  admin_only?: boolean;
}

export interface HandbookData {
  title: string;
  version: string;
  updated_at: string;
  sections: HandbookSection[];
}

const DEFAULT_HANDBOOK: HandbookData = {
  title: "OryxOps User Guide & Operational Handbook",
  version: "1.0",
  updated_at: "2026-07-29",
  sections: [
    {
      id: "introduction",
      chapter: 1,
      title: "Introduction & Core Philosophy",
      category: "Getting Started",
      icon: "M12 19l9 2-9-18-9 18 9-2zm0 0v-8",
      badge: "Start Here",
      summary: "OryxOps is the flagship operations platform for Qatari Virtual — combining pilot-driven scheduling, virtual economics, Infinite Flight Live persistence, and a full Electronic Flight Bag suite.",
      content: "Welcome to **OryxOps**, the flagship operations platform designed exclusively for **Qatari Virtual**.\n\nIn traditional virtual airline systems, management staff face the tedious task of manually creating dozens of flight schedules per day, while pilots feel disconnected from fleet management. OryxOps completely reinvents this workflow:\n\n### Core Pillars\n- **Pilot-Driven Scheduling**: Pilots propose the exact routes they wish to fly within structured airline boundaries.\n- **Economic Progression**: Earn virtual currency (QAR) on every flight to spend within the airline ecosystem.\n- **Persistent World Engine**: Integrated directly with Infinite Flight Live — aircraft stay where they are parked.\n- **Advanced EFB Suite**: Audio co-pilots, wind analyzers, interactive checklists, and real-time dispatch systems.\n\n### How the System Works\n1. You propose a flight on the Schedule Calendar (costs a proposal token).\n2. Management approves or rejects the proposal.\n3. You (or a group-mate) book the approved flight.\n4. You dispatch, fly, and file your PIREP to earn QAR.\n5. QAR feeds back into buying more proposal tokens — creating a self-sustaining economy.",
      image_url: "",
      image_caption: "",
      app_route: "/",
      app_route_label: "Go to Dashboard"
    },
    {
      id: "if-live-persistence",
      chapter: 2,
      title: "Infinite Flight Live & Persistence",
      category: "Getting Started",
      icon: "M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064",
      badge: "IF Live",
      summary: "OryxOps is built on Infinite Flight's persistent fleet model — aircraft physically stay at their last parked airport until another pilot repositions them.",
      content: "OryxOps operates on top of Infinite Flight's **persistent fleet model (IF Live)**. Unlike standard free-flight modes where an aircraft can be spawned anywhere, Live introduces physical persistence.\n\n### Key Concept: Location Continuity\nIf an aircraft lands at London Heathrow (EGLL), it stays parked at EGLL until another pilot flies or repositions it. This is why the Schedule Calendar always shows the aircraft's **current airport** — that's where your next flight must depart from.\n\n### Fleet Status\n- **Visible** — Aircraft is on the ramp and can be spawned.\n- **Hangared** — Aircraft is stored and temporarily unavailable.\n- **Parked / Flying / Maintenance** — Internal OryxOps status shown on Fleet Registry cards.\n\n### Active vs. Stored Fleet\nThe active fleet size is bounded by the organization's Level (boosted by member Lifts). Active slots determine which aircraft can be assigned active schedules.\n\n### Sync All Locations (Admin)\nAdmins can sync the latest position data from IF Live for all linked aircraft using the Sync All Locations button on the Fleet Registry page.",
      image_url: "",
      image_caption: "",
      app_route: "/fleet",
      app_route_label: "View Fleet Registry"
    },
    {
      id: "dashboard",
      chapter: 3,
      title: "The Dashboard — Your Home Base",
      category: "Getting Started",
      icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1",
      badge: "Home",
      summary: "Your personal command center — shows your flying group, wallet balance, active booking, weekly proposal usage, airline-wide metrics, and quick action shortcuts.",
      content: "The **Dashboard** is the first page you see after login and your primary command center.\n\n### Hero Banner (Top)\n- **Live UTC Zulu Clock** — updates every second.\n- Time-based greeting (Good Morning / Afternoon / Evening).\n- Your **Pilot Title**, **Name**, **Callsign** badge, and **Group** badge.\n- Your **Pilot Wallet** (QAR balance) in the top-right corner.\n\n### Active Flight Alert\n- **Blue banner** appears if you have an active booking — shows flight number, route (e.g. OTHH → EGLL), aircraft registration, and a direct **Open EFB** button.\n- If no active booking: a prompt to **Browse Schedule** is shown instead.\n\n### Stat Cards (3 cards)\n- **Assigned Group** — your assigned flying group. Links to Flying Groups.\n- **Weekly Proposals** — shows used / total with a progress bar (turns red at ≥80%). Links to Shop.\n- **Pilot Wallet** — your QAR balance plus short-haul and long-haul token stockpiles.\n\n### Airline Operations Strip (Dark Panel)\n- **Global Airline Rating** — average reputation score (0–5 stars) across all pilots' completed flights.\n- **Completed Flights** — total revenue legs filed across all pilots since the airline launched.\n\n### Proposal Transaction Log\n- Shows the last 8 token purchase and consumption events.\n- Each entry shows description, flight detail (if applicable), and cost.\n\n### Quick Actions Grid\n- 4 shortcut tiles: **Fleet**, **Groups**, **Schedule**, and **EFB**.",
      image_url: "",
      image_caption: "",
      app_route: "/",
      app_route_label: "Go to Dashboard"
    },
    {
      id: "schedule-calendar",
      chapter: 4,
      title: "Schedule Calendar — Propose & Book Flights",
      category: "Operations",
      icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
      badge: "Core Feature",
      summary: "The heart of OryxOps. Propose flights, get them approved, and book them here. Flight cards progress through Draft → Proposed → Approved before you can book and fly.",
      content: "The **Schedule Calendar** is the core of OryxOps. All flight proposals, approvals, and bookings happen here. It shows one week at a time, filtered by Flying Group.\n\n### Calendar Views\n- **Calendar View** — a 7-day × 24-hour UTC grid. Click any empty cell to create a flight.\n- **List View** — a sorted list of all flights for the week.\n\n### Flight Status Colours\n- 🔵 **Draft** — Created but not submitted for review.\n- 🟡 **Proposed** — Submitted, awaiting management approval.\n- 🟢 **Approved** — Available to book and fly.\n- 🔴 **Cancelled** — Flight cancelled.\n\n### Step 1 — Create a Draft\n1. Go to Schedule Calendar → select your flying group.\n2. Click any empty time cell in the grid.\n3. Select your **aircraft** (loaded from your group's fleet).\n4. Select a **route** (automatically loaded from the aircraft's current parked airport and type).\n5. Set the **departure time** (UTC) and **ground time** (turnaround minutes).\n6. Click **Save** — card appears as Draft (blue).\n\n### Step 2 — Propose the Flight\n1. Click the Draft card.\n2. Click **Propose Flight**.\n3. Consumes 1 proposal token (free weekly allowance or a purchased token if you've exceeded your limit).\n4. Card turns yellow (Proposed) and queues for management review.\n\n### Step 3 — Management Approval\n- **Approved** → card turns green, available to book.\n- **Rejected** → card cancelled; your token is automatically refunded.\n\n### Step 4 — Book the Flight\n1. Click an approved (green) flight card.\n2. Choose your booking type:\n- **Departure Only** — fly takeoff through top of cruise.\n- **Arrival Only** — join ~30 mins before ETA and fly approach & landing.\n- **Both Parts (Full Flight)** — fly the entire leg.\n3. Click **Book** — confirmed!\n\n### Weekly Free Proposal Limits\n- Default weekly allowance: 3 free proposals per week.\n- Exceeding the limit costs QAR (1,000 for short-haul, 2,000 for long-haul) or consumes a pre-purchased token.\n\n### Warnings\n- **Position Mismatch Warning** — Red warning if a flight departs from a different airport than where the aircraft will actually be based on prior scheduled arrivals.\n- **Ground Time Warning** — Orange warning if the gap between consecutive flights is shorter than the required turnaround time.",
      image_url: "",
      image_caption: "",
      app_route: "/calendar",
      app_route_label: "Open Schedule Calendar"
    },
    {
      id: "shop",
      chapter: 5,
      title: "The Shop — Proposal Tokens",
      category: "Economy",
      icon: "M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z",
      badge: "QAR Economy",
      summary: "Spend earned QAR to pre-purchase extra proposal tokens for flights beyond your weekly free allowance. Tokens are only consumed if management approves your proposal.",
      content: "The **Shop** is where you spend your earned QAR to pre-purchase extra proposal tokens beyond your weekly free allowance.\n\n### Token Products\n- **Short-Haul Proposal Token** — For flights under 8 hours. Costs **1,000 QAR**.\n- **Long-Haul Proposal Token** — For flights 8 hours or more. Costs **2,000 QAR**.\n\n### How Tokens Work\n1. Purchase tokens in the Shop using your QAR balance.\n2. Tokens are stored in your account (visible on Dashboard and Shop page).\n3. When you propose a flight **beyond your free weekly limit**, the system automatically uses a stored token instead of charging your wallet directly.\n4. Tokens are consumed only if management **approves** your proposal.\n5. If your proposal is **rejected** → token is automatically refunded.\n\n### Insufficient Funds\nThe Buy button is disabled and labelled **Insufficient Funds** if your wallet balance is below the token cost.\n\n### Where to See Your Token Balance\n- **Dashboard** → Pilot Wallet stat card (shows short-haul and long-haul token counts).\n- **Shop page** → Your Proposal Tokens panel.",
      image_url: "",
      image_caption: "",
      app_route: "/shop",
      app_route_label: "Go to Shop"
    },
    {
      id: "flight-operations",
      chapter: 6,
      title: "Flight Operations — Dispatch, Fuel & PIREP",
      category: "Operations",
      icon: "M12 19l9 2-9-18-9 18 9-2zm0 0v-8",
      badge: "SimBrief Integrated",
      summary: "Manage everything after booking — dispatch the flight, generate your SimBrief plan, calculate fuel, and file your PIREP to earn QAR and update the airline rating.",
      content: "**Flight Operations** is where you manage everything after booking and before / during the actual flight. You must have an active booking to access most tools.\n\n### Active Booking Overview Card\nDisplays your current booked flight: route, flight number, aircraft, crew layout (Solo or Split Crew), pax count, and status (Pre-flight or Dispatched).\n\n### Step 1 — Dispatch the Flight (Departure Pilot Only)\nClick **🚀 Dispatch Flight** to:\n- Generate a dynamic **passenger manifest** (pax count) based on the airline's Global Reputation rating.\n- Unlock all active operations tools.\n- Trigger an animated **Passenger Boarding Modal**.\n\n### Step 2 — Plan Your Flight\n- **🔗 Generate SimBrief Dispatch Plan** — Opens SimBrief with your route, pax, aircraft, and flight number pre-filled.\n- **📡 Fleet Movement Broadcast** — Click **Send Webhook Status** to post a live enroute status ping to the #fleet-logs Discord channel.\n\n### Step 3 — Calculate Fuel\nEnter your flight duration (hours + minutes). The estimator calculates fuel burn using aircraft-specific hourly rates:\n- A321: 2,700 kg/hr\n- A330 / A333: 5,500 kg/hr\n- A359 / A35K: 5,800 kg/hr\n- A388: 11,500 kg/hr\n- B77W / B77L: 6,800 kg/hr\n\nClick **Copy to PIREP** to auto-fill the PIREP fuel field.\n\n### Step 4 — File PIREP (Arrival Pilot Only)\nAfter landing, fill in:\n- **Flight Duration** (actual HH:MM)\n- **Fuel Burned** (kg)\n- **Landing Smoothness** (FPM — feet per minute)\n- **Flight Diverted?** — toggle ON if you landed at an alternate airport\n- **Actual Landing Airport** (ICAO) — only shown if diverted\n\nClick **✅ File PIREP & Finish Leg** to submit and earn your QAR.\n\n### The Airline Economic Flywheel\nHigh pilot performance → increases Global Airline Rating → boosts passenger demand → increases QAR earnings for all pilots.",
      image_url: "",
      image_caption: "",
      app_route: "/operations",
      app_route_label: "Go to Flight Operations"
    },
    {
      id: "efb",
      chapter: 7,
      title: "Electronic Flight Bag (EFB)",
      category: "Pilot Tools",
      icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
      badge: "Voice Co-Pilot",
      summary: "Your full in-flight cockpit tablet with 6 tabs: Briefing, Checklist (voice co-pilot), Weather, Aircraft performance, Charts, and Settings.",
      content: "The **EFB** is your full in-flight cockpit tablet with 6 tabs. It requires an active booking and auto-loads SimBrief OFP data if your SimBrief Pilot ID is configured in Settings.\n\n### Tab 1 — Briefing\nShows route, ETD, ETA, cruise altitude, fuel, payload, SID/STAR procedures, and an embedded SimBrief PDF viewer. Toggle between SimBrief data and your booking data as the source.\n\n### Tab 2 — Checklist (Voice Co-Pilot)\nA fully dynamic interactive checklist. Values are calculated from your aircraft type, payload percentage, and flight direction.\n\n**Checklist Phases**: PRE-FLIGHT NOTAMS → ENGINE START → BEFORE TAXI → BEFORE TAKEOFF → TAKEOFF → CLIMB → CRUISE → DESCENT → APPROACH → AFTER LANDING → SHUTDOWN\n\n**Co-Pilot Modes**:\n- **Manual** — Tap each item to check it off.\n- **Voice** — Say the trigger keyword (default: \"check\") → co-pilot reads the item → speak the response → fuzzy matching validates your answer.\n- **Keyboard** — Use a configured key (default: Space) to advance items.\n\nChecklist progress is saved to browser cache — closing and reopening preserves your progress.\n\n### Tab 3 — Weather\n- **Decoded METAR** for departure and arrival airports.\n- **3-Step METAR Timeline** — shows how weather evolves across Infinite Flight's weather cycle.\n- **Runway Wind Vector** — enter runway heading to get exact headwind/crosswind components.\n- **Automated Diversion Finder** — searches nearby eligible alternate airports if destination weather is poor.\n\n### Tab 4 — Aircraft Performance\n- Engine start sequence (correct order per aircraft type).\n- Engine stable N1/N2 percentage.\n- Flap retraction and deployment speed schedules.\n- Step climb advisor (recommends altitude changes during cruise for fuel efficiency).\n- Landing data table (approach speeds by load %).\n\nAll values are **load-aware** — they update dynamically based on your actual payload percentage.\n\n### Tab 5 — Charts\nChartFox airport charts embedded directly in the EFB. Search any airport by ICAO code and browse SID, STAR, approach, and airport diagram charts without leaving the app.\n\n### Tab 6 — Settings\nConfigure co-pilot voice, speech rate, pitch, trigger keyword, input mode, chime sounds, auto-advance, and checklist overrides (aircraft type, load %, flight direction). Set your SimBrief Pilot ID here.",
      image_url: "",
      image_caption: "",
      app_route: "/efb",
      app_route_label: "Open EFB"
    },
    {
      id: "fleet",
      chapter: 8,
      title: "Fleet Registry",
      category: "Fleet",
      icon: "M12 19l9 2-9-18-9 18 9-2zm0 0v-8",
      badge: "IF Live Status",
      summary: "Browse all aircraft in Qatar Virtual's fleet, organized by Flying Group. See live IF status, current airport, flight hours, and assigned pilots.",
      content: "The **Fleet Registry** displays all aircraft in Qatari Virtual's fleet, organized by their assigned Flying Group.\n\nYour assigned group is always displayed **first** and highlighted with a blue ring.\n\n### Aircraft Card Shows\n- **Registration** (e.g., A7-ALM)\n- **Aircraft type & livery** (e.g., Airbus A350-1000)\n- **Status badge** — Parked (green) / Flying (blue) / Maintenance (amber)\n- **IF Live badge** — if the airframe is linked to Infinite Flight Live\n- **IF Visibility** — Visible (on ramp) or Hangared\n- **Current Airport** (e.g., 📍 OTHH)\n- **Total Flight Hours** (e.g., 🕐 142h)\n- **Total Legs Flown** (e.g., ✈ 38 legs)\n- **Current Pilot** (if a pilot is currently assigned)\n\n### Click Any Aircraft\nOpens the detailed airframe profile showing full metadata and complete flight history.\n\n### Group Capacity Formula\nEach group's aircraft determines how many pilot slots that group has:\n\n**Max Pilot Slots = 2 + (2 × Aircraft Count)**\n\nFor example, a group with 5 aircraft can have up to 12 pilots.",
      image_url: "",
      image_caption: "",
      app_route: "/fleet",
      app_route_label: "View Fleet Registry"
    },
    {
      id: "groups",
      chapter: 9,
      title: "Flying Groups",
      category: "Community",
      icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z",
      badge: "Squadrons",
      summary: "Qatar Virtual's fleet is organized into 6 operational flying groups. Your assigned group is pinned first and highlighted. Each group has a dedicated fleet and pilot capacity.",
      content: "The **Flying Groups** page shows all 6 operational pilot groups in the airline.\n\nYour assigned group is pinned to the top with a blue **★ YOUR ASSIGNED GROUP** ribbon.\n\n### The 6 Flying Groups\n- **Airbus Alpha** — 3× A350-1000, 2× A380-800 (5 aircraft, 12 pilot slots)\n- **Airbus Bravo** — 3× A350-900, 2× A330-300 (5 aircraft, 12 pilot slots)\n- **Airbus Charlie** — 1× A350-900, 1× A321-200 (2 aircraft, 6 pilot slots)\n- **Boeing Delta** — 3× 777-300ER, 2× 787-8 (5 aircraft, 12 pilot slots)\n- **Boeing Echo** — 3× 777-200LR, 2× 777-300ER (5 aircraft, 12 pilot slots)\n- **Boeing Foxtrot** — 2× 787-8, 1× 777-200LR (3 aircraft, 8 pilot slots)\n\n### Group Card Shows\n- Pilot Slots (current / max) with capacity formula note\n- **Slot availability badge** — Slots Open or FULL\n- **Capacity bar** — green (open), amber (>75% full), red (full)\n- Period dates (operational period start and end)\n\n### Clicking a Group Card\nOpens the Group Detail page showing the group's flight schedule for the week and its full pilot roster.",
      image_url: "",
      image_caption: "",
      app_route: "/groups",
      app_route_label: "View Flying Groups"
    },
    {
      id: "transfers",
      chapter: 10,
      title: "Transfer Requests",
      category: "Community",
      icon: "M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4",
      badge: "Group Transfers",
      summary: "Formally request a group switch from management. Track the status of all your past requests.",
      content: "The **Transfer Requests** page allows you to formally request changes from management.\n\n### Transfer Types\n- **Group Switch** — Request to move from your current flying group to a different group. Enter the target group name.\n\n### Submitting a Request\n1. Select the **Transfer Type** from the dropdown.\n2. Enter the **Destination** — the name of the target group.\n3. Add an optional **Reason** for the request.\n4. Click **Submit Request**.\n\n### Tracking Past Requests\nAll submitted transfer requests appear in the table below:\n- **Type** — group switch\n- **To** — the requested destination\n- **Status** — Pending (yellow) / Approved (green) / Denied (red)\n- **Reviewed By** — the staff member who processed it\n- **Date** — when the request was submitted\n\n### What Happens When Approved\n- **Group Switch**: You are removed from your current group and added to the target group (if it has open slots).",
      image_url: "",
      image_caption: "",
      app_route: "/transfers",
      app_route_label: "View Transfer Requests"
    }
  ]
};

export default function Handbook() {
  const navigate = useNavigate();
  const { sectionId } = useParams();
  const user = useAppSelector((state: any) => state.auth.user);
  
  // Executive check: Call-sign QRV001..QRV004 or is_executive or is_admin flag
  const isExecutive = Boolean(
    user?.is_executive ||
    user?.is_admin ||
    ["QRV001", "QRV002", "QRV003", "QRV004"].includes(user?.callsign?.toUpperCase() || "")
  );

  const [data, setData] = useState<HandbookData>(DEFAULT_HANDBOOK);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("All");
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);

  // Load handbook from API or local storage or fallback JSON
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const json = await api.get<HandbookData>("/handbook");
        setData(json);
      } catch (err) {
        console.warn("Using fallback handbook data:", err);
        const local = localStorage.getItem("oryxops_handbook_data");
        if (local) {
          setData(JSON.parse(local));
        } else {
          try {
            const fallbackRes = await fetch("/handbook.json");
            if (fallbackRes.ok) {
              const fallbackJson = await fallbackRes.json();
              setData(fallbackJson);
            }
          } catch (fallbackErr) {
            console.error("Fallback load failed:", fallbackErr);
          }
        }
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const visibleSections = data.sections.filter((section) => {
    // Hide admin_only sections from standard non-executive pilots
    if (section.admin_only && !isExecutive) return false;
    return true;
  });

  const activeSectionId = sectionId || visibleSections[0]?.id || "";
  const activeSection = visibleSections.find((s) => s.id === activeSectionId) || visibleSections[0];

  const categories = ["All", ...Array.from(new Set(visibleSections.map((s) => s.category)))];

  const filteredSections = visibleSections.filter((section) => {
    const matchesCategory = categoryFilter === "All" || section.category === categoryFilter;
    const q = search.toLowerCase().trim();
    const matchesSearch =
      !q ||
      section.title.toLowerCase().includes(q) ||
      section.category.toLowerCase().includes(q) ||
      section.content.toLowerCase().includes(q) ||
      (section.summary && section.summary.toLowerCase().includes(q));
    return matchesCategory && matchesSearch;
  });

  const isSearching = search.trim() !== "" || categoryFilter !== "All";
  const sectionsToRender = filteredSections;

  const isProgrammaticScroll = useRef(false);
  const isScrollspyNavigation = useRef(false);

  // Scroll programmatic effect
  useEffect(() => {
    if (!loading && sectionId) {
      if (isScrollspyNavigation.current) {
        isScrollspyNavigation.current = false;
        return;
      }
      const element = document.getElementById(sectionId);
      if (element) {
        isProgrammaticScroll.current = true;
        element.scrollIntoView({ behavior: "smooth", block: "start" });
        const timer = setTimeout(() => {
          isProgrammaticScroll.current = false;
        }, 1000);
        return () => clearTimeout(timer);
      }
    }
  }, [sectionId, loading]);

  // IntersectionObserver for Scrollspy
  useEffect(() => {
    if (loading || isSearching || visibleSections.length === 0) return;

    const observerOptions = {
      root: null,
      rootMargin: "-10% 0px -70% 0px", // Trigger when active section occupies top 10-30% of viewport
      threshold: 0,
    };

    const observerCallback = (entries: IntersectionObserverEntry[]) => {
      if (isProgrammaticScroll.current) return;
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          if (id && id !== sectionId) {
            isScrollspyNavigation.current = true;
            navigate(`/handbook/${id}`, { replace: true });
          }
        }
      });
    };

    const observer = new IntersectionObserver(observerCallback, observerOptions);

    visibleSections.forEach((sec) => {
      const el = document.getElementById(sec.id);
      if (el) observer.observe(el);
    });

    return () => {
      observer.disconnect();
    };
  }, [visibleSections, sectionId, loading, isSearching, navigate]);

  const handleSaveHandbook = async () => {
    setSaveStatus("saving");
    const updatedPayload: HandbookData = {
      ...data,
      updated_at: new Date().toISOString().split("T")[0],
    };

    // Save to local storage for immediate persistence
    localStorage.setItem("oryxops_handbook_data", JSON.stringify(updatedPayload));

    try {
      await api.post("/handbook", updatedPayload);
      setSaveStatus("success");
      window.dispatchEvent(new Event("reload_handbook_sidebar"));
      setTimeout(() => setSaveStatus("idle"), 2500);
    } catch (err) {
      console.warn("Backend save failed, saved locally:", err);
      setSaveStatus("success"); // Saved locally
      window.dispatchEvent(new Event("reload_handbook_sidebar"));
      setTimeout(() => setSaveStatus("idle"), 2500);
    }
  };

  const handleSectionChange = (index: number, field: keyof HandbookSection, value: any) => {
    const updatedSections = [...data.sections];
    updatedSections[index] = { ...updatedSections[index], [field]: value };
    setData({ ...data, sections: updatedSections });
  };

  const handleAddSection = () => {
    const newChapter = data.sections.length + 1;
    const newSec: HandbookSection = {
      id: `custom-section-${Date.now()}`,
      chapter: newChapter,
      title: `New Chapter ${newChapter}`,
      category: "General",
      badge: "Custom Guide",
      summary: "Description of the new user guide topic...",
      content: "Write detailed instructions, procedures, or markdown content here...",
      image_url: "https://placehold.co/800x450/1e293b/ffffff?text=Upload+Screenshot+URL",
      image_caption: "Figure caption placeholder...",
      app_route: "/",
      app_route_label: "Open Section Target",
    };
    setData({ ...data, sections: [...data.sections, newSec] });
    setEditingSectionId(newSec.id);
    navigate(`/handbook/${newSec.id}`);
    window.dispatchEvent(new Event("reload_handbook_sidebar"));
  };

  const handleDeleteSection = (id: string) => {
    if (window.confirm("Are you sure you want to remove this handbook section?")) {
      const remaining = data.sections.filter((s) => s.id !== id);
      setData({ ...data, sections: remaining });
      if (activeSectionId === id) {
        navigate("/handbook");
      }
      window.dispatchEvent(new Event("reload_handbook_sidebar"));
    }
  };

  const handleMoveSectionById = (id: string, direction: "up" | "down") => {
    const index = data.sections.findIndex((s) => s.id === id);
    if (index === -1) return;
    const targetIdx = direction === "up" ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= data.sections.length) return;

    const newSections = [...data.sections];
    const temp = newSections[index];
    newSections[index] = newSections[targetIdx];
    newSections[targetIdx] = temp;

    // Recalculate chapter numbers sequentially
    newSections.forEach((sec, idx) => {
      sec.chapter = idx + 1;
    });

    setData({ ...data, sections: newSections });
    window.dispatchEvent(new Event("reload_handbook_sidebar"));
  };

  const renderFormattedContent = (content: string) => {
    const paragraphs = content.split("\n");
    return paragraphs.map((line, idx) => {
      if (line.startsWith("### ")) {
        return (
          <h3 key={idx} className="text-lg font-bold text-gray-900 dark:text-white mt-4 mb-2">
            {line.replace("### ", "")}
          </h3>
        );
      }
      if (line.startsWith("## ")) {
        return (
          <h2 key={idx} className="text-xl font-extrabold text-gray-900 dark:text-white mt-5 mb-3">
            {line.replace("## ", "")}
          </h2>
        );
      }
      if (line.startsWith("- ")) {
        const itemText = line.replace("- ", "");
        const parts = itemText.split("**");
        return (
          <li key={idx} className="ml-5 list-disc text-gray-700 dark:text-gray-300 my-1 leading-relaxed">
            {parts.map((p, i) =>
              i % 2 === 1 ? (
                <strong key={i} className="font-bold text-gray-900 dark:text-white">
                  {p}
                </strong>
              ) : (
                p
              )
            )}
          </li>
        );
      }
      if (/^\d+\.\s/.test(line)) {
        const itemText = line.replace(/^\d+\.\s/, "");
        const parts = itemText.split("**");
        return (
          <li key={idx} className="ml-5 list-decimal text-gray-700 dark:text-gray-300 my-1 leading-relaxed">
            {parts.map((p, i) =>
              i % 2 === 1 ? (
                <strong key={i} className="font-bold text-gray-900 dark:text-white">
                  {p}
                </strong>
              ) : (
                p
              )
            )}
          </li>
        );
      }
      if (!line.trim()) {
        return <div key={idx} className="h-2" />;
      }
      const parts = line.split("**");
      return (
        <p key={idx} className="text-gray-700 dark:text-gray-300 leading-relaxed my-2">
          {parts.map((p, i) =>
            i % 2 === 1 ? (
              <strong key={i} className="font-semibold text-gray-900 dark:text-white">
                {p}
              </strong>
            ) : (
              p
            )
          )}
        </p>
      );
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 p-4 lg:p-8 font-sans">
      {/* Print PDF Custom Styles */}
      <style>{`
        @media print {
          body { background: white !important; color: black !important; }
          aside, header, nav, button, input, .no-print { display: none !important; }
          .print-container { width: 100% !important; margin: 0 !important; padding: 0 !important; }
          .print-section { page-break-after: always; padding: 20px 0; border-bottom: 1px solid #e5e7eb; }
          .print-cover { text-align: center; padding: 60px 0; page-break-after: always; }
          .print-title { font-size: 32px; font-weight: bold; margin-bottom: 10px; }
          .print-subtitle { font-size: 16px; color: #6b7280; }
        }
      `}</style>

      {/* Printable Cover Header (Only visible when printing) */}
      <div className="hidden print:block print-cover">
        <h1 className="print-title">{data.title}</h1>
        <p className="print-subtitle">Official Platform Guide & Operations Documentation • Version {data.version}</p>
        <p className="text-xs text-gray-500 mt-2">Generated on {data.updated_at}</p>
      </div>

      <div className="max-w-7xl mx-auto space-y-6 print-container">
        {/* Top Header & Actions Bar */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-brand/10 text-brand dark:bg-brand/20 dark:text-brand-light">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
                  {data.title}
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-brand/10 text-brand border border-brand/20">
                    v{data.version}
                  </span>
                </h1>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Interactive User Guide • Updated {data.updated_at}
                </p>
              </div>
            </div>
          </div>

            {/* Controls Bar */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Edit Mode Toggle — Executive Restricted (QRV001 to QRV004 / is_executive / is_admin) */}
              {isExecutive ? (
                <button
                  onClick={() => setIsEditing(!isEditing)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer border ${
                    isEditing
                      ? "bg-amber-500 text-white border-amber-600 shadow-xs"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 border-gray-300 dark:border-gray-700"
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  {isEditing ? "Exit Edit Mode" : "Edit Handbook"}
                </button>
              ) : (
                <span className="text-[11px] text-gray-400 font-semibold px-2.5 py-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
                  🔒 Read-Only (Executives Edit Only)
                </span>
              )}

            {isEditing && (
              <>
                <button
                  onClick={handleAddSection}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  Add Chapter
                </button>

                <button
                  onClick={handleSaveHandbook}
                  disabled={saveStatus === "saving"}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {saveStatus === "saving" ? (
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : saveStatus === "success" ? (
                    "✓ Saved!"
                  ) : (
                    "Save Changes"
                  )}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Search & Category Filter */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4 no-print">
          <div className="relative w-full md:w-80">
            <svg className="w-4 h-4 absolute left-3.5 top-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search handbook topics..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 text-gray-900 dark:text-white focus:outline-none focus:border-brand"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 no-scrollbar">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  categoryFilter === cat
                    ? "bg-brand text-white"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Main Content Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
          {/* Handbook Section Cards */}
          <div className="lg:col-span-4 space-y-8">
            {loading ? (
              <div className="p-12 text-center text-gray-400">
                <div className="animate-spin w-8 h-8 border-2 border-brand border-t-transparent rounded-full mx-auto mb-3" />
                <p className="text-xs">Loading User Guide...</p>
              </div>
            ) : sectionsToRender.length === 0 ? (
              <div className="p-12 text-center bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 space-y-3">
                <p className="text-sm font-semibold text-gray-500">No handbook topics match your filter.</p>
                <button
                  onClick={() => {
                    setSearch("");
                    setCategoryFilter("All");
                  }}
                  className="text-xs text-brand hover:underline font-bold"
                >
                  Clear search filters
                </button>
              </div>
            ) : (
              sectionsToRender.map((sec) => {
                const originalIndex = data.sections.findIndex((s) => s.id === sec.id);
                return (
                <div
                  key={sec.id}
                  id={sec.id}
                  className="print-section bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 shadow-xs space-y-5 transition-all"
                >
                  {/* Section Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 dark:border-gray-800 pb-4">
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-xl bg-brand text-white font-black text-xs flex items-center justify-center shadow-xs">
                        {sec.chapter}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-500">
                            {sec.category}
                          </span>
                          {sec.badge && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-brand/10 text-brand">
                              {sec.badge}
                            </span>
                          )}
                          {sec.admin_only && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 flex items-center gap-1">
                              🔒 Admin Only
                            </span>
                          )}
                        </div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white mt-1">{sec.title}</h2>
                      </div>
                    </div>

                    {/* Edit Controls for Section */}
                    {isEditing && (
                      <div className="flex items-center gap-1.5 no-print">
                        <button
                          onClick={() => handleMoveSectionById(sec.id, "up")}
                          disabled={data.sections.findIndex((s) => s.id === sec.id) === 0}
                          className="px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-xs font-bold text-gray-700 dark:text-gray-300 disabled:opacity-30 flex items-center gap-1 cursor-pointer"
                          title="Move Chapter Up"
                        >
                          ▲ Up
                        </button>
                        <button
                          onClick={() => handleMoveSectionById(sec.id, "down")}
                          disabled={data.sections.findIndex((s) => s.id === sec.id) === data.sections.length - 1}
                          className="px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-xs font-bold text-gray-700 dark:text-gray-300 disabled:opacity-30 flex items-center gap-1 cursor-pointer"
                          title="Move Chapter Down"
                        >
                          ▼ Down
                        </button>
                        <button
                          onClick={() => setEditingSectionId(editingSectionId === sec.id ? null : sec.id)}
                          className="px-3 py-1 rounded-lg bg-amber-500 text-white text-xs font-bold hover:bg-amber-600 cursor-pointer shadow-xs"
                        >
                          {editingSectionId === sec.id ? "Close Editor" : "Edit Details"}
                        </button>
                        <button
                          onClick={() => handleDeleteSection(sec.id)}
                          className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-xs cursor-pointer font-bold px-2"
                          title="Delete Section"
                        >
                          ✕ Delete
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Section Inline Editor View */}
                  {isEditing && editingSectionId === sec.id ? (
                    <div className="bg-gray-50 dark:bg-gray-800/40 p-4 rounded-xl border border-amber-200 dark:border-amber-900/40 space-y-4 text-xs no-print">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-gray-500 font-bold mb-1">Title</label>
                          <input
                            type="text"
                            value={sec.title}
                            onChange={(e) => handleSectionChange(originalIndex, "title", e.target.value)}
                            className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900"
                          />
                        </div>
                        <div>
                          <label className="block text-gray-500 font-bold mb-1">Category</label>
                          <input
                            type="text"
                            value={sec.category}
                            onChange={(e) => handleSectionChange(originalIndex, "category", e.target.value)}
                            className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900"
                          />
                        </div>
                        <div>
                          <label className="block text-gray-500 font-bold mb-1">Badge Tag</label>
                          <input
                            type="text"
                            value={sec.badge || ""}
                            onChange={(e) => handleSectionChange(originalIndex, "badge", e.target.value)}
                            className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900"
                          />
                        </div>
                        <div>
                          <label className="block text-gray-500 font-bold mb-1">Summary</label>
                          <input
                            type="text"
                            value={sec.summary || ""}
                            onChange={(e) => handleSectionChange(originalIndex, "summary", e.target.value)}
                            className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900"
                          />
                        </div>
                        <div className="md:col-span-2 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-900/50 flex items-center gap-3">
                          <input
                            type="checkbox"
                            id={`admin-only-${sec.id}`}
                            checked={Boolean(sec.admin_only)}
                            onChange={(e) => handleSectionChange(originalIndex, "admin_only", e.target.checked)}
                            className="w-4 h-4 text-brand rounded focus:ring-brand cursor-pointer"
                          />
                          <label htmlFor={`admin-only-${sec.id}`} className="text-xs font-bold text-amber-900 dark:text-amber-300 cursor-pointer">
                            🔒 Restrict Chapter to Executives/Admins Only (Hidden from standard pilots)
                          </label>
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-gray-500 font-bold mb-1">Image URL / Screenshot Link</label>
                          <input
                            type="text"
                            value={sec.image_url || ""}
                            placeholder="https://placehold.co/800x450... or image URL"
                            onChange={(e) => handleSectionChange(originalIndex, "image_url", e.target.value)}
                            className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 font-mono text-[11px]"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-gray-500 font-bold mb-1">Image Caption</label>
                          <input
                            type="text"
                            value={sec.image_caption || ""}
                            onChange={(e) => handleSectionChange(originalIndex, "image_caption", e.target.value)}
                            className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900"
                          />
                        </div>
                        <div>
                          <label className="block text-gray-500 font-bold mb-1">App Module Route Target (Optional)</label>
                          <input
                            type="text"
                            value={sec.app_route || ""}
                            placeholder="/fleet , /groups etc."
                            onChange={(e) => handleSectionChange(originalIndex, "app_route", e.target.value)}
                            className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 font-mono text-[11px]"
                          />
                        </div>
                        <div>
                          <label className="block text-gray-500 font-bold mb-1">Route Button Text</label>
                          <input
                            type="text"
                            value={sec.app_route_label || ""}
                            placeholder="Go to fleet etc."
                            onChange={(e) => handleSectionChange(originalIndex, "app_route_label", e.target.value)}
                            className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-gray-500 font-bold mb-1">Detailed Chapter Content (Markdown Supported)</label>
                          <textarea
                            rows={12}
                            value={sec.content}
                            onChange={(e) => handleSectionChange(originalIndex, "content", e.target.value)}
                            className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 font-mono text-[11px] leading-relaxed"
                          />
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {/* Summary Callout */}
                  {sec.summary && (
                    <div className="p-3.5 rounded-xl bg-brand/5 border border-brand/10 text-xs text-brand font-medium leading-relaxed">
                      💡 {sec.summary}
                    </div>
                  )}

                  {/* Content View */}
                  <div className="text-sm text-gray-700 dark:text-gray-300">
                    {renderFormattedContent(sec.content)}
                  </div>

                  {/* Image / Screenshot Container */}
                  {sec.image_url && (
                    <div className="space-y-2 pt-2">
                      <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 bg-gray-100 dark:bg-gray-950">
                        <img
                          src={sec.image_url}
                          alt={sec.title}
                          className="w-full max-h-96 object-cover"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = "none";
                          }}
                        />
                      </div>
                      {sec.image_caption && (
                        <p className="text-xs text-center text-gray-400 italic">{sec.image_caption}</p>
                      )}
                    </div>
                  )}

                  {/* Interactive App Action Button */}
                  {sec.app_route && (
                    <div className="pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between no-print">
                      <span className="text-xs text-gray-400 font-medium">Ready to try this feature?</span>
                      <Link
                        to={sec.app_route}
                        className="px-4 py-2 rounded-xl bg-brand/10 hover:bg-brand text-brand hover:text-white font-bold text-xs transition-all flex items-center gap-2 group cursor-pointer"
                      >
                        {sec.app_route_label || "Open Module"}
                        <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                      </Link>
                    </div>
                  )}
                </div>
              );
            }))}
          </div>
        </div>
      </div>
    </div>
  );
}
