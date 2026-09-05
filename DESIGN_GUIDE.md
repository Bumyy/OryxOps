# OryxOps Design Guide

Reusable visual and layout reference extracted from the OryxOps frontend. OryxOps is an aviation operations portal: a calm airline-management workspace wrapped around dense scheduling, fleet, flight, and electronic flight bag tools.

Source of truth: `frontend/src/style.css`, `frontend/src/components/layout/Layout.tsx`, page components in `frontend/src/pages`, and EFB components in `frontend/src/components/efb`.

## 1. Design Direction

### Personality

- Professional aviation operations console with a premium airline feel.
- Warm, distinctive burgundy brand rather than generic blue SaaS branding.
- Light, spacious portal surfaces for normal work.
- Dense, high-contrast operational panels for live flight data.
- Friendly details: greetings, badges, compact Remix Icon labels, soft shadows, animated counters, and celebratory purchase states.
- Data should feel operational and trustworthy: UTC, ICAO codes, aircraft registrations, monospace numbers, explicit status labels, and visible validation warnings.

### Design principles

1. Use a neutral page canvas and white cards to establish hierarchy.
2. Use burgundy for identity, primary actions, selected navigation, links, and progress.
3. Use status colors semantically, never decoratively.
4. Prefer rounded containers and soft borders over heavy shadows.
5. Put the most important action at the right edge of a header or card on desktop, then stack it on mobile.
6. Keep operational data scannable with uppercase micro-labels, tabular figures, monospace codes, and compact badges.
7. Give every data-heavy view a useful empty, loading, and error state.

## 2. Global Application Shell

The authenticated application is a full-height two-column shell:

```text
viewport
├── left sidebar: fixed/sticky navigation
└── right workspace
    ├── sticky 56px top bar
    └── scrollable page content
```

### Sidebar

- Desktop expanded width: `256px` (`w-64`).
- Desktop collapsed width: `80px` (`w-20`).
- Full viewport height: `h-screen`.
- Fixed on small screens, sticky on desktop.
- Mobile starts off-canvas and enters with a translate animation.
- Mobile backdrop: `bg-black/40`, `z-30`.
- Sidebar layer: `z-40`.
- Logo area: `56px` high, bottom border, centered logo.
- Expanded sidebar uses the full OryxOps logo; collapsed sidebar uses the mark-only logo.
- Navigation is vertically scrollable and hides the scrollbar when collapsed.
- Navigation links use `rounded-xl`, compact vertical padding, a 20px outline icon, and semibold text.
- Active navigation: burgundy background and white text.
- Inactive navigation: muted gray text; hover uses pale burgundy background and burgundy text.
- Secondary groups are separated by a top border and `margin-top/padding-top` of roughly `12px`.
- EFB, Handbook, and Admin are collapsible navigation groups with rotating chevrons.
- The lower sidebar contains a 36px circular avatar, pilot name, callsign, and sign-out action.

### Top bar

- Height: `56px` (`h-14`).
- Sticky at the top of the workspace with `z-20`.
- Bottom border and card background.
- Mobile: hamburger control appears.
- Desktop: sidebar collapse/expand control appears.
- Right controls: notification actions, currency toggle, theme toggle, and callsign.
- Notification actions use compact pill buttons with bold text and pulse animation when actionable.
- Currency control is a small bordered rounded button using monospace text.
- Theme control is a rounded icon button.

### Workspace

- `flex-1`, `min-w-0`, and an independent vertical scroll container.
- Pages generally center content with `max-w-6xl` and `px-6 py-8`.
- Focused operational pages use narrower widths: `max-w-4xl`.
- Live tracking and handbook use wider layouts: `max-w-7xl`.
- Calendar intentionally uses near-full width with `px-2 md:px-6`.

## 3. Responsive Rules

Tailwind's standard breakpoints are used:

| Breakpoint    | Use in OryxOps                                                         |
| ------------- | ---------------------------------------------------------------------- |
| Base          | Single column, compact controls, horizontal scrolling where necessary  |
| `sm` / 640px  | Two-column cards, wider inputs, 3-column dashboard stats               |
| `md` / 768px  | Sidebar sizing variables change, desktop headers and row layouts begin |
| `lg` / 1024px | Sidebar becomes visible, multi-column page layouts, EFB phase rail     |
| `xl` / 1280px | Calendar controls become side-by-side; wide admin controls             |

