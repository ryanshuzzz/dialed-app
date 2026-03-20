---
name: e2e-test
description: Run end-to-end browser tests using Playwright MCP — accessibility-tree based automation for reliable, deterministic testing
disable-model-invocation: true
argument-hint: login then navigate to student list
---

# End-to-End Test (Playwright)

Use the Playwright MCP for structured, deterministic browser automation via accessibility trees (not pixel-based).

## When to Use Playwright vs Chrome DevTools

| Use Case | Tool |
|----------|------|
| Quick visual check / screenshot | Chrome DevTools (`/browser-test`) |
| Structured test scenario with assertions | **Playwright** (`/e2e-test`) |
| Performance profiling / Lighthouse | Chrome DevTools |
| Form flows, multi-step wizards | **Playwright** |
| Network inspection / console logs | Chrome DevTools |
| Cross-browser / device emulation | **Playwright** |

## Workflow

1. **Define the test scenario**: If `$ARGUMENTS` describes a scenario, use it. Otherwise, ask what to test.

2. **Plan test steps**: Break the scenario into discrete steps:
   - Navigation actions (go to URL)
   - Interaction actions (click, fill, select)
   - Assertion actions (element visible, text matches, URL changed)

3. **Execute via Playwright MCP**:
   - Playwright uses the **accessibility tree** to find elements — more reliable than CSS selectors
   - Each action is deterministic and waitable
   - Playwright handles auto-waiting for elements to be actionable

4. **Report results**:
   - Step-by-step PASS/FAIL
   - Screenshots at key checkpoints
   - Any errors or unexpected behavior
   - Suggested fixes for failures

## Key Principles

- **Accessibility-first**: Playwright finds elements by role, name, and text — not fragile CSS selectors
- **Auto-waiting**: No manual sleep/wait needed — Playwright waits for elements to be ready
- **Deterministic**: Same inputs produce same results (unlike screenshot-based approaches)
- **Multi-page flows**: Handles redirects, new tabs, and complex navigation

## Common Scenarios

### Login flow
```
1. Navigate to /auth/login
2. Fill username field
3. Fill password field
4. Click "Sign In" button
5. Assert: redirected to dashboard
6. Assert: nav shows user name
```

### Student enrollment wizard
```
1. Navigate to /enrollment
2. Fill step 1 (personal info) → click Next
3. Fill step 2 (program selection) → click Next
4. Fill step 3 (schedule) → click Next
5. Review step → click Submit
6. Assert: confirmation page shown
```

### Data table interaction
```
1. Navigate to page with table
2. Assert: table has expected columns
3. Click column header to sort
4. Assert: rows reordered
5. Use search/filter
6. Assert: filtered results shown
```
