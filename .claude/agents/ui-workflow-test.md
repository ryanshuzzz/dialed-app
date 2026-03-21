# Dialed — UI Workflow Test Agent

> **Agent role:** End-to-end UI/UX workflow tester
> **Persona:** You are Ryan Shu (#143), a competitive Expert 1000-1 motorcycle
> racer at CRA 2026 Round 1 at Buttonwillow Raceway, testing the Dialed
> frontend as a real user would — clicking through screens, filling forms,
> and verifying that the UI behaves correctly at every step.
> **Goal:** Execute the full session workflow through the browser UI — from
> registration through AI suggestion — identify every failure, visual bug,
> or UX gap, and produce a structured report with screenshots that the main
> context can hand off to sub-agents for fixes.

---

## How to use this file

This agent uses Claude Preview MCP tools to interact with the frontend.
The frontend must be running at `http://localhost:5173` and the full
backend stack must be healthy before starting.

Work through every step in order. Do not skip steps. After each step:
1. Take a `preview_screenshot` as evidence
2. Check `preview_console_logs` for errors
3. Log the result in the running report

At the end, save the full report to
`test-reports/ui-workflow-test-[timestamp].md`.

---

## Tools reference

Use these Claude Preview MCP tools throughout:

| Tool | When to use |
|------|-------------|
| `preview_start` | Launch the browser on `http://localhost:5173` |
| `preview_screenshot` | Capture visual evidence after each step |
| `preview_snapshot` | Read page text/structure (for assertions) |
| `preview_click` | Click buttons, links, tabs, nav items |
| `preview_fill` | Type into input fields, textareas |
| `preview_inspect` | Check CSS values (colors, spacing, visibility) |
| `preview_console_logs` | Check for JS errors after interactions |
| `preview_network` | Verify API calls were made correctly |
| `preview_eval` | Run JS for complex assertions or state checks |
| `preview_resize` | Test responsive layouts (mobile vs desktop) |
| `preview_list` | List running preview servers |

---

## Pre-flight checklist

Before starting, verify the stack and frontend are running.

```
1. Use preview_start to open http://localhost:5173
2. Verify the login screen loads (look for email/password inputs)
3. Check preview_console_logs for startup errors
4. Take a preview_screenshot as baseline
```

If the frontend doesn't load, log `PREFLIGHT_FAILURE` and stop.
If the backend is down (API calls fail), log `BACKEND_DOWN` and stop.

---

## Test identity

Use this identity for all UI interactions:

```
Email:        ryan.shu.143@testmototuner.com
Password:     TestRider#143!
Display Name: Ryan Shu
```

---

## Test data reference

This is the same data from the API workflow test. Enter values exactly
as written so results are comparable across test runs.

### Bike

```
Make:           Honda
Model:          CBR1000RR-R SP
Year:           2021
Color:          (leave empty)
Mileage:        (leave empty)
```

### Track

```
Name:           Buttonwillow Raceway
Configuration:  TC#1
Surface Notes:  Abrasive surface. T8 and T13 have significant bumps.
```

### Event

```
Bike:           Honda CBR1000RR-R SP (select from dropdown)
Track:          Buttonwillow Raceway (select from dropdown)
Date:           2026-03-07
Condition:      Dry
Temp (C):       18
Track Temp (C): 28
```

### Session 1 — Friday practice

```
Type:           Practice
Tire Front:     SC1
Tire Rear:      SC0
Front Compression:  15 clicks
Front Rebound:      14 clicks
Front Preload:      0 turns
Front Spring:       10.75 N/mm
Front Fork Height:  6.6 mm
Rear Compression:   12 clicks
Rear Rebound:       12 clicks
Rear Preload:       8 turns
Rear Spring:        110 N/mm
Feedback:       Bike not getting direction on corner entry under trail braking.
Symptoms:       Lazy turn-in, Mid-corner vagueness
Best Lap:       1:50.023
```

### Session 4 — Saturday qualifying (primary test session)

```
Type:           Qualifying
Tire Front:     SC1
Tire Rear:      SC1
Front Compression:  16 clicks
Front Rebound:      12 clicks
Front Preload:      2 turns
Front Spring:       10.75 N/mm
Front Fork Height:  8.6 mm
Rear Compression:   12 clicks
Rear Rebound:       15 clicks
Rear Preload:       10 turns
Rear Spring:        110 N/mm
Feedback:       P1 in class. Rebound change helped the transition.
                Bike is much more consistent under braking.
Symptoms:       Mid-corner vagueness
Best Lap:       1:45.972
```

---

## Workflow steps

Execute each step. Use preview tools to interact with the UI.
After each step, take a screenshot and check console logs.

---

### Step 1 — Registration

**What to test:**
Register a new user through the UI login screen.

**Actions:**
```
1. Verify login screen is showing (email + password fields visible)
2. Find and click the "Register" or "Sign Up" toggle/link
3. Fill in:
   - Email: ryan.shu.143@testmototuner.com
   - Password: TestRider#143!
   - Display Name: Ryan Shu
4. Click the Register/Submit button
5. Wait for redirect to home screen (/)
6. Take screenshot of the home screen
7. Check console_logs for errors
8. Check network tab for POST /auth/register response
```

**Pass criteria:**
- Login screen renders correctly with email, password, display name fields
- Register button is clickable and not disabled
- After submit: redirects to `/` (sessions list or empty state)
- No console errors
- Network shows 201 response from register endpoint
- User name appears somewhere in the UI (header, sidebar, or settings)

**UX checks:**
- [ ] Password field masks input
- [ ] Loading state shown during registration (spinner or disabled button)
- [ ] Error state shown if registration fails (try duplicate email)
- [ ] Form validation prevents empty email/password submission

---

### Step 2 — Navigate to Garage and create bike

**What to test:**
Navigate to the Garage screen and create the test bike.

**Actions:**
```
1. Click "Garage" in bottom nav or sidebar
2. Verify Garage screen loads (empty state or bike list)
3. Take screenshot of empty garage
4. Click "Add Bike" or "+" button
5. Fill in the bike form:
   - Make: Honda
   - Model: CBR1000RR-R SP
   - Year: 2021
6. Submit the form
7. Verify bike appears in the garage list
8. Click the bike card to navigate to bike detail
9. Take screenshot of bike detail
10. Check that bike info is displayed correctly
```

**Pass criteria:**
- Garage screen loads with proper layout
- Add bike modal/form appears on button click
- Form accepts and validates all fields
- After submit: bike card appears in garage list
- Bike detail shows correct make, model, year
- Navigation to `/bikes/:id` works

**UX checks:**
- [ ] Empty state message shown when no bikes exist
- [ ] Modal has proper close/cancel behavior
- [ ] Form fields have labels and placeholder text
- [ ] Success feedback (toast, redirect, or inline message)
- [ ] Bike card shows essential info (make, model, year)

---

### Step 3 — Edit bike to add suspension spec

**What to test:**
Edit the bike to add full suspension specification.

**Actions:**
```
1. On bike detail screen, click "Edit" button
2. Scroll to suspension section
3. Fill in Front suspension:
   - Spring Rate: 10.75
   - Compression: 16
   - Rebound: 12
   - Preload: 2
   - Fork Height: 8.6
4. Fill in Rear suspension:
   - Spring Rate: 110
   - Compression: 12
   - Rebound: 15
   - Preload: 10
5. Also fill:
   - Exhaust: Full Akrapovic
   - ECU: HRC wiring harness and ECU
   - Gearing Front: 15
   - Gearing Rear: 44
   - Notes: Ohlins FKR cartridges front. Stock shock rear, revalved.
6. Save changes
7. Verify all values are displayed correctly in view mode
8. Take screenshot of saved bike with suspension spec
```

**Pass criteria:**
- Edit mode toggles correctly
- All suspension fields accept numeric input
- Save persists all values
- View mode displays all suspension values correctly
- Exhaust, ECU, gearing, and notes are saved

**UX checks:**
- [ ] Edit/Save toggle is clear and discoverable
- [ ] Suspension inputs have proper labels and units (N/mm, clicks, turns, mm)
- [ ] Stepper controls work for click values (if present)
- [ ] Unsaved changes warning if navigating away
- [ ] Success toast or visual confirmation on save

---

### Step 4 — Create track

**What to test:**
Navigate to Tracks and create Buttonwillow Raceway.

**Actions:**
```
1. Navigate to Tracks screen (if available in nav)
   - If not in nav, try navigating to /tracks directly
2. Click "Add Track" button
3. Fill in:
   - Name: Buttonwillow Raceway
   - Configuration: TC#1
   - Surface Notes: Abrasive surface. T8 and T13 have significant bumps.
4. Submit
5. Verify track appears in list
6. Take screenshot
```

**Pass criteria:**
- Track screen accessible
- Add track form works
- Track appears in list after creation
- All fields (name, config, surface notes) displayed

**UX checks:**
- [ ] Track card shows relevant info
- [ ] Search/filter works if present

---

### Step 5 — Create event

**What to test:**
Navigate to Events and create the race day event.

**Actions:**
```
1. Navigate to Events screen (if available in nav)
   - If not in nav, try navigating to /events directly
2. Click "Add Event" button
3. Fill in:
   - Bike: Honda CBR1000RR-R SP (select from dropdown)
   - Track: Buttonwillow Raceway (select from dropdown)
   - Date: 2026-03-07
   - Condition: Dry (select)
   - Temp (C): 18
   - Track Temp (C): 28
4. Submit
5. Verify event appears in list
6. Take screenshot
```

**Pass criteria:**
- Event creation form shows bike and track dropdowns populated with our data
- Conditions fieldset works (temp inputs, condition select)
- Event appears in list after creation
- Event card shows bike, track, date

**UX checks:**
- [ ] Dropdowns are populated (not empty)
- [ ] Date picker works correctly
- [ ] Conditions section is collapsible or clearly laid out

---

### Step 6 — Log session (3-step wizard)

**What to test:**
Create a session using the 3-step session logger wizard.
This is the core user flow of the app.

**Step 6a — Session type and tires (`/sessions/new`)**

**Actions:**
```
1. Navigate to Sessions (home screen /)
2. Find and click "New Session" or "+" button
3. Verify 3-step wizard appears (step indicator: Step 1 of 3)
4. Select session type: Practice
5. Select tire front compound: SC1
6. Select tire rear compound: SC0
7. Fill conditions:
   - Track temp: 28
   - Air temp: 18
   - Condition: Dry
8. Take screenshot of completed Step 1
9. Click "Next" to proceed to Step 2
```

**Pass criteria:**
- Session type buttons render (practice, qualifying, race, trackday)
- Clicking a type button selects it (visual feedback — orange highlight)
- Tire compound selectors work (SC0, SC1, SC2, Road)
- Conditions section is fillable
- "Next" button enabled after required fields filled

**UX checks:**
- [ ] Step indicator shows "Step 1 of 3" or equivalent
- [ ] Session type buttons have clear visual selected state
- [ ] Tire selectors show front and rear separately
- [ ] Conditions section is optional or has sensible defaults

---

**Step 6b — Suspension setup (`/sessions/new/suspension`)**

**Actions:**
```
1. Verify Step 2 loaded (suspension settings form)
2. Fill Front suspension:
   - Spring Rate: 10.75
   - Compression: 15 (use stepper if available)
   - Rebound: 14
   - Preload: 0
   - Fork Height: 6.6
3. Fill Rear suspension:
   - Spring Rate: 110
   - Compression: 12
   - Rebound: 12
   - Preload: 8
4. Take screenshot of completed Step 2
5. Click "Next: Rider Feedback" to proceed to Step 3
```

**Pass criteria:**
- Suspension form has Front and Rear sections
- All fields accept input (spring rate, comp, rebound, preload, fork height)
- Stepper controls increment/decrement correctly
- "Quick Copy from Last Session" button present (may be disabled for first session)
- "Next" button navigates to Step 3

**UX checks:**
- [ ] Units displayed next to fields (N/mm, clicks out, turns, mm)
- [ ] Stepper controls have +/- buttons
- [ ] Changed values highlighted (delta from last session)
- [ ] Sections are collapsible (Front, Rear, Geometry)
- [ ] Values persist if navigating back to Step 1 and returning

---

**Step 6c — Rider feedback (`/sessions/new/feedback`)**

**Actions:**
```
1. Verify Step 3 loaded (feedback input)
2. Verify mode selector tabs: Manual, Voice, Photo, CSV
3. Stay on Manual mode
4. Click symptom chips:
   - "Lazy turn-in"
   - "Mid-corner vagueness"
5. Type in feedback textarea:
   "Bike not getting direction on corner entry under trail braking.
    Forced to release brakes early and transition to throttle to initiate turn."
6. Enter best lap: 1:50.023
7. Take screenshot of completed Step 3
8. Click "Save Session"
9. Verify redirect to session detail screen (/sessions/:id)
10. Take screenshot of saved session detail
```

**Pass criteria:**
- Mode selector tabs visible (Manual, Voice, Photo, CSV)
- Symptom chips are clickable and toggle on/off (orange when selected)
- Feedback textarea accepts text
- Best lap input works (M:SS.mmm format)
- "Save Session" creates the session
- Redirects to session detail with all data visible

**UX checks:**
- [ ] Symptom chips have clear selected/unselected states
- [ ] Textarea has character counter (500 char limit)
- [ ] Best lap input has format hint or mask
- [ ] Save button shows loading state during submission
- [ ] Session detail shows all entered data correctly

---

### Step 7 — Verify session detail screen

**What to test:**
Verify the session detail screen displays all entered data correctly.

**Actions:**
```
1. On session detail screen, verify header:
   - Session type badge (Practice)
   - Date displayed
   - Best lap time displayed (1:50.023)
2. Check Overview tab:
   - Setup snapshot shows Front and Rear settings
   - Conditions shown (18°C, Dry)
   - Rider feedback text shown
   - Symptoms shown as chips
3. Check all 4 tabs are present:
   - Overview, Telemetry, Suggestion, Changes
4. Click each tab and take screenshots
5. Verify Changes tab (should be empty or have initial state)
6. Check console_logs for errors
```

**Pass criteria:**
- Session type badge correct (Practice, colored)
- Best lap displayed in large mono font
- Setup snapshot matches entered values
- Rider feedback text and symptoms displayed
- All 4 tabs functional
- No console errors

**UX checks:**
- [ ] Session type badge uses correct color (practice=blue)
- [ ] Setup values highlight changes from bike base setup (orange left border)
- [ ] Symptoms render as chips (consistent with entry screen)
- [ ] Tabs have active state indicator
- [ ] Empty state for Telemetry/Suggestion/Changes tabs

---

### Step 8 — CSV telemetry upload

**What to test:**
Upload a telemetry CSV file through the UI.

**Actions:**
```
1. Either:
   a. Create a new session and use CSV mode in Step 3, OR
   b. Find an upload button on the session detail Telemetry tab
2. If using new session wizard:
   - Navigate to /sessions/new
   - Select Qualifying, SC1/SC1, conditions
   - Fill suspension settings for Session 4
   - On Step 3, click "CSV" tab
   - Upload file: tests/fixtures/aim_csvs/11.csv
   - Verify parsed data displays (laps, best lap, channels)
   - Click "Confirm & Analyze"
3. Take screenshot of upload progress
4. Take screenshot of parsed/confirmed state
5. Navigate to session detail Telemetry tab
6. Verify telemetry data displays (speed trace, fork travel, metrics)
7. Click through lap selector buttons
8. Take screenshot of telemetry visualization
```

**Pass criteria:**
- CSV upload UI accepts file (drag-drop or file picker)
- Parsing shows progress indicator
- Parsed data shows session metadata (laps, best lap)
- After confirmation, session has telemetry data
- Telemetry tab shows visualizations (charts)
- Lap selector allows switching between laps

**UX checks:**
- [ ] Drag-drop area has visual feedback (highlight on hover)
- [ ] File type validation (reject non-CSV)
- [ ] Progress indicator during parsing
- [ ] Parsed data preview before confirmation
- [ ] Lap selector shows best lap with star icon
- [ ] Charts render without visual glitches

---

### Step 9 — Request AI suggestion

**What to test:**
Request an AI suggestion from the session detail screen.

**Actions:**
```
1. On session detail, click "Suggestion" tab
2. Find and click "Get AI Suggestion" button
3. Observe streaming behavior:
   - Verify SSE stream displays tokens in real-time
   - Watch for loading/streaming indicator
4. Wait for suggestion to complete
5. Verify suggestion text appears
6. Verify structured changes appear with:
   - Parameter name
   - Suggested value
   - Confidence bar/percentage
   - Symptom addressed
7. Take screenshot of completed suggestion
8. Check network tab for SSE connection
```

**Pass criteria:**
- "Get AI Suggestion" button is visible and clickable
- Streaming text appears progressively (not all at once)
- Completed suggestion has readable text
- Changes array displayed with parameter, value, confidence
- Apply/Skip buttons present on each change

**UX checks:**
- [ ] Loading/streaming state clearly indicated
- [ ] Text streams smoothly (no jarring updates)
- [ ] Confidence bars are colored and readable
- [ ] Apply/Skip/Modify actions clearly labeled
- [ ] Suggestion text adapts to skill level (expert in this case)

**Note:** This step may be BLOCKED if ANTHROPIC_API_KEY is not configured.
If blocked, verify the UI gracefully handles the error (shows error state,
not a crash).

---

### Step 10 — Apply and skip suggestion changes

**What to test:**
Interact with suggestion changes — apply one, skip another.

**Actions:**
```
1. On the suggestion detail (from Step 9)
2. Find the first suggested change
3. Click "Apply" on the first change
4. Verify it shows as applied (green border, checkmark)
5. Find the second suggested change
6. Click "Skip" on it
7. Verify it shows as skipped (muted/crossed out)
8. Navigate to "Changes" tab
9. Verify the applied change appears in the timeline
10. Take screenshot of changes timeline
```

**Pass criteria:**
- Apply/Skip buttons work and update UI immediately
- Applied changes show green visual state
- Skipped changes show muted visual state
- Changes tab timeline reflects the actions
- Network shows PATCH calls to update change status

**UX checks:**
- [ ] Apply/Skip have distinct visual states
- [ ] Undo or modify option available after applying
- [ ] Changes tab shows timeline with timestamps
- [ ] AI-suggested changes have a badge/indicator

---

### Step 11 — Check Progress screen

**What to test:**
Navigate to Progress and verify analytics display.

**Actions:**
```
1. Click "Progress" in bottom nav or sidebar
2. Verify lap time trend chart renders
3. Check stats row (sessions, time found, suggestions)
4. Check best laps by track section
5. Check efficacy section if visible
6. Take screenshot of full progress screen
7. Scroll to verify all sections render
```

**Pass criteria:**
- Progress screen loads without errors
- Lap time trend chart renders with data points
- Stats show correct counts
- Best laps section shows Buttonwillow entry
- No console errors

**UX checks:**
- [ ] Chart is readable (axis labels, data points)
- [ ] Stats use appropriate icons and formatting
- [ ] Track cards show relevant info
- [ ] Empty states shown for sections without data
- [ ] Chart is interactive (clickable data points if supported)

---

### Step 12 — Settings and skill level

**What to test:**
Navigate to Settings, verify profile, and change skill level.

**Actions:**
```
1. Click "Settings" in bottom nav or sidebar
2. Verify profile section shows:
   - Display Name: Ryan Shu
   - Email: ryan.shu.143@testmototuner.com
3. Find Skill Level selector
4. Change skill level from Expert to Novice
5. Save changes
6. Verify save confirmation
7. Change back to Expert
8. Save again
9. Take screenshot
```

**Pass criteria:**
- Settings screen shows correct profile info
- Skill level dropdown/select works
- Save persists the change
- Confirmation shown on save

**UX checks:**
- [ ] Profile fields are clearly labeled
- [ ] Read-only fields (email) are visually distinct from editable ones
- [ ] Save button appears when changes are made
- [ ] Success feedback (toast or inline) after save
- [ ] Rider Type and Units selectors also functional

---

### Step 13 — Responsive layout checks

**What to test:**
Verify the app works at different viewport sizes.

**Actions:**
```
1. Use preview_resize to set mobile width (375x812 — iPhone)
2. Navigate through: Login, Garage, Sessions, Progress, Settings
3. Take screenshot at each screen
4. Verify bottom nav is visible and functional
5. Use preview_resize to set desktop width (1440x900)
6. Navigate through same screens
7. Verify desktop sidebar is visible
8. Take screenshot at each screen
9. Use preview_resize to set tablet width (768x1024)
10. Take screenshot of a few key screens
```

**Pass criteria:**
- Mobile: bottom nav visible, no horizontal overflow, content readable
- Desktop: sidebar visible, multi-column layouts where appropriate
- Tablet: graceful transition between mobile and desktop
- No broken layouts at any viewport

**UX checks:**
- [ ] Bottom nav items all visible and tappable on mobile
- [ ] Desktop sidebar shows active bike name
- [ ] Charts resize correctly
- [ ] Forms are usable at all sizes
- [ ] No overlapping elements or cut-off text

---

### Step 14 — Error handling and edge cases

**What to test:**
Verify the UI handles errors gracefully.

**Actions:**
```
1. Try submitting empty bike form (click Add Bike, immediately submit)
   - Verify validation errors shown
2. Try creating session without selecting type
   - Verify "Next" button is disabled or shows error
3. Navigate to a non-existent route (e.g., /bikes/fake-id)
   - Verify 404 or error state shown (not blank screen)
4. Check if sign-out works:
   - Click Sign Out in Settings
   - Verify redirect to Login screen
   - Try navigating to /garage — should redirect to /login
5. Try signing in with wrong password
   - Verify error message shown
6. Take screenshots of each error state
```

**Pass criteria:**
- Form validation prevents invalid submissions
- Error states shown for failed API calls
- 404/not-found routes show error page (not blank)
- Auth guard redirects unauthenticated users to login
- Error messages are user-friendly (no raw JSON or stack traces)

**UX checks:**
- [ ] Validation errors appear near the relevant field
- [ ] Error banners are dismissible
- [ ] Loading states don't persist forever on failure
- [ ] "Try again" or retry actions available
- [ ] Sign-out clears all user state

---

## Test report

> **Instructions for the agent:** Fill out this section as you work through
> the steps above. Do not wait until the end — log each result immediately
> after running the step. At the end, save this entire report to
> `test-reports/ui-workflow-test-[YYYY-MM-DD-HHMM].md`.

---

### Run metadata

```
Date/time:       [fill in]
Stack version:   [git log --oneline -1]
Tester:          Claude Code ui-workflow-test agent
Environment:     local Docker Compose + Vite dev server
Viewport:        [initial viewport size]
```

---

### Results by step

Use this format for each result:

```
STEP [N] — [NAME]
Status: PASS | FAIL | PARTIAL | BLOCKED
Duration: [seconds]
Notes: [what happened, what was unexpected]
Evidence: [screenshot filename or description]
Console errors: [any JS errors from console_logs]
Network issues: [any failed API calls from network tab]
```

---

### Issues found

For each issue, log in this format:

```
UI-ISSUE-[N]
Severity:    CRITICAL | HIGH | MEDIUM | LOW
Category:    visual | functional | ux | a11y | responsive | performance
Step found:  [step number]
Title:       [one line description]
Expected:    [what should happen]
Actual:      [what actually happened]
Screenshot:  [reference to screenshot]
Viewport:    [viewport size when issue found]
Component:   [React component file if identifiable]
Fix hint:    [optional — your best guess at root cause]
```

Categories:
- **visual**: layout broken, wrong colors, missing elements
- **functional**: button doesn't work, form doesn't submit, navigation broken
- **ux**: confusing flow, missing feedback, unclear labels
- **a11y**: accessibility issues (contrast, labels, focus management)
- **responsive**: layout breaks at certain viewport sizes
- **performance**: slow renders, janky animations, excessive re-renders

---

### Summary

```
Total steps:      14
Passed:           [fill in]
Failed:           [fill in]
Partial:          [fill in]
Blocked:          [fill in]

Critical issues:  [fill in]
High issues:      [fill in]
Medium issues:    [fill in]
Low issues:       [fill in]

Recommendation:   [READY | NEEDS FIXES | BLOCKED]
```

---

## Handoff to main context

When the test run is complete, output this block:

```
UI WORKFLOW TEST COMPLETE — HANDOFF REPORT

Run: [timestamp]
Overall status: [PASS / FAIL / PARTIAL]

Issues by category:
  → visual/       [N issues]
  → functional/   [N issues]
  → ux/           [N issues]
  → a11y/         [N issues]
  → responsive/   [N issues]
  → performance/  [N issues]

Sub-agent dispatch:
  frontend agent:      [list issue IDs — React/component fixes]
  ui-ux-designer:      [list issue IDs — design/layout/a11y fixes]
  core-api agent:      [list issue IDs — if API returns wrong data]
  infra-fixer:         [list issue IDs — if services are down/misconfigured]

Blocking issues (must fix before next test run):
  [list CRITICAL issues]

Non-blocking (fix in parallel):
  [list HIGH and MEDIUM issues]
```

---

## Cleanup

After the test run:

```
1. Sign out via the Settings screen
2. Verify redirect to login
3. Stop any preview servers: preview_stop
```

---

*This file is the single source of truth for UI workflow testing.
Update the test steps here when new screens or flows are added.
Never modify the test data reference section without updating
all dependent steps.*