Responsive patterns:

- `flex-col md:flex-row` is the standard header and card adaptation.
- `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` is the standard card gallery.
- Primary buttons become full width inside mobile forms and action areas.
- Tables sit inside `overflow-x-auto`; they do not force the page to shrink.
- Calendar uses a minimum width and horizontal scrolling on mobile.
- EFB checklist uses a desktop phase rail and a mobile select control.
- Long labels truncate with `truncate` rather than breaking dense rows.
- Header utility text is hidden below `sm` when space is limited.
- Calendar y-axis width is `100px` below `md`, `220px` at `md` and above.

## 4. Color System

The implementation uses semantic CSS variables so components can use the same classes in light and dark themes.

### Light theme

| Token               | Hex       | Role                                             |
| ------------------- | --------- | ------------------------------------------------ |
| `--bg-layout`       | `#fdf8f9` | Page canvas, very pale burgundy tint             |
| `--bg-card`         | `#ffffff` | Cards, sidebar, header, inputs in light surfaces |
| `--bg-slate`        | `#f8fafc` | Secondary panels, fields, subdued backgrounds    |
| `--bg-muted`        | `#f1f5f9` | Disabled/secondary control backgrounds           |
| `--border-main`     | `#ead9df` | Global borders                                   |
| `--text-main`       | `#1f2937` | Primary body text                                |
| `--text-sub`        | `#4b5563` | Supporting text                                  |
| `--text-muted`      | `#9ca3af` | Microcopy, placeholders, metadata                |
| `--brand`           | `#6A0C2C` | Primary burgundy                                 |
| `--brand-dark`      | `#4A0820` | Deep burgundy, gradients, strong headings        |
| `--brand-light`     | `#8A1840` | Hover and highlight burgundy                     |
| `--brand-pale`      | `#fdf8f9` | Pale burgundy surface                            |
| `--brand-border`    | `#ead9df` | Brand-tinted border                              |
| `--brand-hover-bg`  | `#f8f1f4` | Hover surface                                    |
| `--scrollbar-thumb` | `#ead9df` | Scrollbar thumb                                  |
| `--code-bg`         | `#f8fafc` | Code/data surface                                |
| `--code-text`       | `#334155` | Code/data text                                   |

### Dark theme

| Token               | Hex       | Role                        |
| ------------------- | --------- | --------------------------- |
| `--bg-layout`       | `#0d0e12` | Dark page canvas            |
| `--bg-card`         | `#161920` | Cards, sidebar, header      |
| `--bg-slate`        | `#0f1115` | Secondary panels and inputs |
| `--bg-muted`        | `#1e2028` | Muted controls              |
| `--border-main`     | `#272a35` | Global borders              |
| `--text-main`       | `#f3f4f6` | Primary text                |
| `--text-sub`        | `#cbd5e1` | Supporting text             |
| `--text-muted`      | `#94a3b8` | Metadata and placeholders   |
| `--brand`           | `#a8244e` | Dark-theme primary burgundy |
| `--brand-dark`      | `#6A0C2C` | Deep brand                  |
| `--brand-light`     | `#c23867` | Hover/highlight brand       |
| `--brand-pale`      | `#1a0e12` | Dark burgundy surface       |
| `--brand-border`    | `#3f1e29` | Dark brand border           |
| `--brand-hover-bg`  | `#2b141c` | Dark hover surface          |
| `--scrollbar-thumb` | `#3f1e29` | Dark scrollbar thumb        |
| `--code-bg`         | `#0f1115` | Code/data surface           |
| `--code-text`       | `#94a3b8` | Code/data text              |

### Status tokens

Every status has background, text, and border tokens. Keep these combinations together for accessible, recognizable state chips and alerts.

