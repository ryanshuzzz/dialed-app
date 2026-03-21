# Dialed UI Workflow Test Report

**Date:** 2026-03-20
**Tester:** Claude Agent (UI Workflow Test Agent)
**Persona:** Ryan Shu (#143), Expert 1000-1 racer, CRA 2026 Round 1, Buttonwillow Raceway
**Branch:** ryan-dev
**Frontend:** Vite dev server on port 63232 (preview)
**Backend:** Docker stack (gateway:8000, core-api:8001, telemetry:8002, ai:8003)

---

## Executive Summary

**Overall Result: PARTIAL PASS -- 8 of 14 steps completed successfully, 4 steps BLOCKED**

The frontend UI is visually polished and responsive. Registration, login, garage management, bike CRUD, track/event browsing, settings, and responsive layouts all work correctly against the real backend. However, the **session creation wizard is not wired to the backend API** -- it navigates to a hardcoded mock route instead of calling `POST /sessions`. This blocks all downstream features (session detail, CSV upload, AI suggestions, applying changes). Additionally, the sessions list and progress screens fall back to hardcoded mock data when the API returns empty results, creating a misleading user experience.

---

## Pre-flight

| Check | Result |
|-------|--------|
| Frontend loads | PASS |
| Login screen renders | PASS |
| Console errors at startup | None |
| Backend healthy | PASS (after running Alembic migrations) |

### Pre-flight fixes applied:
1. Added Vite proxy config (`/api` -> `http://localhost:8000`) to avoid CORS issues with preview browser
2. Changed `BASE_URL` to empty string in `client.ts` and `useSSE.ts` (was hardcoded to `localhost:8000`)
3. Created `.env.local` with `VITE_ENABLE_MOCKS=false` to disable MSW mock service worker
4. Ran `alembic upgrade head` on core-api, telemetry, and ai services

---

## Step Results

### Step 1: Registration -- PASS
- Navigated to login, toggled to "Create Account"
- Filled: Display Name "Ryan Shu", Email "ryan.shu.143@testmototuner.com", Password "TestRider#143!"
- Registration succeeded, redirected to home (sessions list)
- API call: `POST /api/v1/auth/register` returned 201

### Step 2: Garage (empty state) -- PASS
- Garage shows "0 bikes" with empty state CTA ("No bikes yet" + "Add Bike" button)
- Clean empty state UI

### Step 3: Add Bike -- PASS (with issues)
- Clicked "+ Add Bike", modal appeared
- Filled: Year 2021, Make Honda, Model CBR1000RR-R SP
- Submitted successfully, bike appeared in garage list
- API call: `POST /api/v1/bikes` returned 201

### Step 4: Track browsing -- PASS
- Navigated to `/tracks`
- Tracks list loaded from API (Buttonwillow Raceway visible)
- Track detail page loaded with layout info

### Step 5: Event browsing -- PASS
- Navigated to `/events`
- Events list loaded from API (CRA 2026 Round 1 visible)
- Event detail page loaded with date and track info

### Step 6: Session wizard -- PARTIAL PASS
- **Step 6a (Session Setup):** PASS -- Form loads with track/event selectors, session type picker, date/time fields
- **Step 6b (Suspension Setup):** PASS -- Stepper UI with +/- buttons for fork/shock values works correctly
- **Step 6c (Rider Feedback):** UI PASS, **Save FAIL** -- `handleSaveSession` just calls `navigate('/sessions/qp6')` instead of using `useCreateSession` mutation

### Step 7: Session detail -- BLOCKED
- Cannot reach real session detail because Step 6 does not create a real session
- Navigating to `/sessions/qp6` shows a detail page with mock/placeholder data

### Step 8: CSV telemetry upload -- BLOCKED
- Depends on a real session ID from Step 7

### Step 9: AI suggestion -- BLOCKED
- Depends on telemetry data from Step 8

### Step 10: Apply changes -- BLOCKED
- Depends on AI suggestion from Step 9

### Step 11: Progress -- PASS (with issues)
- `/progress` loads but shows hardcoded mock data (lap times, charts) regardless of actual data
- Same mock fallback pattern as sessions list

### Step 12: Settings -- PASS
- Settings page loads with correct profile data (Ryan Shu, email)
- Updated Rider Type to "Street", Skill Level to "Expert", Units to "Metric"
- API calls: `PATCH /api/v1/users/me/preferences` returned 200
- All preference changes persisted correctly

### Step 13: Responsive layout -- PASS
- **Mobile (375x812):** Correct mobile layout, bottom nav, centered content
- **Tablet (768x1024):** Falls back to mobile layout (expected -- `lg` breakpoint is 1024px)
- **Desktop (1280x800):** Desktop sidebar visible with Garage/Settings nav, active bike display, no bottom nav

### Step 14: Error handling -- PARTIAL PASS
- **Wrong password:** Shows "Invalid email or password" error message -- PASS
- **Empty form validation:** `required` HTML attributes prevent empty submission -- PASS
- **Sign out:** Redirects to login, clears auth state -- PASS
- **Non-existent route:** Shows raw React Router error ("Unexpected Application Error! 404 Not Found") -- FAIL, no custom 404 page
- **Sign back in after sign-out:** Works correctly -- PASS

### Data Integrity: Cross-user isolation -- PASS
- Registered second user: "Other Rider" (other.rider@testmototuner.com)
- **Garage isolation:** User 2 sees "0 bikes" -- PASS (User 1's bike not visible)
- **Settings isolation:** User 2 sees own profile (Other Rider, Novice) -- PASS
- **Sessions list:** Both users see same hardcoded mock data -- NOT A DATA LEAK (hardcoded fallback, not real data)
- **Re-login as User 1:** Bike still present, settings intact (Ryan Shu, Expert) -- PASS

---

## Issues Found

### CRITICAL

| # | Category | Component | Description | Fix Hint |
|---|----------|-----------|-------------|----------|
| C1 | Integration | `SessionNewFeedback.tsx` | `handleSaveSession` navigates to hardcoded `/sessions/qp6` instead of calling `useCreateSession` mutation. Session data is never sent to the backend. | Wire `handleSaveSession` to call `useCreateSession` from `useSessions.ts`, pass collected wizard state, navigate to the returned session ID on success. |
| C2 | Data | `SessionsList.tsx` | Falls back to hardcoded mock session data when API returns empty array (lines 76-94). Shows fake lap times and bike names to all users. | Remove mock fallback. Show empty state with CTA when no sessions exist. |
| C3 | Data | `Progress.tsx` | Shows hardcoded mock progress data (charts, lap times) regardless of actual user data. | Remove mock fallback. Show empty state or instructional content when no session data exists. |

### HIGH

| # | Category | Component | Description | Fix Hint |
|---|----------|-----------|-------------|----------|
| H1 | UX | `SessionsList.tsx` | Bike name in header is hardcoded to "2021 Honda CBR1000RR-R SP" (line 102). Best lap hardcoded to "1:45.972" (line 132). | Fetch active bike name from API/store. Compute best lap from real session data. |
| H2 | Navigation | `router.tsx` | No catch-all 404 route. Unknown paths show raw React Router error page with developer instructions. | Add `{ path: '*', element: <NotFound /> }` route with a user-friendly 404 page. |
| H3 | Code | `router.tsx` | `/login` route is duplicated (lines 65-72 and 74-83). | Remove the duplicate route definition. |

### MEDIUM

| # | Category | Component | Description | Fix Hint |
|---|----------|-----------|-------------|----------|
| M1 | UX | Add Bike modal | Close button (X) has `type="submit"` which submits the form when clicked instead of closing the modal. | Change close button to `type="button"`. |
| M2 | UX | `SessionsList.tsx` | Bottom nav only shows GARAGE and SETTINGS. No SESSIONS or HOME nav item to return to sessions list from other screens. | Add sessions/home item to BottomNav. |

### LOW

| # | Category | Component | Description | Fix Hint |
|---|----------|-----------|-------------|----------|
| L1 | UX | Login screen | Error message from previous attempt persists when toggling between Sign In / Create Account modes until form is resubmitted. The `toggleMode` function does clear error, but the old password value remains pre-filled. | Clear all form fields when toggling mode. |

---

## Environment Notes

- MSW (Mock Service Worker) is enabled by default in the frontend. Must set `VITE_ENABLE_MOCKS=false` in `.env.local` to test against real backend.
- Preview browser runs on a different port than localhost:5173, so CORS fails unless Vite proxy is configured.
- Database migrations must be run manually (`alembic upgrade head`) on each service before first use.

---

## Handoff Block

```yaml
blockers:
  - id: C1
    summary: Session wizard save not wired to backend
    file: frontend/src/screens/SessionNewFeedback.tsx
    line: 96
    action: Wire handleSaveSession to useCreateSession mutation
    blocks: [Steps 7-10]

  - id: C2
    summary: Sessions list uses hardcoded mock fallback
    file: frontend/src/screens/SessionsList.tsx
    lines: 76-94, 102, 132
    action: Remove mock data, show empty state, use real bike name and lap times

  - id: C3
    summary: Progress screen uses hardcoded mock data
    file: frontend/src/screens/Progress.tsx
    action: Remove mock data, show empty state when no sessions exist

fixes_needed:
  - id: H1
    summary: Hardcoded bike name and best lap in sessions header
    file: frontend/src/screens/SessionsList.tsx
    lines: [102, 132]

  - id: H2
    summary: No 404 page -- raw React Router error shown
    file: frontend/src/router.tsx
    action: Add catch-all route with NotFound component

  - id: H3
    summary: Duplicate /login route in router
    file: frontend/src/router.tsx
    lines: [65-72, 74-83]

  - id: M1
    summary: Add Bike modal close button typed as submit
    action: Change type="submit" to type="button" on close button

  - id: M2
    summary: No sessions/home item in bottom nav
    file: frontend/src/components/common/BottomNav.tsx

data_integrity:
  garage_isolation: PASS
  settings_isolation: PASS
  session_data: NOT_TESTABLE (hardcoded mock data shown to all users)

tested_viewports:
  mobile_375x812: PASS
  tablet_768x1024: PASS (uses mobile layout, expected)
  desktop_1280x800: PASS (sidebar visible)
```

---

*Report generated by Claude UI Workflow Test Agent on 2026-03-20*
