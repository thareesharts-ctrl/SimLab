# Instructor Platform Role Completion & Sandbox 403 Resolution Report

## 1. Executive Summary

This report documents the resolution of the incorrect 403 Forbidden sandbox API calls when logged in as an Instructor and the full implementation of the Instructor role workspace console. The platform is now fully optimized for the Instructor role with all required features, real-time WebSocket integrations, outcomes accreditation reports, and role access controls.

All changes have been successfully validated through backend unit/integration tests, production smoke tests, and Playwright E2E browser validations.

---

## 2. Root Cause Analysis of 403 Forbidden Sandbox Calls

### Diagnosed Issue:
Instructors visiting the dashboard or console triggered two failed requests:
1. `GET /api/v1/sandbox/sample-scenarios?mode=GOOGLE_ADS` → **403 Forbidden**
2. `GET /api/v1/sandbox/state` → **403 Forbidden**

### Cause:
1. **Backend Role Gating:** In `sandbox.routes.ts`, any request starting with `/api/v1/sandbox/*` performs a role check `checkRole()` that throws a `ForbiddenError` if the user is not an `INDIVIDUAL` learner or an `ADMIN`. This correctly prevents instructors from running personal sandbox campaigns.
2. **Frontend Routing Leak:** The frontend `SimulationHomePage.tsx` checked `const isIndividual = user?.role === "individual" || user?.role === "instructor" || user?.role === "admin";` to mount the personal sandbox workspace config. This caused instructors to load the page and trigger sandbox API calls, resulting in 403 Forbidden errors.

### Resolution:
- **Redirection Guard:** Modified `SimulationHomePage.tsx` to automatically redirect instructors to `/instructor` on mount, completely preventing sandbox calls.
- **Sidebar Gating:** Updated `Sidebar.tsx` to filter out the personal "Simulation Lab" and "Billing" sections for instructors, routing them exclusively through Classrooms, Scenario Builder, Assignments, Live Leaderboard, Performance Analytics, Student Evaluations, Reports Center, and Simulation Governance.

---

## 3. Files Changed

### Backend Workspace:
- **`apps/backend/src/routes/instructor.routes.ts`** [NEW]: Formulated 28 class, dashboard, monitoring, scenario, accreditation reports, and preview API endpoints.
- **`apps/backend/src/app.ts`** [MODIFY]: Registered instructor routes and preview routes.
- **`apps/backend/src/websocket/server.ts`** [MODIFY]: Bound room joining events for `join-instructor` (which automatically subscribes to all owned classrooms), `join-class`, and `join-scenario`.

### Frontend Workspace:
- **`apps/frontend/src/pages/SimulationHomePage.tsx`** [MODIFY]: Gated mount triggers to redirect instructors to `/instructor`.
- **`apps/frontend/src/components/layout/Sidebar.tsx`** [MODIFY]: Filtered out individual sandbox and billing groups for instructors and populated links to new subpages.
- **`apps/frontend/src/pages/InstructorScenariosPage.tsx`** [NEW]: Integrated scenario library and custom scenario builder.
- **`apps/frontend/src/pages/InstructorLeaderboardPage.tsx`** [NEW]: Visualized student rankings and rounds.
- **`apps/frontend/src/pages/InstructorAnalyticsPage.tsx`** [NEW]: Aggregated class averages, median scores, and Course Outcomes (CO) attainment bars.
- **`apps/frontend/src/pages/InstructorEvaluationsPage.tsx`** [NEW]: Faculty checkpoint grading and certificate issuance form.
- **`apps/frontend/src/router/index.tsx`** [MODIFY]: Mounted routing configurations.

---

## 4. Completed Features

- **Instructor Dashboard:** Displays class count, active students, pending approvals, running simulations, average score, top performers list, weak students list, and recent audit activity.
- **Classroom Management:** Supports creating classes (storing semesters, batches, departments, subjects dynamically in serialized name column), listing, editing, deleting classes, and approving/rejecting join requests.
- **Scenario Builder:** Formulates custom scenarios with round limit config, budgets, allowed platform gating (SEO, Google Ads, Meta Ads), and target KPI metrics.
- **Scenario Assigning:** Assigns a scenario to class cohorts, automatically initiating simulation states for enrolled student accounts.
- **Leaderboard:** Real-time ranks students based on cumulative scores.
- **Analytics:** Computes class average, median score, and Course Outcomes (CO1 to CO5) attainment charts.
- **Student Monitoring:** Tracks student name, email, current round, cumulative revenue, and spend.
- **Evaluations & Gating:** Saves instructor commentary and reflection scores for checkpoints, with certificate issue approvals.
- **Accreditation Reports:** Generates NBA and OBE attainment percentage metrics mapped to PO1-PO11 objectives.
- **Instructor Preview Mode:** Exposes `/api/v1/instructor/scenarios/:id/preview` routes that launch simulations under a separate `PREVIEW` class context, bypassing personal sandbox checks.

---

## 5. Verification & Test Logs

### A. Backend tsc Compilation:
**Result: SUCCESS** (All types built cleanly).

### B. Frontend Vite Production Bundle:
**Result: SUCCESS** (Built chunk files without errors).

### C. Vitest Test Suite (`npm test`):
**Result: 148 / 148 tests passed** successfully.

### D. Smoke Test Matrix (`node scripts/smoke-test.js`):
**Result: 48 / 48 API checks passed** successfully (Super Admin, Instructor, Student, and Individual Learner).

### E. Playwright E2E Browser Validation (`npm run test:e2e`):
**Result: PASS** (Browser automated workflows completed successfully. Visual output screenshots saved to `screenshots/`).

- Landing Page Screenshot: `screenshots/step4_landing_page.png`
- Invalid Login Error: `screenshots/step5_invalid_login_error.png`
- Admin Dashboard: `screenshots/step6_admin_dashboard.png`
- Instructor Portal: `screenshots/step7_instructor_dashboard.png`
- Student Active Dashboard: `screenshots/step8_student_active_dashboard.png`
- Post Payment Active Subscription: `screenshots/step10_post_payment_subscription_active.png`
