# ERP SaaS

A multi-tenant ERP SaaS built with **Angular 21** (standalone components + signals) and a
**Spring Boot REST API** backed by PostgreSQL.

Authentication, signup, KYC review, billing and the HR/Support modules use the real backend.
Other business modules still use an in-memory mock data layer for the demo.

> This is an MVP. The Spring Boot backend enforces authentication, authorization and tenant
> isolation. Business modules that still use mock data must be connected to the API before
> production use.

---

## ✨ What the demo includes

| Area | Features |
| --- | --- |
| **Auth & onboarding** | Landing page, signup wizard with email OTP, KYC documents, 30-connection free trial, account status page, role-based redirects, 404 page |
| **HR** | Employee directory, leave requests and approval workflow (Business/Enterprise plans) |
| **Support** | Customer tickets, ticket detail and knowledge base (view-only for commercial role) |
| **CRM** | Contacts & companies (archive/restore), Leads (convert to contact / mark lost), Opportunities (5-stage kanban pipeline with KPI stats), Interaction history & reminders per contact, global Reminders page |
| **Products** | Product & service catalogue, supplier links, archive/restore |
| **Sales** | Sales orders, delivery notes (order → delivery → invoice chain enforcement), quotes, invoices (stamp duty, credit notes with cap, credit-limit check), PDF/PDF-table export |
| **Payments** | Payment list, form and detail (internal + customer portal "Pay now") |
| **Purchases** | Purchase orders, receiving flow, supplier details |
| **Stock** | Multi-warehouse levels, movements, adjustments, transfers (insufficient-stock guard) |
| **Accounting** | Auto journal entries, chart of accounts, entry detail |
| **Reporting** | Charts (Chart.js) and PDF export |
| **Client portal** | External customers see their invoices, quotes and orders in a dedicated space (IDOR-safe: they can only open their own documents) |
| **Platform admin** | Super-admin space: tenant supervision and plan management |
| **Workspace** | Dashboard per role, Apps launcher filtered by enabled modules, company settings |

Security-relevant behaviour is simulated on the frontend too: role permissions
(`PermissionService`), per-plan enabled modules (`moduleGuard`), and ownership checks on the
portal pages — just like the backend will enforce it later.

## 🧪 Demo accounts

Open `http://localhost:4200/login` — every account uses the password **`demo`**.

| Email | Role | Opens |
| --- | --- | --- |
| `admin@demo.com` | Company admin | Full workspace + settings |
| `directeur@demo.com` | Director | Full workspace |
| `commercial@demo.com` | Sales | CRM, sales, invoices |
| `acheteur@demo.com` | Buyer | Purchases, CRM |
| `magasinier@demo.com` | Warehouse keeper | Stock only |
| `comptable@demo.com` | Accountant | Invoices, accounting |
| `client@demo.com` | External client | Client portal |
| `superadmin@platform.com` | Platform super admin | Platform admin space |

## 🚀 Getting started

Prerequisites: **Node.js 20+**, npm, **Java 21+**, Maven wrapper, and PostgreSQL on port `5433`.

Start the database and backend:

```bash
cd erp_backend/erp
docker compose up -d
.\mvnw.cmd spring-boot:run
```

Start the frontend in another terminal:

```bash
cd ERP
npm install
npm start          # ng serve  →  http://localhost:4200
```

Other useful scripts:

```bash
npm run build          # production build into dist/
npm test               # vitest (watch mode)
npx ng test --watch=false   # CI-style single run
.\mvnw.cmd -q "-Dtest=!ErpApplicationTests" test   # backend tests
```

## 🌍 Internationalization

- Powered by **@jsverse/transloco**, UI fully translated in **English 🇬🇧 and French 🇫🇷**
  (~1 550 translation keys, parity-checked), switchable from the navbar.
- Arabic + right-to-left layout is planned (`ar.json` does not exist yet).

## 🏗️ Project structure