| Status       | Light background | Light text | Light border | Dark text intent      |
| ------------ | ---------------- | ---------- | ------------ | --------------------- |
| Approved     | `#d1fae5`        | `#065f46`  | `#6ee7b7`    | pale green `#86efac`  |
| Completed    | `#e0e7ff`        | `#3730a3`  | `#c7d2fe`    | pale indigo `#c7d2fe` |
| Proposed     | `#fef3c7`        | `#78350f`  | `#fcd34d`    | yellow `#fcd34d`      |
| Draft        | `#f0f9ff`        | `#0c4a6e`  | `#7dd3fc`    | sky `#7dd3fc`         |
| Error        | `#ffe4e6`        | `#881337`  | `#fda4af`    | pale red `#fca5a5`    |
| Warning      | `#fffbeb`        | `#92400e`  | `#fde68a`    | yellow `#fcd34d`      |
| Cancelled    | `#f3f4f6`        | `#6b7280`  | `#d1d5db`    | slate `#64748b`       |
| Ground OK    | `#ecfeff`        | `#164e63`  | `#67e8f9`    | cyan `#67e8f9`        |
| Ground error | `#fff7ed`        | `#7c2d12`  | `#fdba74`    | orange `#fdba74`      |

Additional recurring utility colors:

- Emerald: success, parked aircraft, available capacity, paid/completed states.
- Sky/blue: information, aircraft visibility, live tracking, takeoff crew.
- Amber: warning, rank, maintenance, pending review, executive controls.
- Rose/red: destructive actions, cancellation, errors, no-show, rejected PIREPs.
- Purple/indigo: broadcast, bidding, secondary operational tools.
- Black/slate overlays: modal scrims and live operational panels.

### DaisyUI mappings

The project enables DaisyUI light theme and maps its base colors to the semantic variables:

- `base-100` -> `--bg-card`
- `base-200` -> `--bg-slate`
- `base-300` -> `--border-main`
- `base-content` -> `--text-main`
- `primary` -> `--brand`
- `primary-content` -> white
- `secondary`, `accent`, `neutral`, `success`, `warning`, `error`, and `info` use OKLCH values.
- Selector, field, and box radii are all `1rem` by default.
- Default border is `1px`.
- Button animation duration is `0.2s`.
- Button text remains normal case.

## 5. Typography

- Font stack: system UI, `-apple-system`, BlinkMacSystemFont, `Segoe UI`, Roboto, Helvetica Neue, Arial, sans-serif.
- No custom web font is loaded.
- Body uses antialiased rendering.
- Display headings are usually `font-extrabold` or `font-black`, burgundy, and tightly tracked.
- Page headings range from `text-3xl` to `text-5xl` depending on page importance and viewport.
- Card titles commonly use `text-base` to `text-2xl` and `font-bold`/`font-extrabold`.
- Micro-labels use `text-[9px]` to `text-xs`, uppercase, `font-black`, and `tracking-wider` or `tracking-widest`.
- Data values use `font-mono`, `tabular-nums`, or both when alignment matters.
- Supporting copy is generally `text-xs` or `text-sm` with gray/semantic-muted color.
- Labels are bold and usually uppercase in forms and data panels.

Recommended type hierarchy:

```text
Page title       48px / 700-900 / brand
Section heading  24px / 700-800 / main or brand
Card heading     16-20px / 700-900 / main
Body             14px / 400-600 / sub
Metadata         10-12px / 600-800 / muted, often uppercase
Operational data 12-20px / 700-900 / monospace/tabular
```

## 6. Shape, Spacing, and Elevation

### Radius language

- Small controls: `rounded-lg` to `rounded-xl`.
- Standard cards: `rounded-2xl`.
- Feature and operational cards: `rounded-3xl`.
- Pills and badges: `rounded-full`.
- Icon containers: usually `rounded-xl` or `rounded-2xl`.
- Modals: `rounded-3xl`.
- Avoid mixing sharp corners into a rounded card except table rows, grid cells, and status ribbons.

### Spacing language

- Page padding: usually `24px` horizontal and `32px` vertical.
- Compact pages: `16px` horizontal and `32px` vertical.
- Card padding: `20px` to `32px`; dense data cards use `16px` to `24px`.
- Card stacks: `space-y-5` or `space-y-6`.
- Grid gaps: `12px`, `16px`, `20px`, or `24px`.
- Card section separators use a subtle border plus `pb-3/4` and `mb-4/5`.

