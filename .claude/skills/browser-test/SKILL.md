---
name: browser-test
description: Verify a feature works in the browser using Chrome DevTools MCP — navigate, interact, screenshot, and validate. Use for manual QA verification.
disable-model-invocation: true
argument-hint: http://localhost:8000/students/1
---

# Browser Test

Use the Chrome DevTools MCP to verify a feature works correctly in the browser.

## Workflow

1. **Determine target**: If `$ARGUMENTS` is a URL, navigate directly. If it's a feature name, resolve the URL from the project's route structure.

2. **Navigate and screenshot**:
   - Use `navigate_page` to load the URL
   - Use `take_screenshot` for a baseline visual
   - Check `list_console_messages` for any JS errors

3. **Interact and verify**:
   - Use `click`, `fill`, `type_text`, `press_key` to interact with the page
   - Screenshot after each significant interaction
   - Check network requests with `list_network_requests` if testing API calls
   - Verify expected elements are present and visible

4. **Report results**:
   - PASS/FAIL for each verification step
   - Screenshots showing the state at each step
   - Console errors or network failures if any
   - Suggested fixes for any failures found

## Available Chrome DevTools Tools

**Navigation**: `navigate_page`, `list_pages`, `select_page`, `new_page`, `close_page`
**Input**: `click`, `fill`, `fill_form`, `type_text`, `press_key`, `hover`, `drag`, `upload_file`
**Inspection**: `take_screenshot`, `take_snapshot` (DOM), `evaluate_script`
**Network**: `list_network_requests`, `get_network_request`
**Console**: `list_console_messages`, `get_console_message`
**Performance**: `performance_start_trace`, `performance_stop_trace`, `performance_analyze_insight`, `lighthouse_audit`
**Dialogs**: `handle_dialog`, `wait_for`
**Emulation**: `emulate` (device/viewport), `resize_page`

## Important Constraints

- Chrome DevTools MCP is **single-instance** — only one agent at a time can use it
- The app runs at `http://localhost:8000` in dev
- Production is at `https://shift.vace.local` (requires VPN)
- Login required for most routes (use `/auth/login` first)

## Common Test Flows

### Verify a page loads
```
navigate_page → take_screenshot → list_console_messages (check for errors)
```

### Test a form submission
```
navigate_page → fill_form → click submit → wait_for response → take_screenshot → check network
```

### Check responsive layout
```
navigate_page → take_screenshot → resize_page (mobile) → take_screenshot → compare
```

### Performance check
```
lighthouse_audit → review scores → report findings
```
