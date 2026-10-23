# Overall Test Report

**Project:** Doctor Portfolio, Appointment Booking System and Patient CRM  
**Branch:** `chore/ci-and-repo-hardening`  
**Pull request:** [#1](https://github.com/Hari-prasaath135/Doctor-Portfolio-Appointment-Booking-System-and-Patient-CRM-/pull/1)  
**Purpose:** Test, debug, and harden the application only. No deployment or production changes are part of this work.

## Executive summary

On code commit `a66346fceafaf7e229ff9b1a35ce910a8936efa3`, the latest complete CI run passed: frontend lint, Next.js production build, backend TypeScript build, and **45 backend unit tests passed with 0 failures**. The report-only update that follows will trigger a fresh CI run for the final documentation commit.

**Runtime integrations are not fully verified.** A successful build/unit suite does not prove Firebase, Razorpay, SMTP, or dashboard flows work end to end.

## CI evidence

| Check | Latest confirmed result | Evidence / scope |
|---|---|---|
| Frontend ESLint | PASS on commit `a66346f` | 0 lint errors; warnings remain |
| Next.js production build and TypeScript check | PASS on commit `a66346f` | All configured app routes compiled |
| Backend TypeScript build | PASS on commit `a66346f` | Included in backend test job |
| Backend unit tests | PASS on commit `a66346f` | 45 passed, 0 failed |
| Latest complete CI | PASS | [GitHub Actions run](https://github.com/Hari-prasaath135/Doctor-Portfolio-Appointment-Booking-System-and-Patient-CRM-/actions/runs/39910210336) |
| Firebase/payment/email/dashboard integration | NOT RUN | Requires a dedicated test environment; see matrix below |

The 143 frontend lint warnings are non-blocking under the current configuration but remain cleanup work. A green build does not prove runtime integrations work.

## Changes made for correctness

1. **Record-level authorization:** centralized appointment access rules; patients must own the appointment, doctors must match the canonical doctor identity, admins may access records, and unknown roles fail closed for record lookups.
2. **Payment data privacy:** payment-status and payment-by-appointment lookups now validate access against the associated appointment before returning payment data.
3. **Notification privacy:** marking a notification as read checks the authenticated user owns it.
4. **Cancellation notification recipient:** cancellation notification is sent to the patient rather than to the user who initiated the cancellation.
5. **Slot release correctness:** cancellation resets slot status and clears stale reservation metadata, not just the legacy `isBooked` flag.
6. **Rescheduling correctness:** old and new slots are updated safely when rescheduling within the same availability document; target schedules must be published and not leave schedules.
7. **Reservation expiry and late payments:** new bookings can claim an expired reservation and cancel its stale unpaid appointment; payment confirmation refuses to overwrite a slot reassigned to another appointment.
8. **Payment signature safety:** Razorpay checkout and webhook HMACs use constant-time hexadecimal comparison and reject malformed signatures.
9. **Webhook reliability:** event claims use a Firestore transaction, active processing leases prevent concurrent duplicate work, failed/expired events can be retried, and completed events are deduplicated. Captured webhook amount/currency mismatches are routed to reconciliation instead of confirming appointments.
10. **Checkout idempotency:** a previously confirmed appointment no longer bypasses order/signature/provider verification when the checkout verification endpoint is called again.
11. **Appointment status privacy:** status reads enforce the same patient/doctor/admin access rules as appointment record reads.
12. **Frontend resilience:** removed hardcoded local backend URLs from key booking/auth/dashboard flows, added availability retry UI, avoided fabricated availability fallback, reused existing appointment reservations when reopening checkout, and ensured checkout loading flags are cleared.

These code changes compile and the automated suite passes on commit `a66346f`. End-to-end integration behavior still requires dedicated test credentials/data.

## Automated unit-test coverage

The backend Node test suite currently contains the following groups:

- Application errors and HTTP response helpers.
- Authentication role middleware.
- Strict 24-hour time parsing and formatting.
- Doctor identity resolution.
- Appointment record access: owning patient, foreign patient denied, assigned doctor, mismatched doctor denied, administrator, unknown role denied, missing authentication denied.

The latest backend CI run executed **45 unit tests: 45 passed, 0 failed**. Added coverage includes constant-time signature comparison (matching, mismatched, malformed, empty, and real HMAC digests) and webhook claim decisions (completed-event deduplication, active lease, expired lease, failed-event retry, first processing, and invalid lease values).

## End-to-end and integration tests still required

These have **not** been proven by the isolated unit tests or build checks. Run them only in a dedicated test environment with test accounts, test payment credentials, and non-production data.

| Area | Required scenarios | Status |
|---|---|---|
| Authentication and roles | Invalid/expired token; patient, doctor, and admin access boundaries | Partially covered by unit tests; integration pending |
| Availability | Published/unpublished dates; slot blocked; expired reservation; simultaneous booking attempts | Integration pending |
| Appointment lifecycle | Reserve, pay, cancel, reschedule across dates and within same date; released slot becomes available | Integration pending |
| Razorpay | Test order amount from server, invalid signature rejected, valid test payment, repeated verification, webhook replay/idempotency | Signature helper and webhook claim logic unit-tested; provider integration pending |
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
- Do not call the application fully verified until the final report commit's CI passes and the critical appointment/payment/email integration scenarios above are exercised.

## Current decision

**Testing only — no deployment, no merge, and no production changes.** Keep all fixes on `chore/ci-and-repo-hardening` and keep PR #1 open until the test report's pending checks are resolved.
