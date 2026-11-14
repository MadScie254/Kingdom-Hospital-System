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
* **Sign in:** staff accounts in `app_users`, passwords hashed with bcrypt inside Postgres, signed 12 hour session cookie, five failed attempts lock an email for 15 minutes. Accounts made by an administrator start with a temporary password that must be replaced at first sign in.
* **API:** `/api/data` loads everything for the signed in user, `/api/records/*` creates, updates and deletes, `/api/actions/*` runs workflows that need several changes at once (invoice, payment, admit, transfer, discharge, pharmacy sale). Invoices and payments can only change through those workflows. Every change is written to `audit_log` with the user's email.

## Staff, roles and departments

Anyone can ask for access at `/signup` with their own email, position, licence number and departments. The request stays pending and the person cannot sign in. The administrator opens **Staff accounts**, confirms the role, adjusts the departments and approves or declines. The bell and the dashboard show how many requests are waiting. Public signup is limited to five requests an hour per connection, and email addresses are not verified by link, so the administrator's approval is the safeguard.

Roles: `admin`, `doctor`, `nurse`, `lab`, `pharmacy`, `reception`, `accounts`, `staff`. `lib/access.ts` lists which screens, record types and workflows each role may use. The server enforces it, and the screens and the phone tab bar hide what a role cannot use. Changing a role or switching an account off takes effect on that person's next action.

## Backups

A Cloudflare cron trigger runs `/api/backup` every night at 21:00 UTC, which is midnight in Nairobi. It copies every table into Cloudflare KV (`BACKUPS`) and keeps each copy for 35 days. Settings, Backups shows the history and has a Back up now button. The worker also leaves `cron/last-run`, `cron/last-result` and `cron/last-error` in KV so a failed run can be found.

To see what a backup holds, or restore one:

```bash
CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ACCOUNT_ID=... KV_NAMESPACE_ID=... DATABASE_URL=... npx tsx scripts/restore.ts 2026-11-15
```

Add `--yes` to replace the database with that backup. The backup holds password hashes and patient data, so treat access to the Cloudflare account like access to the records.

## On phones

The app works in any phone browser and can be added to the home screen (it ships a manifest, icons and a service worker that caches nothing). On a phone a tab bar replaces the side menu, and inputs are sized so iPhones do not zoom.

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

Creates an administrator and prints a temporary password. Pass the email first, then optionally `"--name=Full Name"`. Add `--reset` to set a new temporary password for an existing account. The person must choose their own at first sign in.

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
3. Nightly backups run, but they live in the same Cloudflare account. Keep an occasional copy elsewhere with Settings, Export all data. Neon's free plan also restores to any point in the last day only.
4. Change the administrator password, create one account per person, and review who needs access to which records.
5. Register with the Office of the Data Protection Commissioner and check data location rules. Patient data is sensitive personal data under the Kenya Data Protection Act, 2019.

## Free plan limits to know

Cloudflare Workers free: 100,000 requests a day and 10 ms of CPU per request. Neon free: compute sleeps after 5 minutes idle so the first request after a quiet period is slower, 100 compute hours a month per project, 1 GB storage per project.

## Brand

The logo is `public/logo.svg` (full), `public/logo-mark.svg` (eye only), `public/logo.png` (transparent) and `app/icon.svg` (favicon). It was redrawn from a photo of the letterhead, so it is close but not the original artwork. Drop the original file over `public/logo.svg` to replace it everywhere. Colours follow the logo: azure `#2a6fae` for actions, the brick red stays inside the logo. All colours live in `app/globals.css`.

Hospital name, address, phone and email are in Settings. KRA PIN, facility code, M Pesa Paybill and bank details start empty and print on invoices only once filled in.

## Conventions

No emojis and no dashes in visible text. Currency is KES. Dates and "today" use Nairobi time. Record numbers look like KH100124, invoices like INV1270, claims like SHA20260300.
