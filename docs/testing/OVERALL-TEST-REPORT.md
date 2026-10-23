# Overall Test Report

**Project:** Doctor Portfolio, Appointment Booking System and Patient CRM  
**Branch:** `chore/ci-and-repo-hardening`  
**Pull request:** [#1](https://github.com/Hari-prasaath135/Doctor-Portfolio-Appointment-Booking-System-and-Patient-CRM-/pull/1)  
**Purpose:** Test, debug, and harden the application only. No deployment or production changes are part of this work.

## Executive summary

The automated CI baseline passed on commit `9eb073fb3f33f96f022bdee32b63e71c6c572d59`: frontend lint and Next.js production compilation passed, and backend TypeScript compilation plus **26 unit tests passed**. After that run, seven appointment-access unit tests and additional authorization, slot lifecycle, payment reconciliation, and notification-ownership fixes were added.

**The latest changes must be considered pending verification until CI completes for the current branch head.** A successful earlier run is not evidence that later edits passed.

## CI evidence

| Check | Latest confirmed result | Evidence / scope |
|---|---|---|
| Frontend ESLint | PASS on commit `9eb073f` | 0 errors, 143 warnings |
| Next.js production build and TypeScript check | PASS on commit `9eb073f` | All configured app routes compiled |
| Backend TypeScript build | PASS on commit `9eb073f` | Included in backend test job |
| Backend unit tests | PASS on commit `9eb073f` | 26 passed, 0 failed |
| New appointment-access unit tests | Added after that run | 7 cases; current-head CI required |
| Latest backend/frontend changes | PENDING current-head CI | [GitHub Actions](https://github.com/Hari-prasaath135/Doctor-Portfolio-Appointment-Booking-System-and-Patient-CRM-/actions) |

The 143 frontend lint warnings are non-blocking under the current configuration but remain cleanup work. A green build does not prove runtime integrations work.

## Changes made for correctness

1. **Record-level authorization:** centralized appointment access rules; patients must own the appointment, doctors must match the canonical doctor identity, admins may access records, and unknown roles fail closed for record lookups.
2. **Payment data privacy:** payment-status and payment-by-appointment lookups now validate access against the associated appointment before returning payment data.
3. **Notification privacy:** marking a notification as read checks the authenticated user owns it.
4. **Cancellation notification recipient:** cancellation notification is sent to the patient rather than to the user who initiated the cancellation.
5. **Slot release correctness:** cancellation resets slot status and clears stale reservation metadata, not just the legacy `isBooked` flag.
6. **Rescheduling correctness:** old and new slots are updated safely when rescheduling within the same availability document; target schedules must be published and not leave schedules.
7. **Reservation expiry and late payments:** new bookings can claim an expired reservation and cancel its stale unpaid appointment; payment confirmation refuses to overwrite a slot reassigned to another appointment.
8. **Frontend resilience:** removed hardcoded local backend URLs from key booking/auth/dashboard flows, added availability retry UI, avoided fabricated availability fallback, reused existing appointment reservations when reopening checkout, and ensured checkout loading flags are cleared.

These are code-review findings and fixes; items 1–7 require the latest CI run and targeted integration tests before being considered fully verified at runtime.

## Automated unit-test coverage

The backend Node test suite currently contains the following groups:

- Application errors and HTTP response helpers.
- Authentication role middleware.
- Strict 24-hour time parsing and formatting.
- Doctor identity resolution.
- Appointment record access: owning patient, foreign patient denied, assigned doctor, mismatched doctor denied, administrator, unknown role denied, missing authentication denied.

The previous successful run executed 26 tests before the seven appointment-access tests were added. Expected total after the added suite is **33 unit tests**, subject to current-head CI confirmation.

## End-to-end and integration tests still required

These have **not** been proven by the isolated unit tests or build checks. Run them only in a dedicated test environment with test accounts, test payment credentials, and non-production data.

| Area | Required scenarios | Status |
|---|---|---|
| Authentication and roles | Invalid/expired token; patient, doctor, and admin access boundaries | Partially covered by unit tests; integration pending |
| Availability | Published/unpublished dates; slot blocked; expired reservation; simultaneous booking attempts | Integration pending |
| Appointment lifecycle | Reserve, pay, cancel, reschedule across dates and within same date; released slot becomes available | Integration pending |
| Razorpay | Test order amount from server, invalid signature rejected, valid test payment, repeated verification, webhook replay/idempotency | Integration pending |
| Email | Correct recipient, valid SMTP test delivery, missing credentials, transient SMTP failure, outbox retry, no stuck checkout UI | Integration pending |
| Dashboard consistency | Booking/payment/cancel/reschedule appears consistently in doctor and admin views after refresh | Integration pending |
| Notification ownership | User cannot mark another user's notification as read | Code fix added; integration pending |
| Admin portal | Admin role can load insights and enquiries; non-admin denied; Firestore listener errors are visible | Integration pending |
| Refunds and expiry | Refund status, cancelled checkout, expired hold cleanup, late payment reconciliation | Integration pending |

## Known limitations and release criteria

- The current CI is build/unit-test automation, not a full browser or service integration suite.
- Firebase, Razorpay, and SMTP integrations have not been exercised by CI with dedicated test credentials.
- Dashboard consistency is not yet proven by a test that creates a booking and verifies the same persisted record through both dashboards.
- Frontend lint still reports warnings even though it passes.
- Do not call the application fully verified until current-head CI passes and the critical appointment/payment/email integration scenarios above are exercised.

## Current decision

**Testing only — no deployment, no merge, and no production changes.** Keep all fixes on `chore/ci-and-repo-hardening` and keep PR #1 open until the test report's pending checks are resolved.
