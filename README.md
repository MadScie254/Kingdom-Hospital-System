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

Connected workflows: an invoice creates its lab requests, discharge creates the inpatient invoice, a pharmacy sale reduces stock. SHA claims are not made from invoices: they start from a real SHA visit (see SHA and the DHA Health Information Exchange).

## How it runs

* **App:** Next.js on Cloudflare Workers through the OpenNext adapter.
* **Data:** Neon Postgres, database `kingdom_hospital`, role `kingdom_app`. Each record type is a table of JSON documents (`db/schema.sql`). Numbers that must never repeat (patient record numbers, invoice numbers, SHA claim numbers), one active admission per bed and patient, and non negative stock are enforced by the database.
* **Sign in:** staff accounts in `app_users`, passwords hashed with bcrypt inside Postgres, signed 12 hour session cookie, five failed attempts lock an email for 15 minutes. Accounts made by an administrator start with a temporary password that must be replaced at first sign in.
* **API:** `/api/data` loads everything for the signed in user, `/api/records/*` creates, updates and deletes, `/api/actions/*` runs workflows that need several changes at once (invoice, payment, admit, transfer, discharge, pharmacy sale), `/api/hie/*` talks to SHA. Invoices, payments and SHA claims can only change through those workflows. Every change is written to `audit_log` with the user's email.

## Staff, roles and departments

Anyone can ask for access at `/signup` with their own email, position, licence number and departments. They do not choose a password. The request stays pending and the person cannot sign in. The administrator opens **Staff accounts**, confirms the role, adjusts the departments and approves or declines. On approval the system makes a temporary password and emails it to the person, who signs in with it and must choose their own straight away. A declined person is told by email. The bell and the dashboard show how many requests are waiting. Public signup is limited to five requests an hour per connection, and the administrator's approval is the safeguard.

Roles: `admin`, `doctor`, `nurse`, `lab`, `pharmacy`, `reception`, `accounts`, `staff`. Access follows the role, not the department. `lib/access.ts` lists which screens, record types and workflows each role may use, and Staff accounts shows the same rules as a table. The server enforces it: a role is never sent the records it may not read, and its writes are refused. The screens and the phone tab bar hide what a role cannot use. Changing a role or switching an account off takes effect on that person's next action.

| Role | Can use |
| --- | --- |
| Administrator | Everything, including staff accounts, settings and email |
| Doctor, nurse | Patients, consultations, appointments, emergency, dental, laboratory requests, wards, prescriptions (doctors write them). They can check a patient's SHA cover from the patient record. No invoices, payments, expenses or SHA claims |
| Front desk | Registering patients, appointments, admissions desk, invoices, recording payments, SHA claims. No clinical notes |
| Accounts | Invoices, payments, expenses, SHA claims, reports. No patient clinical records |
| Laboratory | Laboratory worklist, results and test catalogue |
| Pharmacy | Medicines, point of sale, prescriptions, inventory |
| General staff | Sign in only |

## Email

Email goes out through a small Google Apps Script web app that belongs to the hospital Gmail account, so it is free and needs no domain. Settings, Email has the steps, a script to copy and an access code generator. The relay address, the access code and the alert addresses are stored in the `app_config` table, never in the code or in Worker secrets. The access code is never sent back to the browser.

* Alerts go to the alert addresses (or to every administrator when none are set): a new access request, and a failed nightly backup.
* The person you approve, or an account you add, receives a temporary password. If email is not set up or the relay fails, the administrator is shown the password once so it can be passed on by hand.
* `/forgot` emails a one hour reset link. A link works once, the token is stored hashed, and the answer is the same whether or not the account exists. At most 3 links an hour per account.
* Every message is listed in Settings, Email with its result. The log never holds message text, so temporary passwords are not kept.

Only `https://script.google.com/macros/s/.../exec` addresses are accepted. Set `APP_ORIGIN` to pin the address used in email links (`wrangler.jsonc` does this for the hosted site). Free Gmail allows about 100 recipients a day through Apps Script.

## SHA and the DHA Health Information Exchange

