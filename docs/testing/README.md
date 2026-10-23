# Backend and release testing

## Automated checks

GitHub Actions runs the frontend lint check, Next.js production build, and backend unit tests. The backend test command compiles TypeScript and runs isolated tests with Node's built-in test runner; it does not require Firebase, Razorpay, email credentials, or production data.

Current automated backend unit tests cover:
- Custom application error inheritance, messages, and HTTP status codes.
- Field-level validation error details.
- Standard success, created, error, paginated, and no-content response helpers.
- Role middleware: unauthenticated requests, missing role claims, role mismatch, permitted role, and doctor/admin allow-list behavior.
- Time utilities: strict 24-hour time parsing, invalid hour/minute rejection, zero-padded formatting, and midnight boundaries.
- Doctor identity resolution: trusted custom claim, configured single-clinic doctor ID, UID fallback, and missing user.
- Frontend booking safeguards: configured backend API URL, no fabricated availability fallback, reuse of an existing reservation when reopening checkout, and explicit checkout loading cleanup (covered by CI lint/build rather than isolated component tests).

The repository also contains older phase-specific scripts under `backend/src/*-test.ts`. They are not included in the automated suite because some depend on Firebase and external providers. Do not run them against production data.

## Release smoke-test plan

Run against a dedicated test project and provider test credentials only:

1. Health endpoint responds with HTTP 200.
2. Unauthenticated requests are rejected and patient/doctor/admin role boundaries are enforced.
3. Availability returns only published slots.
4. Two concurrent requests for the same doctor/date/time cannot both reserve the slot.
5. A pending appointment creates a test payment order using the server-calculated fee.
6. Invalid payment signatures are rejected; valid test payment verification confirms exactly one appointment.
7. Replayed webhooks are idempotent and cannot double-confirm or double-notify.
8. Confirmation email failure is observable/retriable and does not leave the UI spinning forever.
9. Doctor/admin dashboards read the same persisted appointment/payment state.
10. Refund, cancelled checkout, and abandoned reservation cleanup paths behave correctly.

The latest complete CI run on branch head `22de871c8aa84676261fc3426f22297056f11a54` passed frontend lint, the Next.js production build, backend TypeScript compilation, and **54 backend unit tests (54 passed, 0 failed)**. Frontend lint currently reports 143 warnings and zero errors. Firebase, payment, email, availability-concurrency, and dashboard integration flows are not claimed as passed by isolated unit tests; they require dedicated test configuration and further mocking/test setup.

See [Overall Test Report](./OVERALL-TEST-REPORT.md) for the tracked status, exit criteria, and prioritized next steps. The next workstream is appointment/availability integration, followed by payment/webhook integration, email/outbox, and dashboard consistency. Do not rerun existing helper tests without a specific uncovered case or defect.
