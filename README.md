# Kingdom Hospital System

Hospital management system for Kingdom Hospital, Nairobi. Built with Next.js 16, React 19, TypeScript and Tailwind CSS 4. Typeface is IBM Plex Sans, loaded locally so the app works offline and on hosts without font access.

## Modules

| Area | Pages |
| --- | --- |
| Overview | Dashboard with collections, ward occupancy, laboratory pipeline, alerts |
| Clinical | Emergency, departments, doctors (directory, schedules, holidays, visits, treatment history), patients (register, chart, payments, cases, symptoms, diagnosis, treatment, advice, documents), appointments (list and weekly calendar), prescriptions with print, dental with odontogram |
| Clinical tools | Patient summary, imaging review, treatment planning |
| Diagnostics and wards | Laboratory worklist, result entry with reference ranges, results analysis, printable report, test catalogue; bed board, admission register, bed inventory; ambulance |
| Pharmacy and stores | Pharmacy dashboard, point of sale, medicines, inventory |
| Finance | Invoice builder, invoice document, payments, service items, expenses, SHA claims, reports |
| Administration | Staff, nurses, attendance, communication templates, settings |

Connected workflows: invoices create laboratory requests and draft SHA claims, discharge creates an inpatient invoice, pharmacy sales reduce stock.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000. Production check: `npm run build && npm start`.

## Data layer status

The app ships with sample data (`lib/seed.ts`) and keeps changes in the browser through `lib/store.tsx`. There is no server database or sign in yet. `db/schema.sql` is the PostgreSQL schema for the real backend. To go live, replace the calls in `lib/store.tsx` (`add`, `update`, `remove`, `useCollection`) with server actions or API routes that read and write Postgres, and add authentication with role based access.

Dates use a fixed demonstration day (`ANCHOR` in `lib/format.ts`). Replace it with the current date when the database is connected.

## Hosting recommendation

* Host the app on Cloudflare Workers (OpenNext adapter) or Vercel. Vercel Hobby is for non commercial use only, so a hospital needs Vercel Pro. Cloudflare's free plan allows commercial use.
* Keep patient records in PostgreSQL (Neon or Supabase), not in a key value store. Billing, admissions and lab results need transactions and foreign keys. Cloudflare D1 is SQLite, capped at 10 GB per database, and fine for small tools but weaker for this workload.
* Turn on daily backups and point in time recovery before real patient data goes in. Patient data is sensitive personal data under the Kenya Data Protection Act, 2019. Register with the ODPC and check data location rules.

## Conventions

No emojis and no dashes in visible text. Currency is KES. Payment methods include M Pesa. Record numbers look like KH100124, invoices like INV1270, claims like SHA20260300.
