---
name: ralph
description: Run an iterative development loop (Ralph pattern) — plan, execute, review, repeat with fresh context each cycle. Use for complex multi-step tasks that benefit from iterative refinement.
disable-model-invocation: true
argument-hint: refactor attendance service into smaller functions
---

# Ralph — Iterative Development Loop

Run a structured iterative development loop inspired by the Ralph agent pattern. Each cycle gets fresh context, preventing context window pollution from accumulating errors.

## When to Use

- Complex tasks that benefit from multiple passes (refactoring, optimization, migration)
- Tasks where early decisions inform later work
- Work that needs periodic self-review and course correction
- Long-running tasks that might exceed a single context window

## The Loop

```
┌─────────────────────────────────┐
│  1. PLAN — What to do this cycle │
│  2. EXECUTE — Do the work        │
│  3. REVIEW — Check results       │
│  4. DOCUMENT — Write findings    │
│  5. DECIDE — Continue or stop?   │
└─────────────────────────────────┘
         ↓ (if continue)
    Next cycle with fresh context
```

## Workflow

### Cycle 1: Initial Pass
1. **Plan**: Break `$ARGUMENTS` into discrete milestones
2. **Execute**: Work on milestone 1
3. **Review**: Run tests, check for errors, evaluate quality
4. **Document**: Write cycle summary to `docs/plans/ralph_[task]_cycle1.md`:
   - What was accomplished
   - What failed or needs revision
   - What to do next cycle
5. **Decide**: If more milestones remain → continue

### Cycle N: Refinement
1. **Plan**: Read previous cycle's document, pick up where we left off
2. **Execute**: Work on next milestone (or fix issues from last cycle)
3. **Review**: Run tests, compare against initial plan
4. **Document**: Update cycle document
5. **Decide**: If quality meets standards and all milestones done → stop

### Final Cycle: Wrap-up
1. Run full test suite
2. Review all changes holistically
3. Write final summary
4. Clean up any temporary files

## Key Principles

- **Fresh context each cycle**: Don't carry forward stale assumptions. Re-read relevant files.
- **Small cycles**: Each cycle should be 15-30 minutes of work. Smaller is better.
- **Document everything**: The cycle documents ARE the memory between iterations.
- **Fail fast**: If a cycle's approach isn't working, document why and pivot next cycle.
- **Test continuously**: Run tests at the end of every cycle, not just the final one.

## Integration with Existing Skills

- Use `/parallel` within a cycle if the milestone has independent sub-tasks
- Use `/browser-test` or `/e2e-test` in the review phase for UI work
- Use `/design-review` in the review phase for frontend changes
- Use `/wrap-up` after the final cycle to commit and document