```
ERP_SaaS/
└── ERP/
    └── src/app/
        ├── core/            # application-wide services, guards, interceptors
        ├── layout/          # navbar, sidebar, main/portal/admin layouts
        ├── shared/          # reusable components, models, pipes, utilities
        └── features/        # business modules
            ├── auth/ crm/ products/ sales/ invoices/ payments/
            ├── purchases/ stock/ accounting/ invoicing/ reports/
            ├── dashboard/ portal/ admin/ settings/ apps/ landing/ …
```

Conventions:

- **Standalone components** with small responsibilities (one page = one folder with
  `ts/html/css`).
- Each module owns its `services/` (mock Angular services backed by in-memory `signal`s,
  simulating HTTP latency and typed error codes) and `models/` (TypeScript interfaces).
- Pages never call HTTP directly — always through a module service, so the future Spring Boot
  integration only has to swap the mock body for `HttpClient` calls.
- Unit tests live next to the code (`*.spec.ts`), run with **Vitest** (~206 tests green).

## 🗺️ Roadmap

| Wave | Scope | Status |
| --- | --- | --- |
| **W0** | Hardening pass: order/delivery/invoice chain guards, credit limits, module guard, portal IDOR fixes, app filtering | ✅ Done |
| **W1** | Full CRM: leads, opportunities kanban, interactions, reminders | ✅ Done |
| **W2** | Purchases wave 2: supplier bills (FA) from received orders or standalone, vendor payments (`out`), order duplication (except cancelled), reports tabs (aging/customers/stock), product min-stock thresholds | ✅ Done |
| **W3** | Access control (RBAC): fixed role templates (admin/commercial/acheteur/magasinier/comptable/directeur) with per-module actions, module route guard, permission-filtered action buttons, shared `/login/email` workspace login, forced password renewal page, audit trail in Settings (EN/FR) | ✅ Done |
| **W9** | Super-admin SaaS console: persisted tenant registry (safeStorage), sign-up requests with KYC check (approve creates a trial tenant, reject with note), subscription payment statements (paid/pending/overdue, mark-paid), supervision stats extended (pending sign-ups, overdue amount); signup wizard step 3 uploads the three KYC documents (≤2 MB, preview kept for small images) and the console shows the real picture in the document viewer | ✅ Done |
| **W4** | Advanced stock finalized: min-stock alert card on the dashboard (top 5 low products), stock list threshold/state columns + low banner, movements ledger with column sorting (date/product/quantity) and clickable document links (invoice/purchase), warehouse renaming + per-warehouse stats (references, stored value); stock alert threshold editable in the product form | ✅ Done |
| **W4b** | Role dashboards: dedicated home per actor at its own URL (`/dashboard/sales`, `/dashboard/purchase`, `/dashboard/warehouse`, `/dashboard/accounting`) with focused KPIs, activity lists and quick actions; the admin-entreprise and directeur keep the global dashboard, every landing is module-guarded (2 languages, vitest suite updated) | ✅ Done |
| **W5** | Invoicing compliance: legal numbering audit tab in Reports (all 7 document families scanned for gaps, duplicates and chronology, details in tables + CSV export), posting guard blocking invoices when the seller tax number is empty or the assigned number already exists, mandatory mentions block (penalties 1.5 %/month, VAT-exemption notice, seller identity) on the invoice detail page and in the PDF export, supplier-bill FA numbering restarts for each new year; error banners translated (EN/FR, 26 new keys) | ✅ Done |
| **W6–W8** | Chain + accounting + BI finalized: customer payments history card on the invoice detail page (dates/modes/amounts, empty state), general ledger per account (account filter in the journal, clickable chart-of-accounts codes, ledger service + test), analytics BI page `/analytics` (calendar period selector month/quarter/year, KPIs sales/collected/outstanding/overdue, 4 Chart.js charts on real data via ReportsService, role-guarded to admin-entreprise/directeur/comptable in the finance nav group); quote→order conversion and invoice→payment link were already wired and verified (EN/FR, 24 new keys) | ✅ Done |
| **UX** | Signup KYC extended: the CIN is now requested on both sides (recto + verso as two separate files, four documents in total) and the matricule fiscal is typed at the same step; the send-code button unlocks only with all four files and the tax number, the super-admin console gains a matricule fiscal column and the recto/verso documents in its viewer; BI page polished (segmented period picker, compact KPI/chart sizes, range chip) | ✅ Done |
| **Rooms (R1–R2)** | Rooms Live foundation: collaboration module `collab` for every internal role (sidebar section, app tile, plan modules + migration of existing workspaces), room list with creation form (title, open/private access, optional linked document, member invitations), persisted live rooms with host/participant/observer roles, instant chat (bubbles, day flow, composer) with locked-view for private rooms and auto-join for open rooms, archived read-only state; demo seed rooms (EN/FR, 43 new keys, service + 2 page specs) | ✅ Done |
| **Rooms (R3–R4)** | Rooms Live media + files: live session stage in the room page (camera/mic via `getUserMedia`, screen sharing via `getDisplayMedia`, local preview video, mic/camera toggles, graceful unsupported/denied states), file sharing in the chat (2 MB cap, images/PDF only, small image previews kept in the attachment, file attached to a message, author-or-host removal leaving a *file removed* mark in the bubble; media-stage component with its own spec, service attachment tests, 18 new i18n keys) | ✅ Done |
| **Rooms (R5)** | Rooms Live moderation: the room owner manages participants inline (invite a workspace member from a dropdown, change role participant/observer/host from a per-row select, kick ✕, block 🚫, host transfer — the creator loses the moderator rights automatically); blocked users are listed in the panel and cannot be invited or re-join; service gains `transferHost()` (7 new i18n keys, page moderation spec) | ✅ Done |
| **Rooms (R7)** | Rooms Live private chats: the mock-AI summary was removed on request; each room member gets a ✉ Private chat button next to every other member, opening a 1-to-1 thread panel inside the room page (own bubble side, header "with {name}", empty state, small composer); threads persist per room pair (`roomlive_dms` storage, `RoomDm`/`RoomDmMessage` models, `sendDm`/`dmWith`/`listDms` service API, both users must be participants of an active room and a DM refuses empty text) (EN/FR, 4 new keys, service + page specs) | ✅ Done |
| **AI Assistant** | Replaces the /ai-assistant placeholder with a real chat interface: welcome state with 4 clickable suggestion chips, message feed with typing indicator and auto-scroll, pill composer (Enter or Send), monthly quota badge + banner (1,000 queries, persisted in `safeStorage`); `AssistantService` mock returns deterministic EN/FR keyword answers (unpaid invoices, stock, revenue, clients, payments), invoice extraction when an `FA-YYYY-NNN` number is detected, generic fallback and quota-exceeded replies; answers are i18n keys (never raw text) under the new `assistant.*` subtree (EN/FR parity, 5 service + 2 page specs) | ✅ Done |
| **Trial mode** | Signup starts a 30-connection free trial without Stripe, automatic email OTP, trial banner, per-login usage tracking, trial-ended login block, subscribe from account status, Super Admin usage column; trial refresh tokens use `sessionStorage` so closing the browser logs out | ✅ Done |
| **W9–W10** | Payments console steps, cross-cutting UX, Arabic RTL | ⏳ Planned |

## 🛠️ Tech stack

- [Angular 21](https://angular.dev) (standalone components, signals, new control flow)
- TypeScript, RxJS
- [@jsverse/transloco](https://github.com/jsverse/transloco) (EN/FR i18n)
- [Chart.js](https://www.chartjs.org/) via ng2-charts, [PrimeIcons](https://primeng.org/icons)
- [jsPDF](https://github.com/parallax/jsPDF) + autotable (client-side PDF export)
- Spring Boot REST API + PostgreSQL (auth, signup, KYC, billing, HR, Support)
- Vitest for frontend unit tests, JUnit/Mockito for backend tests
- Next milestone: connect the remaining mock business modules to the REST API
