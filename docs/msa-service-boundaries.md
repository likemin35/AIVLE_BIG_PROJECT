# MSA Service Boundaries

This document describes the current intended service ownership and call paths after the async AI refactor.

## External entrypoint

- Frontend should call Gateway only.
- Gateway routes:
  - `term-service`: `/terms/**`
  - `point-service`: `/points/**`, `/api/points/**`
  - `user-service`: `/api/users/**`, `/api/auth/**`, `/users/**`
  - `qna-service`: `/qna/**`

## Service ownership

- `user-service`
  - Owns user profile read/write APIs.
  - Uses Firebase Auth for identity verification.
  - Stores profile data in Firestore `users`.
- `point-service`
  - Owns `points`, `pointHistories`, `pointReservations`.
  - Exposes balance, history, charge, manual reduce, reservation, confirm, cancel, bootstrap APIs.
- `term-service`
  - Owns `terms`, `termJobs`, `uploadTerms`.
  - Owns async AI orchestration for create/analyze jobs.
  - Calls `point-service` over REST for reservation/confirm/cancel.
  - Publishes Pub/Sub messages for AI workers.
- `create-service`
  - AI worker only.
  - Consumes Pub/Sub push for create jobs.
  - Calls back to `term-service` with create results.
- `analyze-service`
  - AI worker only.
  - Consumes Pub/Sub push for analyze jobs.
  - Calls back to `term-service` with analysis results.
- `qna-service`
  - Owns `questions` and `answers`.

## Current collection ownership

- `user-service`
  - `users`
- `point-service`
  - `points`
  - `pointHistories`
  - `pointReservations`
- `term-service`
  - `terms`
  - `termJobs`
  - `uploadTerms`
- `qna-service`
  - `questions`
  - `questions/{id}/answers`

## Current call paths

- User profile read
  - `frontend/src/App.js`
  - `frontend/src/api/user.js`
  - `user-service` `GET /api/users/me`
- User profile write
  - `frontend/src/components/SignUp.js`
  - `frontend/src/components/CompleteSignUp.js`
  - `frontend/src/api/user.js`
  - `user-service` `POST /api/users/me/profile`
- Point balance/history
  - `frontend/src/api/point.js`
  - `point-service` REST APIs
- Async term create
  - `frontend/src/components/Create-Terms.js`
  - `term-service` `POST /terms/jobs/create`
  - `term-service` -> `point-service` reservation
  - `term-service` -> Pub/Sub -> `create-service`
  - `create-service` -> `term-service` callback
- Async term analyze
  - `frontend/src/components/ContractRisk.js`
  - `term-service` `POST /terms/{termId}/jobs/analyze`
  - `term-service` `POST /terms/jobs/analyze-file`
  - `term-service` -> `point-service` reservation
  - `term-service` -> Pub/Sub -> `analyze-service`
  - `analyze-service` -> `term-service` callback

## Guardrails

- Frontend should not read or write Firestore `users` directly.
- AI workers should not charge points directly.
- `point-service` should be the only owner of point mutation logic.
- Long-running AI work should use Pub/Sub, not direct synchronous Gateway exposure.