The SHA screen is a client of the Digital Health Agency (DHA) Health Information Exchange middleware, documented at https://hie-docs.dha.go.ke/. Nothing on it is typed in by hand: eligibility, consent, visits, preauthorisations and every claim status come from SHA's answers (and from its status callbacks). There are no buttons that mark a claim approved or paid.

What it covers, in the order the DHA integration team checks in the UAT demo:

| UAT scenario | Where in the system |
| --- | --- |
| Client registry lookup by SHA number (Client Registry ID), National ID and the other ID types, then eligibility with each scheme and the reason and fix when cover is not active | SHA, Eligibility and new visit. Also Check SHA cover on a patient record, for doctors and nurses |
| Benefits, sub benefits and interventions with the SHA tariff for the hospital's level, and the preauthorisation each one needs | The service step of a new visit |
| PHC Fund capitation visit; add, retire, restore and switch services | New visit, then the claim page |
| SHIF outpatient and inpatient visits, paid per service or per day | New visit, then the claim page |
| Consent by one time code (contacts, send code, enter code), also for the discharge | Wherever consent is needed |
| Normal preauthorisation, and the surgical, oncology, renal, imaging and optical forms, resend doctor request, cancel | Claim page, Preauthorisation |
| Planned (elective) services: consent first, preauthorisation, start the visit on the day on the same claim | New visit, then the claim page |
| Billing with ICD-11 diagnoses and documents, price checked against the tariff, billing closed until a preauthorisation is approved | Claim page, Billing |
| Submit an outpatient or capitation claim, discharge an inpatient (which sends it), close a claim without billing | Claim page |
| ECCIF emergency claims, patient identified or not, approved protocols, treating doctor, 24 hour clock, identify later | SHA, Emergency |
| Facility registry (MFL and FR code), health worker register, client registry ID kept on the patient | Settings, Doctors, Patients |

How it is built:

* `lib/hie` is a plain TypeScript client with no framework imports: OAuth client credentials token with caching and refresh, the facility headers `X-Facility-Id` and `X-Facility-Id-Type`, retries with back off for reads and rate limits (never for a write whose outcome is unclear), and one error type that carries SHA's own message (plain `{ "error": ... }` bodies and FHIR OperationOutcome). `lib/hie/rules.ts` decides which flow a service belongs to from the flags SHA returns.
* `lib/server/hie` holds the actions and `app/api/hie/[action]` is the single route. The route checks the role first (`HIE_ROLES` in `lib/access.ts`).
* `app/api/hie/callback/[secret]` receives SHA's status updates.
* `components/sha` and `app/(app)/sha` are the screens.

Credentials and tokens:

* The client id, client secret and address are read only from Worker secrets (`DHA_CLIENT_ID`, `DHA_CLIENT_SECRET`, `DHA_BASE_URL`). They are never stored in the database or sent to the browser.
* SHA's consent token for each visit is kept in `hie_consents`, a table no screen reads. The browser only ever sees the claim's own id.
* `hie_log` keeps one row per request to SHA (who, path, answer code, time) as evidence for certification. It never keeps query values, names, ID numbers, one time codes or tokens. Settings, SHA connection shows the latest rows.

Setting it up:

1. Register the hospital and this system at https://developer.dha.go.ke/register and ask for UAT credentials. Book the UAT demo with the DHA integration team when the checks below pass.
2. Add the tables: `npm run db:apply`. It creates `hie_consents`, `hie_log` and `hie_events` and is safe to run again.
3. Store the credentials as Worker secrets, then deploy:

```bash
npx wrangler secret put DHA_BASE_URL
```

```bash
npx wrangler secret put DHA_CLIENT_ID
```

```bash
npx wrangler secret put DHA_CLIENT_SECRET
```

