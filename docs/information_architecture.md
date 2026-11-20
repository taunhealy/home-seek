# Information Architecture Specification — HomeSeek (*Knightly*)

## 1. Strategic Positioning & Organizing Principle
- **Product Purpose:** Cape Town rental intelligence radar that helps renters **discover** safe/quiet properties, **automate** personal alerts, **decide** with AI & side-by-side comparison, and **protect** their deposit on move-in.
- **Organizing Principle:** **Renter Lifecycle + Dual-Layer Separation**
  - **Layer 1 — Public / Marketing Site:** Educates, builds trust, captures SEO traffic, and converts visitors into `/search`.
  - **Layer 2 — App Workspace:** Task-focused tools (`Search`, `Compare`, `Inspection`) plus personal account automation (`Alerts / Dashboard`, `Profile & Billing`) tucked into the authenticated menu.

---

## 2. Global Sitemap

```text
HomeSeek / Knightly
├── Layer 1: Marketing & Acquisition
│   ├── /                     — Landing Page & Brand Story
│   ├── /#features            — Core Capabilities
│   ├── /pricing              — Passes & Credit Top-Ups
│   └── /suburbs/[slug]       — Cape Town Suburb Rental Guides (SEO)
│
├── Layer 2: App Workspace
│   ├── /search               — Discover (Map Radar, 3D Sun, Ghost Pool)
│   ├── /compare              — Decide (Side-by-Side Matrix)
│   └── /inspection           — Protect (Ingoing Condition PDF)
│
├── Layer 3: Account & Alerts (Authenticated)
│   ├── /alerts               — Radar Alerts & Daily Digests (Dashboard)
│   └── /profile              — Renter Profile, Channels & Plan
│
└── Layer 4: Support, Legal & Ops
    ├── /contact              — Support & Feedback
    ├── /privacy & /terms     — Legal Policies
    └── /admin                — Internal Ops (Unlinked)
```

---

## 3. Navigation Architecture (2-Level Context)

### Level A: Marketing Navbar
*Shown on `/`, `/pricing`, `/contact`, `/suburbs/*`, `/legal/*`*

| Position | Label | Destination | Role |
| :--- | :--- | :--- | :--- |
| **Brand** | Logo + *Cape Town Renter Radar* | `/` | Anchor to homepage |
| **Nav 1** | **Home** | `/` | Brand overview |
| **Nav 2** | **Features** | `/#features` | Jump to core pillars |
| **Nav 3** | **Pricing** | `/pricing` | Passes & top-ups |
| **Nav 4** | **Contact** | `/contact` | Support / inquiries |
| **Primary CTA** | **Open App** | `/search` | Zero-friction entry into product |
| **Auth** | **Sign In** / Avatar Menu | Modal / Dropdown | Account access |

### Level B: App Workspace Navbar
*Shown on `/search`, `/compare`, `/inspection`, `/alerts`, `/profile`*

| Position | Label | Destination | Visibility |
| :--- | :--- | :--- | :--- |
| **Brand** | Logo + *Workspace* | `/` | Always |
| **Nav 1** | **Search** | `/search` | Always (Public) |
| **Nav 2** | **Compare** *(+ badge)* | `/compare` | Always (Public) |
| **Nav 3** | **Inspection** | `/inspection` | Always (Public) |
| **Nav 4** | **Dashboard** | `/alerts` | **Signed-in only** |
| **Secondary CTA** | **Pro** pill | `/pricing` | Always |
| **Auth** | **Sign In** / **Knight Avatar Menu** | Modal / Dropdown | Always |

### Account Dropdown (`My HomeSeek / Knightly`)
*Mirrors the familiar `My Property24` mental model for returning users:*
- **AI Credits & Plan Status** (top card with `Profile` + `Top Up` -> `/pricing`)
- **Quick Profile** (nickname + custom or animated Knight default avatar)
- **Workspace Hub:** `Dashboard` (`/alerts`), `Profile & Plan` (`/profile`), `Manage Alerts` (`/alerts`), `AI Scout` (`/discover`), `Ingoing Inspection (PDF)` (`/inspection`)
- **Notification Channels:** WhatsApp number + WhatsApp/Email toggles
- **Sign Out**

### Global Footer *(hidden on full-screen `/search` map)*
- **Product:** Home (`/`), Search (`/search`), Compare (`/compare`), Inspection (`/inspection`), Pro (`/pricing`)
- **Support & Legal:** Contact (`/contact`), Privacy (`/privacy`), Terms (`/terms`)

---

## 4. Page-Level Content & Responsibility Matrix

| Route | Stage | Primary User Job | Key Modules & Data | Primary CTA |
| :--- | :--- | :--- | :--- | :--- |
| **`/`** | Acquire | Understand why HomeSeek beats standard portals | Hero promise, problem/solution, 4 lifecycle pillars (`#features`), bottom CTA | **Open App** (`/search`) |
| **`/search`** | Discover | Explore suburbs, filter noise/crime, check sunlight | Suburbs, budget (`min`–`max`), beds (`0.5+`–`3+`), `minSqm`, Proximity Anchor + radius, 8 filter pills, Mapbox 3D Sun & Terrain, Ghost Layer, AI Analysis | **Save Alert** / **Rank Top 10** |
| **`/alerts`** | Automate | Manage personal radar alerts & review daily shortlists | Alert cards synced with Search filters, Edit Modal, WhatsApp/Email status, AI reports | **Run Scan** / **Edit Radar** |
| **`/compare`** | Decide | Compare 2–4 shortlisted properties side-by-side | Price/m², commute to anchor, noise/crime, fibre/parking/pets, AI verdict | **Export / Decide** |
| **`/inspection`** | Protect | Document ingoing property condition for deposit safety | Property details -> AI room criteria -> timestamped photos + notes -> PDF export | **Export Inspection PDF** |
| **`/pricing`** | Monetize | Choose a pass or top up AI Audit credits | Free Scout (R0), 30-Day Hunter Pass (R149), Pro Monthly (R229), +15 Credits (R69) | **Activate / + Add 15 Credits** |
| **`/profile`** | Retain | Manage identity, defaults, notification routing, credits | Knight/custom avatar, nickname, WhatsApp/Email prefs, active plan | **Save Settings** |

---

## 5. Core User Journeys (<= 3 Steps to Value)

1. **First-Time Renter (Zero Auth Friction):**  
   `/` -> clicks **Open App** -> `/search` -> filters suburbs, toggles Crime/Noise/Ghost/3D Sun -> **Save Alert** or **Compare** -> prompted to **Sign In** only when persisting personal data.
2. **Active Hunter Automation:**  
   `/search` (configures suburbs, budget, pills, anchor) -> clicks **Save Alert** -> **Saved · Manage Alerts ->** (`/alerts`) -> receives daily ranked WhatsApp/Email digests.
3. **Viewing & Move-In Protection:**  
   `/search` -> pins finalists to `/compare` -> upgrades on `/pricing` if extra AI photo audits are needed -> moves in and completes `/inspection` to protect deposit.

---

## 6. Route Hygiene & Redirect Rules
- **Canonical Discovery Route:** `/search` (retire or 301-redirect overlapping legacy routes `/discover`, `/explore`, `/map` once any remaining AI Scout UI is folded into `/alerts`).
- **Authenticated Route Group `(dashboard)`:** Protects `/profile` and `/alerts` management; redirects signed-out visitors cleanly to `/`.
- **Internal Ops:** `/admin` remains unlinked from all public navigation and guarded by role check.