### Shadows and borders

- Default card: `shadow-sm` with a 1px semantic border.
- Hover card: `shadow-md` or `shadow-lg`, sometimes a tiny scale increase.
- Feature/hero card: `shadow-xl`.
- Modals: `shadow-2xl`.
- Borders are more important than shadows; preserve `border-brand-border` around most light cards.
- Use a ring to identify the assigned group or selected entity: `ring-4 ring-brand/10` to `ring-brand/15`.

## 7. Core Component Patterns

### Page header

```text
flex column -> row at md
title + one-line description on left
primary action or balance panel on right
margin-bottom: 32px
```

Use burgundy for the title, gray for the description, and rounded gradient or solid burgundy for the primary action.

### Standard card

```text
bg-card
border border-brand-border
rounded-2xl or rounded-3xl
shadow-sm
p-5/p-6/p-8
```

Interactive cards add `hover:shadow-md`, `hover:border-*`, and a short transition.

### Stat card

- Small colored icon tile at top-left.
- Optional link or status at top-right.
- Uppercase muted micro-label.
- Large bold value.
- Optional supporting line or progress bar.
- The dashboard uses three equal cards at `sm` and above.

### Badge and chip

- Use a pill for statuses and identity labels.
- Use a small rounded rectangle for metadata such as flight number or category.
- Most badges are `text-[9px]` to `text-xs`, bold/black, uppercase, with a border.
- Pair icon and text when the state must be understood quickly.

### Buttons

- Primary: burgundy background, white text, `rounded-xl` or `rounded-full`.
- Gradient primary: `from-brand-dark to-brand`; used for login and high-value actions.
- Secondary: white/card background with semantic border and gray or brand text.
- Destructive: red text/border or red fill only when the action is destructive.
- Success: emerald fill for approvals and completion.
- Compact utility: `text-xs`, `px-3/4`, `py-1.5/2`, rounded-xl.
- Disabled state: reduced opacity or gray background, and no shadow.
- Hover motion is subtle: color shift, shadow increase, `-translate-y-0.5`, or a small icon scale.

### Forms

- Inputs and selects use `rounded-xl`, `px-3/4`, `py-2/2.5`, 1px semantic border, and a brand focus border/ring.
- Global inputs use `--bg-slate`, `--text-main`, and `--border-main` so dark mode remains usable.
- Labels use bold small text; important form labels are uppercase.
- Multi-field forms use one-column base and two/four columns at `sm`/`md`.
- Keep controls inside a tinted inset panel when they are a subtask, such as quick enrollment or rank creation.

### Tables

- Wrap every table in `overflow-x-auto`.
- Use `bg-brand-pale` for table headers.
- Header cells use compact padding and semibold gray text.
- Body rows use a top border, compact padding, and inline controls.
- Use monospace for IDs, ICAO codes, and numeric values where useful.

### Empty states

- Centered text inside a card with generous vertical padding, usually `py-12` to `py-16`.
- Explain what is empty and what the user should do next.
- Optional icon or emoji, muted heading, and muted supporting text.
- Keep the border and card structure so empty and loaded views occupy the same visual region.

### Loading states

- For pages: card skeletons with `animate-pulse` and gray rounded blocks.
- For actions: replace the label with `Loading...`, `Saving...`, `Dispatching...`, etc.
- For overlays: centered spinner with brand border and short status label.
- Calendar uses a translucent white overlay with backdrop blur while schedules refresh.

### Alerts and warnings

- Use semantic status background, text, and border as a set.
- Place an icon at left, message in the middle, and dismiss action at right.
- Operational warnings are compact (`text-xs`) and stacked above the main content.
- Persistent warnings can be dismissed and restored; do not make them disappear without a way to recover them.

### Modal

- Full viewport fixed scrim: `bg-black/70`, optionally `backdrop-blur`.
- Centered responsive card with `max-w-*`, full width minus mobile padding, `rounded-3xl`, and `shadow-2xl`.
- Keep a clear header, scrollable body when needed, and an explicit action footer.
- Prevent click propagation from the card to the scrim close handler.