4. In Settings, SHA connection enter the MFL code (112007 for Kingdom Faith Based Hospital), press Fill from SHA registry to get the FR code and facility level, press Save settings, then Test connection. Every step must pass.
5. On Doctors, give each doctor the registration number and regulator exactly as on the register. An administrator can check one against the SHA register with the badge button on the row.
6. Optional settings, all secrets or variables on the worker: `DHA_FACILITY_HEADERS=off` if DHA issues credentials that already carry the facility, `DHA_ICD11_SOURCE` (the ICD-11 source id in the DHA terminology service, which turns on ICD-11 name search; codes can always be typed), `DHA_TERMINOLOGY_OWNER` and `DHA_INTERVENTIONS_SOURCE` (default `ORG-00002` and `BenefitsAndInterventions`).
7. Status updates: set `DHA_CALLBACK_SECRET` to a long random string and ask DHA to register `https://YOUR-ADDRESS/api/hie/callback/THE-SECRET` for claim, preauthorisation and authorization events. Duplicates are ignored. Without it, press Refresh from SHA on a claim to read its latest state.

Testing without DHA:

```bash
npm run mock:hie
```

starts a local stand in for the UAT API on port 4600. Run the app with `DHA_BASE_URL=http://localhost:4600/api/v1`, `DHA_CLIENT_ID=mock-client`, `DHA_CLIENT_SECRET=mock-secret` and facility `FID-112007`. In the mock National ID 33333333 is an eligible member, 44444444 owes contributions, the visit code is 123456 and the discharge code is 654321. Preauthorisations are approved on the second check and claims move through review, approved and paid as you refresh. `npm test` runs the client against a faked network.

What is not covered yet: consent by fingerprint (a facility that SHA marks as biometrics enforced cannot start visits here), resubmitting a claim that SHA sent back, and the FHIR eClaims bundles (the REST middleware is used instead). ICD-11 codes are never worked out from ICD-10. They are typed, searched in the terminology service when `DHA_ICD11_SOURCE` is set, or taken from the hospital's own diagnosis list, where a code is saved once a search result matches a diagnosis name exactly.

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

Fill in `DATABASE_URL` and `AUTH_SECRET` (and `CRON_SECRET` if you call the backup endpoint yourself), then:

```bash
npm run dev
```

Checks that run on every pull request:

```bash
npm run typecheck && npm test && npm run build
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

Needs `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` in the environment. Set the secrets once with `npx wrangler secret put DATABASE_URL`, `npx wrangler secret put AUTH_SECRET` and `npx wrangler secret put CRON_SECRET`, and the three `DHA_` secrets described above when SHA credentials arrive.

`scripts/cf-build.mjs` embeds the static files in the worker so no separate assets upload is needed. The worker is about 2 MiB compressed, inside the 3 MiB free plan limit.

## Before real patients

1. Run `npm run db:clear -- --yes` to remove the sample data. This also removes any SHA claims, so do it before the first real SHA visit.
2. Move the database to its own Neon project that is not shared with another app, then update the `DATABASE_URL` secret. Neon projects created through the Vercel integration cannot be created from the API, so create it at neon.com.
3. Nightly backups run, but they live in the same Cloudflare account. Keep an occasional copy elsewhere with Settings, Export all data. Neon's free plan also restores to any point in the last day only.
4. Change the administrator password, create one account per person, and review who needs access to which records.
5. Register with the Office of the Data Protection Commissioner and check data location rules. Patient data is sensitive personal data under the Kenya Data Protection Act, 2019.

## Free plan limits to know

Cloudflare Workers free: 100,000 requests a day and 10 ms of CPU per request. Neon free: compute sleeps after 5 minutes idle so the first request after a quiet period is slower, 100 compute hours a month per project, 1 GB storage per project.

## Brand

The logo is `public/logo.svg` (full), `public/logo-mark.svg` (eye only), `public/logo.png` (transparent) and `app/icon.svg` (favicon). It was redrawn from a photo of the letterhead, so it is close but not the original artwork. Drop the original file over `public/logo.svg` to replace it everywhere. Colours follow the logo: azure `#2a6fae` for actions, the brick red stays inside the logo. All colours live in `app/globals.css`.

Hospital name, address, phone and email are in Settings, and so are the MFL code, FR code and facility level that SHA needs. KRA PIN, M Pesa Paybill and bank details start empty and print on invoices only once filled in.

## Conventions

No emojis and no dashes in visible text. Currency is KES. Dates and "today" use Nairobi time. Record numbers look like KH100124, invoices like INV1270, claims like SHA20260300.
