# ERP SaaS MVP — Angular Frontend Demo

A multi-tenant ERP SaaS **front-end MVP** built with **Angular 21** (standalone components + signals).
The whole application runs on a fully functional **in-memory mock data layer** that simulates the
future **Spring Boot REST API** (simulated latency, pagination, error codes) — so every feature below
is demo-able end to end in the browser, with no backend to install.

> This is a demo / MVP. Authentication is mocked, and all data lives in memory: a page refresh
> resets the demo dataset. In production the Spring Boot backend must enforce authentication,
> authorization and tenant isolation.

---

## ✨ What the demo includes

| Area | Features |
| --- | --- |
| **Auth & onboarding** | Landing page, signup wizard with plan selection, demo login (8 one-click accounts), role-based redirects, 404 page |
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

Prerequisites: **Node.js 20+** and npm.

```bash
cd ERP
npm install
npm start          # ng serve  →  http://localhost:4200
```

Other useful scripts:

```bash
npm run build          # production build into dist/
npm run watch          # incremental dev build
npm test               # vitest (watch mode)
npx ng test --watch=false   # CI-style single run
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
| **W4–W10** | Advanced stock, accounting, invoicing compliance, payments, BI dashboards, cross-cutting UX, Arabic RTL | ⏳ Planned |

## 🛠️ Tech stack

- [Angular 21](https://angular.dev) (standalone components, signals, new control flow)
- TypeScript, RxJS
- [@jsverse/transloco](https://github.com/jsverse/transloco) (EN/FR i18n)
- [Chart.js](https://www.chartjs.org/) via ng2-charts, [PrimeIcons](https://primeng.org/icons)
- [jsPDF](https://github.com/parallax/jsPDF) + autotable (client-side PDF export)
- Vitest for unit tests, Playwright for scripted smoke checks
- Next milestone: Spring Boot REST API + PostgreSQL to replace the mock layer
