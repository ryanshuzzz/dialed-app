---
name: deploy-test
description: Generate a deploy testing checklist from undeployed initiatives in SESSION_STATE.md
disable-model-invocation: true
---

# Deploy Test Checklist Generator

Generate a testing checklist for production deployment verification.

## Steps

### 1. Read SESSION_STATE.md

Read `docs/SESSION_STATE.md` and extract all initiatives under "Recently Completed Initiatives (awaiting production deploy + test)".

### 2. Generate checklist

For each initiative, generate 1-3 **concrete, testable verification steps** based on what was built. Focus on:
- **Does it load?** — Navigate to the page/route, confirm no 500 errors.
- **Does the data look right?** — Check counts, display values, formatting.
- **Does the interaction work?** — Click buttons, submit forms, toggle states.

Format as a markdown checklist:

```markdown
## Deploy Test Checklist — YYYY-MM-DD

### INITIATIVE_ID — Short description
- [ ] Test step 1 (specific route or action)
- [ ] Test step 2
- [ ] Result: PASS / FAIL — notes

### INITIATIVE_ID — Short description
- [ ] Test step 1
- [ ] Result: PASS / FAIL — notes
```

### 3. Write to file

Write the checklist to `docs/plans/deploy_test_checklist.md`.

Tell Alex to fill in PASS/FAIL results as he tests on the server. When he reports back, update SESSION_STATE:
- Move tested+passing initiatives to archive
- Log any bugs as new Known Issues
- Trim the completed initiatives list to last 5

### 4. Optionally: run smoke tests

If Alex asks, run the automated smoke tests:
```bash
python -m pytest tests/test_templates_smoke.py -v
```
Report any failures that correlate with undeployed initiatives.
