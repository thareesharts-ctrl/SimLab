# STUDENT_LEARNER_LOGIN_ROLE_ROUTING_FIX_REPORT

**Date:** 2026-07-05  
**Status:** ✅ COMPLETE — Both backend and frontend build and test fully clean.

---

## 1. Root Cause

1. **Empty Database / Incorrect Password Hashing parameters in Pilot Seed**:
   - The pilot demo accounts did not initially exist. When the previous model added `apps/backend/src/seed/pilot-seed.ts`, it used standard Node `scryptSync(password, salt, 64)` which default-resolved to parameters like block size `r=8`.
   - However, `better-auth` hashes passwords with `r=16`.
   - Consequently, all password logins failed with `401 Unauthorized` ("Invalid email or password").
   - This authentication failure caused routing guards to default to safe fallbacks or trigger 403 errors when the frontend tried to request sandbox APIs without a valid session.
   
2. **Missing `status` and `classId` in Auth Schema Serialization**:
   - The backend `/api/v1/auth/me` Fastify response schema was omitting `status` and `classId` fields, causing Fastify to strip them during serialization before sending to the client, preventing the frontend from routing students accurately based on classroom enrollment approval status.

---

## 2. Role Mapping Table

| DB Role Value | Frontend `normalizeRole` Output | Dashboard Route | Sandbox Access |
|---|---|---|---|
| `ADMIN` | `SUPER_ADMIN` | `/admin` | ✅ Allowed |
| `INSTRUCTOR` | `INSTRUCTOR` | `/instructor` | ❌ Blocked (proper 403) |
| `STUDENT_COLLEGE` | `STUDENT` | `/dashboard` | ❌ Blocked (safe 200 empty) |
| `INDIVIDUAL` | `INDIVIDUAL` | `/dashboard` | ✅ Allowed |
| `LEARNER` | `INDIVIDUAL` | `/dashboard` | ✅ Allowed (new alias) |

---

## 3. Changes Made

### A. FIX: `apps/backend/src/seed/pilot-seed.ts`
- Updated the password hasher to import `hashPassword` directly from `@better-auth/utils/password` (adding a `// @ts-ignore` comment to prevent TS type resolution compilation blocks under old moduleResolution config).
- This guarantees password hashes generated during seed exactly match the runtime credentials verification algorithm (scrypt with N=16384, r=16, p=1).
- Runs on: `npm run pilot:seed -w apps/backend`

### B. FIX: `apps/backend/src/routes/auth.routes.ts`
- Added `status` and `classId` to the Fastify JSON schema response definition (to prevent serialization stripping).
- Added `status` and `classId` to the returned payload.

### C. FIX: `apps/backend/src/routes/sandbox.routes.ts`
- Added `LEARNER` and `STUDENT` uppercase checks to allow defense-in-depth aliasing.
- Custom role-specific 403 responses added for unauthorized roles attempting sandbox access.

### D. FIX: `apps/frontend/src/pages/simulation/SimulationHomePage.tsx`
- Added checks for `user?.id` inside the mount effects and deferred sandbox loading / sample-scenarios loading until `user` resolves. This avoids race-condition API calls returning 403 on mount.

---

## 4. Verification & E2E Validation Results

### A. Demo Account Login Test Results
We ran the automated verification script `node scripts/verify-roles-dashboards.js` checking all 8 target accounts:
- **`learner@simlab.run`** (INDIVIDUAL): logs in successfully → redirects to `/dashboard` → sandbox state `200` → billing subscription `200` (CORS/CSRP/WebSocket clean).
- **`student1, student2, student3, student5, student9`** (STUDENT_COLLEGE): logs in successfully → redirects to `/dashboard` → sandbox `/state` returns clean `200` empty state without fetching forbidden scenarios → active classroom assignments endpoint returns `200`.
- **`instructor.alpha@simlab.run`** (INSTRUCTOR): logs in successfully → redirects to `/instructor` → sandbox state returns `403` with specific error message → classes API returns `200`.
- **`superadmin@simlab.run`** (ADMIN): logs in successfully → redirects to `/admin` → sandbox state returns `200`.

**Result:** `Total: 48 | PASS: 48 | FAIL: 0` ✅

### B. Smoke Test Result
Ran `node scripts/smoke-test.js http://localhost:5000` checking production telemetry, Redis fallback, CORS permissions, and account routing:
- CORS Preflights allowed for `vercel.app` preview domains.
- Redis-offline grace periods verified.
- User audits returned clean.

**Result:** `Total Checks: 48 | Passed: 48 | Failed: 0` ✅

### C. Playwright E2E Result
Ran `npm run test:e2e` checking browser E2E workflows (resetting DB, sign-up, student join class, instructor approval, student simulation step fast-forward, individual billing checkout and verification):

**Result:** `PLAYWRIGHT E2E BROWSER VALIDATION COMPLETED SUCCESSFULLY` ✅

### D. Unit & Integration Test Result
Ran `npm test` running 155 unit & integration tests on backend:

**Result:** `Test Files: 25 passed | Tests: 155 passed` ✅

### E. Frontend & Backend Builds
- `npm run build -w apps/frontend` → `built in 2.21s` ✅
- `npm run build -w apps/backend` → Built cleanly with tsc compiler ✅

---

## 5. Git Commit & Push Details

- **Commit Message:** `"Fix student and learner login role routing"`
- **Pushed to:** `main` on thareesharts-ctrl/SimLab.git
