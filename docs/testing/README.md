# Backend and release testing

## Automated checks

GitHub Actions runs the frontend lint check, Next.js production build, and backend TypeScript compilation. The current codebase has an existing lint backlog (including explicit `any`, unescaped JSX punctuation, and React Compiler hook diagnostics). Those rules are warnings during cleanup so the production build can still execute; warnings remain visible in the job output and must be addressed incrementally.

The backend phase-specific scripts under `backend/src/*-test.ts` are not yet isolated behind a standard test runner. Some depend on Firebase and should not be run against production data. Do not add them to CI until their Firebase/payment/email dependencies are mocked and test records are isolated.

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

These external-service flows are not claimed as passed by CI until the required test environment and automated mocks are configured.
