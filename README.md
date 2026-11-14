# Kingdom Faith Based Hospital System

Hospital management system for Kingdom Faith Based Hospital, Webuye. Next.js 16, React 19, TypeScript, Tailwind CSS 4, IBM Plex Sans (bundled locally).

| Area | Pages |
| --- | --- |
| Overview | Dashboard with collections, ward occupancy, laboratory pipeline, alerts |
| Clinical | Emergency, departments, doctors, patients (register, chart, payments, cases, catalogues, documents), appointments with calendar, prescriptions, dental with odontogram, clinical tools |
| Diagnostics and wards | Laboratory worklist, result entry with reference ranges, analysis, printable report; bed board, admissions; ambulance |
| Pharmacy and stores | Pharmacy dashboard, point of sale, medicines, inventory |
| Finance | Invoice builder and document, payments, expenses, SHA claims, reports |
| Administration | Staff accounts, human resources, communications, settings |

Connected workflows: an invoice creates its lab requests and a draft SHA claim, discharge creates the inpatient invoice, a pharmacy sale reduces stock.

## How it runs

* **App:** Next.js on Cloudflare Workers through the OpenNext adapter.
* **Data:** Neon Postgres, database `kingdom_hospital`, role `kingdom_app`. Each record type is a table of JSON documents (`db/schema.sql`). Numbers that must never repeat (patient record numbers, invoice numbers, SHA claim numbers), one active admission per bed and patient, and non negative stock are enforced by the database.
* **Sign in:** staff accounts in `app_users`, passwords hashed with bcrypt inside Postgres, signed 12 hour session cookie, five failed attempts lock an email for 15 minutes. Two roles: `admin` (settings, catalogues, staff accounts, deletions) and `staff`.
* **API:** `/api/data` loads everything for the signed in user, `/api/records/*` creates, updates and deletes, `/api/actions/*` runs workflows that need several changes at once (invoice, payment, admit, transfer, discharge, pharmacy sale). Invoices and payments can only change through those workflows. Every change is written to `audit_log` with the user's email.

## Local development

```bash
npm install
```

```bash
cp .env.example .env.local
```

Fill in `DATABASE_URL` and `AUTH_SECRET`, then:

```bash
npm run dev
```

## Database tasks

```bash
npm run db:apply
```

Creates or updates the tables. Safe to run again.

```bash
npm run db:seed
```

Loads sample patients, invoices and so on. Add `-- --force` to wipe and reload.

```bash
npm run db:admin
```

Creates the first administrator and prints a one time password. Add `-- you@example.com --reset` to set a new password for an existing account.

```bash
npm run db:clear -- --yes
```

Deletes every patient and other record, keeps staff accounts. Run this before real use.

## Deploy to Cloudflare

```bash
npm run cf:deploy
```

Needs `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` in the environment. Set the two secrets once with `npx wrangler secret put DATABASE_URL` and `npx wrangler secret put AUTH_SECRET`.

`scripts/cf-build.mjs` embeds the static files in the worker so no separate assets upload is needed. The worker is about 2 MiB compressed, inside the 3 MiB free plan limit.

## Before real patients

1. Run `npm run db:clear -- --yes` to remove the sample data.
2. Move the database to its own Neon project that is not shared with another app, then update the `DATABASE_URL` secret. Neon projects created through the Vercel integration cannot be created from the API, so create it at neon.com.
3. Add backups. Neon's free plan restores to any point in the last day only. Export the data on a schedule and keep copies elsewhere.
4. Change the administrator password, create one account per person, and review who needs access to which records.
5. Register with the Office of the Data Protection Commissioner and check data location rules. Patient data is sensitive personal data under the Kenya Data Protection Act, 2019.

## Free plan limits to know

Cloudflare Workers free: 100,000 requests a day and 10 ms of CPU per request. Neon free: compute sleeps after 5 minutes idle so the first request after a quiet period is slower, 100 compute hours a month per project, 1 GB storage per project.

## Brand

The logo is `public/logo.svg` (full), `public/logo-mark.svg` (eye only), `public/logo.png` (transparent) and `app/icon.svg` (favicon). It was redrawn from a photo of the letterhead, so it is close but not the original artwork. Drop the original file over `public/logo.svg` to replace it everywhere. Colours follow the logo: azure `#2a6fae` for actions, the brick red stays inside the logo. All colours live in `app/globals.css`.

Hospital name, address, phone and email are in Settings. KRA PIN, facility code, M Pesa Paybill and bank details start empty and print on invoices only once filled in.

## Conventions

No emojis and no dashes in visible text. Currency is KES. Dates and "today" use Nairobi time. Record numbers look like KH100124, invoices like INV1270, claims like SHA20260300.
