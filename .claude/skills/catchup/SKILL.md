---
name: catchup
description: Start-of-session catchup — read HANDOFF.md and recent project state to get up to speed.
disable-model-invocation: true
---

# Session Catchup

Get up to speed on the current state of the project by following the Session Startup Protocol from CLAUDE.md.

## 1. Read the handoff

Read `docs/HANDOFF.md` — this was generated at the end of the last session and contains:
- What was done last session
- Critical next steps (in priority order)
- Files modified
- Recent commits

If HANDOFF.md is missing or stale, fall back to `docs/SESSION_STATE.md` (full backlog).

## 2. Check recent git activity

Review the latest commits and any uncommitted changes:

- `git log --oneline -10` — recent commit history
- `git status` — current working tree state
- `git diff --stat` — summary of uncommitted changes

## 3. Identify active work (if applicable)

- If a phase plan is referenced in the handoff, read the relevant file from `docs/plans/`
- Consult `docs/reference/INDEX.md` only for the specific BL domain you're working on
- Read domain detail files on-demand, not upfront (token-efficient)

## 4. Summarize for the user

Present a concise briefing covering:
- **Last session**: What was accomplished (from HANDOFF.md)
- **Uncommitted work**: Any staged/unstaged changes sitting in the working tree
- **Next priorities**: The "must-do" items from the handoff, in order
- **Current branch**: Confirm which branch we're on

Keep the briefing short and actionable — no more than ~20 lines. End by asking the user what they'd like to work on, referencing the next priorities as suggestions.