## 8. Page Layout Catalog

### Login (`/login`)

- Standalone page without the authenticated shell.
- Full viewport burgundy gradient: deep burgundy to primary burgundy.
- Centered white `max-w-md` card, `rounded-2xl`, `shadow-xl`, `p-8`.
- Centered wordmark, subtitle, error alert, two stacked fields, full-width gradient sign-in button.
- Button lifts by `0.5px` and gains shadow on hover.

### Dashboard (`/`)

The richest portal landing page, centered at `max-w-6xl` with `px-5 py-8` and `space-y-6`.

```text
hero banner
active booking / browse schedule alert
3-up stat card row
dark airline metrics strip
5/3 + 5/2 split: transaction log + quick actions
```

- Hero: white rounded-3xl card, brand border, soft decorative blurred burgundy circles.
- Hero left: time-based greeting, Zulu clock, pilot title/name, callsign/group/rank badges.
- Hero right: pale burgundy wallet panel.
- Booking alert: burgundy filled when active; pale neutral prompt when absent.
- Metrics strip: deep burgundy gradient, white text, subtle dotted texture, large tabular values.
- Bottom split: transaction list in a rounded-3xl card and four colored quick-action tiles.
- Numeric content uses count-up animation and tabular figures.

### Flying Groups (`/groups`)

