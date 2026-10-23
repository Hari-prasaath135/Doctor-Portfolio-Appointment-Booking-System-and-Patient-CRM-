# Dr. Vijay Clinic — Doctor Portfolio, Appointments & Patient CRM

A Next.js doctor portfolio and appointment-booking experience with an Express/TypeScript API. The project includes Firebase integrations, Razorpay payment handling, appointment availability, notifications, video consultation endpoints, and admin/doctor dashboards.

## Repository layout

```text
.
├── src/                     # Next.js App Router pages, API routes, components, and client libraries
├── public/                  # Static assets
├── backend/
│   ├── src/
│   │   ├── config/          # Firebase and payment provider setup
│   │   ├── controllers/     # HTTP request handlers
│   │   ├── middleware/      # Authentication, roles, and validation
│   │   ├── routes/          # Express route registration
│   │   ├── services/        # Application/business logic
│   │   ├── types/           # Shared backend types
│   │   └── utils/           # Errors, logging, and response helpers
│   ├── .env.example         # Environment variable reference (no real secrets)
│   └── package.json
├── .github/workflows/       # Automated CI checks
├── firestore.rules
├── storage.rules
└── package.json
```

## Requirements

- Node.js 22.x (CI uses Node.js 22)
- npm
- Firebase project credentials for live backend functionality
- Provider credentials for payment, email, and video features when exercising those integrations

## Local development

### Frontend

From the repository root:

```bash
npm ci
npm run dev
```

Open http://localhost:3000.

### Backend

```bash
cd backend
npm ci
cp .env.example .env
# Fill in credentials locally; do not commit .env or service-account files.
npm run dev
```

The API health endpoint is `GET http://localhost:5000/api/v1/health`.

Build the frontend with `npm run build` from the root and compile the backend with `npm run build` from `backend/`.

## Continuous integration

GitHub Actions runs the following checks for pushes to `main` and maintenance branches, and for pull requests targeting `main`:

1. Install frontend dependencies with `npm ci`.
2. Run ESLint.
3. Build the Next.js production application.
4. Install backend dependencies with `npm ci`.
5. Compile the backend TypeScript.

The CI build uses placeholders only where configuration is needed to compile. It does not connect to Firebase, Razorpay, email, Zoom, or other external services, and therefore is not a substitute for credentialed end-to-end testing.

## Integration testing checklist

Before release, verify these flows in a configured test environment:

- Patient sign-in and role-based access to patient, doctor, and admin views.
- Availability lookup, booking validation, and duplicate-slot rejection.
- Payment order creation, test-mode payment, signature/webhook verification, and persisted payment status.
- Successful payment confirmation, appointment status updates, and email delivery.
- Refund handling and failed/cancelled payment paths.
- Video consultation link creation and correct appointment time association.
- Admin/doctor dashboards reflect the same persisted appointment and payment state.
- Invalid/expired authentication, unauthorized roles, provider failures, and retry/idempotency behavior.

Use test credentials and test patient data only. Never commit production credentials, service-account JSON files, API keys, webhook secrets, or patient data.

## Important implementation note

Some frontend API routes currently contain in-memory demo data. In-memory records reset when the server restarts and are not shared across instances. Confirm that production booking and dashboard flows use the persistent backend before deploying for real patients.

## Frontend API configuration

The booking wizard calls the Express backend through `NEXT_PUBLIC_API_BASE_URL`. Copy the root `.env.example` to `.env.local` for local configuration. For local development, the API helper defaults to `http://localhost:5000/api/v1`; for production, configure the deployed HTTPS backend base URL including `/api/v1` before running `next build` or deploying. Next.js embeds `NEXT_PUBLIC_*` values into the browser bundle at build time, so changing this value requires a rebuild. Never place private credentials in a `NEXT_PUBLIC_*` variable.

## Backend identity and email delivery

For this single-doctor deployment, configure `DOCTOR_ID=dr-vijay-main` in the backend environment so the doctor's authenticated account maps to the same ID used by availability schedules. A verified Firebase custom claim named `doctorId` takes precedence when configured. Doctor appointment reads and schedule changes are scoped to this resolved identity.

Appointment confirmation emails use Nodemailer with Gmail SMTP. Configure `EMAIL_USER`, a Gmail App Password in `EMAIL_PASSWORD`, and `EMAIL_FROM` / `EMAIL_FROM_NAME` using the backend `.env.example`. Missing credentials or send failures are recorded as outbox failures and retried; the UI must not claim that an email was delivered merely because payment succeeded.