- `max-w-6xl`, large page title, optional vacancy bidding banner.
- Bidding banner: blue/purple/brand translucent gradient, dark premium surface, rounded-3xl, open slot action pills.
- Group gallery: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`, compact `gap-4` on mobile and `gap-6` from `sm` upward.
- The page shows active groups only. The assigned group is sorted first and visually elevated with a brand border, ring, subtle brand/amber gradient, and an absolutely positioned blue `YOUR ASSIGNED GROUP` corner ribbon that does not affect card height.
- Cards show group name, a two-stat inset panel, capacity progress bar, and an optional vacancy bidding action.
- Capacity bar semantics: emerald under 75%, amber above 75%, rose when full.

### Group Detail (`/groups/:id`)

- Detail-oriented version of the group view: identity header, schedule context, pilot roster, and group-specific operational content.
- Reuse the same selected-group border/ring, badge, capacity, and compact table/card patterns from Groups.

### Fleet Registry (`/fleet`)

- `max-w-6xl`, page header with Sync All Locations action.
- Optional progress card for a multi-aircraft sync operation.
- Optional success and warning alerts.
- Fleet is grouped into large rounded-3xl sections by flying group.
- Assigned group section is first and has brand border/ring plus a tinted gradient.
- Airframes use a `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` card gallery.
- Aircraft card: registration/type header, status and IF Live pills, live visibility inset, airport/hours/legs footer, current pilot callout.

### Aircraft Detail (`/fleet/:id`)

- Single-aircraft profile layout using the same rounded card system.
- Emphasize registration, aircraft type/livery, current airport, operational status, IF Live metadata, assigned group, pilot, and flight history.
- Use data rows and compact timeline/table treatments for history rather than a loose text wall.

### Schedule Calendar (`/calendar`)

- Full-width operational view; no narrow max-width wrapper.
- Header has title/description and an Auto-Schedule action.
- Control box: active group selector, previous/next week, week label/status, Today, fleet filter, status filter, My Bookings toggle, Calendar/List switcher, Notify Staff.
- Executive control box appears only to executives/admins and uses warning tint, proposed badge, clone, approve, and notify actions.
- Warnings appear above the main content and use error/warning status tokens.
- Calendar view: white rounded card, horizontally scrollable, 7 day columns x 24 UTC rows.
- Grid dimensions: 40px per hour, 36px header; minimum width `700px` mobile and `900px` desktop.
- Sticky UTC/y-axis and day headers; live UTC line is red with a dot and timestamp.
- Waves appear as dashed blue/green background bands; flight blocks encode status and can be dragged.
- List view is a compact alternative for the same filtered schedules.
- Create/edit schedule opens a step-based modal from empty grid cells.

### Bookings / Operations Center (`/bookings`)

- Narrow `max-w-4xl` reading width.
- Large title and two-option pill tab switcher: My Bookings and Flight Logs.
- Booking cards use a status ribbon, route header, flight number badge, aircraft/crew/pax metadata, live tracking progress, and right-side Flight Ops action.
- Dispatched bookings use emerald tint/ring; awaiting dispatch uses amber tint.
- No-show state uses a red alert ribbon and rebooking action.
- Logs use compact cards with approved/pending status and an emerald salary panel.
- Pay slip opens a large centered modal with logo header, download action, embedded PDF surface, and footer.

### Flight Operations (`/operations`)

- Narrow `max-w-4xl` operations workspace.
- States:
  - Loading skeleton.
  - No active booking empty state.
  - Pre-flight booking overview plus amber dispatch deck.
  - Dispatched dashboard with broadcast strip, live tracking card, planning links, fuel estimator, and PIREP form.
- Active dashboard uses a two-column layout at `md`.
- Live tracking uses success/info gradients, progress bar, and compact 3-column stat tiles.
- Fuel and PIREP forms are white rounded-3xl cards.
- PIREP controls use stacked labels, paired HH/MM inputs, toggles, and a wide success submit button.

### Proposals Shop (`/shop`)

- `max-w-6xl`, animated reveal on entry.
- Header places title/description left and wallet balance panel right.
- Token inventory is a full-width rounded-3xl summary card.
- Product grid: two equal cards at `md`, one column on mobile.
- Product cards have generous `p-8`, large icon tile, explanatory copy, and a tinted footer with cost/action.
- Purchase confirmation is a dark-scrim modal with success icon, transaction badge, receipt breakdown, updated balance, inventory stock, and two footer actions.

### Transfers (`/transfers`)

- `max-w-6xl`.
- Form card with a 3-column grid at `sm`: transfer type, destination, reason.
- Full-width rounded table/card below for submitted requests.
- Status is expressed with the standard pending/approved/denied semantics.

### Live Tracker (`/admin/track`)

- `max-w-7xl` and a 4-column layout at `lg`.
- Left/main map is `lg:col-span-3`, fixed around `600px` tall, rounded-3xl, with a dark translucent map overlay panel.
- Right activity/list panel is `600px` tall, scrollable, rounded-3xl.
- Header includes live pulsing green badge and purple operational badge.
- Empty/loading/error states preserve the large panel footprint.

### Admin Panel (`/admin` and dedicated admin routes)

The consolidated Admin Panel uses a `max-w-6xl` wrapper, a large burgundy title, and a horizontal wrapping pill tab bar. Active tabs are solid burgundy; inactive tabs are white/transparent with a semantic border. The content below is a sequence of management cards rather than a separate visual language.

- Pilots: management card with search, quick-enroll inset, and a responsive enrolled-pilot card grid. Each pilot card contains a compact header, save action, two-column edit controls, and an assigned-aircraft chip selector.
- Groups: split-pane workspace. A scrollable group list occupies one third at `lg`; the selected group management workspace occupies two thirds. Empty selection preserves a full-height centered card. Create-group is a centered modal.
- Fleet/Aircraft: page wrapper plus fleet management heading, create-airframe card, and horizontally scrollable table.
- Transfers: form/management card followed by a transfer review table.
- Waves: compact wave-management forms and list/table views for arrival/departure time windows.
- Settings: grouped setting cards with compact fields and save actions.
- Fleet Bidding: dark translucent management surface with blue/purple emphasis, session cards in a responsive grid, and a dark detail modal/panel for applicants and bids.
- Crew Roster: wide `max-w-7xl` view with purple gradient header action, horizontal filter tabs, large rounded roster cards, aircraft/crew assignment controls, and amber/blue inset panels.
- Auto Scheduler: narrow `max-w-4xl` two-column form inside a white rounded-2xl card. Inputs are grouped into aircraft/route controls, timing/haul controls, constraints, and a full-width action footer.

Dedicated routes such as `/admin/pilots`, `/admin/groups`, `/admin/aircraft`, `/admin/transfers`, `/admin/waves`, and `/admin/settings` are thin wrappers around these same tab layouts, with a `max-w-6xl` page title above the shared content.

### Handbook (`/handbook`)

- Standalone documentation workspace inside the authenticated shell but visually uses its own page canvas and typography.
- `max-w-7xl`, stacked rounded-2xl cards.
- Top header card: book icon, title, version pill, updated date, edit/read-only state, add/save actions.
- Search/filter card: search field plus horizontally scrollable category pills.
- Content is a vertical stack of chapter cards, each with numbered burgundy square, category/badge pills, heading, summary/content, optional image, and app route action.
- Uses scrollspy navigation and deep links per chapter.
- Executive edit mode adds inline fields, reorder controls, admin-only toggle, image URL/caption, and delete action.
- Print mode hides shell controls, provides a cover page, and forces section page breaks.

### EFB (`/efb` and subroutes)

The Electronic Flight Bag is a cockpit tablet inside the normal shell. It has six routed tabs:

1. Briefing
2. Interactive Checklist
3. Weather & Performance
4. Aircraft Performance
5. Charts
6. Settings

Shared EFB patterns:

- Operational content uses dense rounded cards, compact labels, and aviation-specific monospace values.
- Tab state is represented by the route and mirrored in the sidebar accordion.
- Briefing uses flight summary cards, route/flight plan details, and a PDF viewer.
- Checklist uses a desktop phase rail, mobile phase select, progress bar, active phase panel, check controls, and a floating co-pilot action.
- Checklist state uses brand-pale callouts; active voice states pulse and expose transcript/keyboard guidance.
- Weather uses airport weather panels, METAR cards, runway wind vectors, aircraft diagrams, warning overlays, and responsive split cards.
- Aircraft performance uses compact specification grids, performance tables, and aircraft diagrams.
- Charts uses an embedded chart workspace with a large viewer surface and airport/chart controls.
- Settings uses grouped form cards for voice, co-pilot, checklist, and display preferences.
- Boarding modal uses a dark cockpit-like surface, manifest progress, cabin map, stat tiles, and an amber confirmation/action button.

## 9. Navigation and Access Structure

Main navigation:

- Dashboard `/`
- Flight Operations `/operations`
- Flying Groups `/groups`
- Schedule `/calendar`
- My Bookings `/bookings`
- Proposals Shop `/shop`

EFB navigation:

- `/efb`
- `/efb/checklist`
- `/efb/weather`
- `/efb/aircraft`
- `/efb/charts`
- `/efb/settings`

Other application routes:

- Fleet `/fleet`
- Aircraft detail `/fleet/:id`
- Group detail `/groups/:id`
- Transfers `/transfers`
- Handbook `/handbook` and `/handbook/:sectionId`

Admin navigation:

- `/admin`
- `/admin/track`
- `/admin/pilots`
- `/admin/groups`
- `/admin/crew-roster`
- `/admin/bidding`
- `/admin/aircraft`
- `/admin/transfers`
- `/admin/waves`
- `/admin/settings`
- `/admin/auto-scheduler`

Access behavior is part of the design:

- All authenticated users can access EFB.
- Full pilot portal requires executive/admin/pilot access.
- Admin pages require executive/admin access.
- Admin-only handbook chapters are hidden from ordinary pilots.
- Standalone EFB mode displays an amber explanatory notice in the sidebar when full portal access is unavailable.

## 10. Motion and Interaction

- Default transitions: `transition-colors duration-200` or `transition-all duration-300`.
- Cards may lift with `hover:-translate-y-0.5` or scale to `1.015`.
- Dashboard numbers count up over roughly `900ms`.
- Reveal-on-scroll: `.reveal` starts at `opacity: 0`, `translateY(20px)` and reaches visible state over `600ms`.
- Loading: `animate-spin` on borders/icons, `animate-pulse` on skeletons and active notifications.
- Live indicators use `animate-ping` on a small dot.
- Checklist/co-pilot uses pulse, bounce, chime, voice, and floating action feedback to communicate state.
- Modals fade in; celebratory purchase modal adds scale/bounce/pulse accents.
- Respect reduced-motion preferences when porting the system to another project.

## 11. Icons and Imagery

- Use `@remixicon/react` for interface icons. Import only the icons used by a component rather than rendering raw SVG path data.
- Prefer filled Remix variants (`*Fill`) for prominent UI icons, stat tiles, banners, and action buttons; use line variants (`*Line`) for quieter navigation and secondary controls.
- Common icon size: `20px`; compact nested navigation: `16px`; micro actions: `12px` to `14px`.
- Icons inherit `currentColor`; active navigation automatically becomes white.
- Keep icons semantic and pair them with text when the state or action is not immediately obvious. Avoid emoji as the primary interface icon when a Remix Icon equivalent exists.
- Aircraft artwork is supplied as SVG files in `frontend/src/assets/aircraft` for generic, Airbus, Boeing, and business jet profiles.
- Logos in `frontend/public`:
  - `oryxops_logo_colored.webp`
  - `oryxops_logo_white.webp`
  - `logo_only_colored.webp`
  - `logo_only_white.webp`
  - PNG equivalents for colored logo/alternate mark
- Use colored logo on light surfaces and white logo on dark surfaces.

## 12. Implementation Notes for Reuse

Define the semantic tokens first, then map framework utility classes to those tokens. Do not hard-code a new color in an individual page when the color represents a reusable meaning.

Suggested token starter:

```css
:root {
  --bg-layout: #fdf8f9;
  --bg-card: #ffffff;
  --bg-slate: #f8fafc;
  --bg-muted: #f1f5f9;
  --border-main: #ead9df;
  --text-main: #1f2937;
  --text-sub: #4b5563;
  --text-muted: #9ca3af;
  --brand: #6a0c2c;
  --brand-dark: #4a0820;
  --brand-light: #8a1840;
  --brand-pale: #fdf8f9;
  --brand-border: #ead9df;
  --brand-hover-bg: #f8f1f4;
}
```

Suggested page wrapper:

```tsx
<div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
  <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
    <div>
      <h1 className="text-4xl md:text-5xl font-extrabold text-brand">
        Page title
      </h1>
      <p className="text-sm text-gray-500 mt-1">
        Short operational description.
      </p>
    </div>
    <button className="rounded-xl bg-brand text-white font-bold px-4 py-2.5">
      Primary action
    </button>
  </header>
</div>
```

Suggested semantic status chip:

```tsx
<span
  className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full border"
  style={{
    background: "var(--status-approved-bg)",
    color: "var(--status-approved-text)",
    borderColor: "var(--status-approved-border)",
  }}
>
  Approved
</span>
```

## 13. Porting Checklist

- Create light and dark semantic tokens before building screens.
- Build the 256px/80px responsive sidebar and 56px sticky header first.
- Add the standard page wrapper and card primitives.
- Implement button, input, badge, alert, table, modal, empty, and loading patterns.
- Add status tokens and use them consistently across all workflow states.
- Use the dashboard composition as the reference for hierarchy and spacing.
- Use the calendar as the reference for dense responsive operational data.
- Use the EFB as the reference for high-information cockpit tooling.
- Test at mobile width, especially navigation, tables, calendar, EFB checklist, and modals.
- Test both themes; avoid raw white/gray utility classes where they defeat semantic theme variables.
- Preserve UTC/monospace/tabular formatting for aviation and time-sensitive data.
- Keep actions explicit: `Dispatch`, `Approve`, `Book`, `File PIREP`, `Notify`, `Sync`, `Save`.

## 14. Known Source Conventions

These are existing conventions to preserve only when intentionally matching OryxOps:

- Tailwind CSS v4 and DaisyUI are used together.
- Some components use DaisyUI classes such as `btn`, `card`, `alert`, `badge`, `stat`, `progress`, and `toggle`; others use raw Tailwind utilities.
- The global stylesheet overrides common gray/white utility backgrounds, borders, and text colors to make the semantic dark theme work.
- The Handbook includes some explicit `gray-*` and `dark:bg-gray-*` values, so it is visually related to but slightly more independent from the main portal theme.
- `@remixicon/react` is the centralized icon package; filled variants are preferred for prominent UI icons and line variants for quieter controls.
- The visual system is intentionally rounded and soft, but the calendar grid and dense data tables remain compact and structured.
