---
name: parallel
description: Run multiple tasks in parallel using isolated worktree agents — scoped by directory/feature to avoid conflicts.
disable-model-invocation: true
---

# Parallel Workstreams

Run multiple independent tasks simultaneously using worktree-isolated agents. Each agent gets its own copy of the repo so they never step on each other's files.

## When to use this

Invoke `/parallel` when the user provides 2+ tasks that:
- Touch **different files or directories** (e.g., frontend vs. backend vs. data)
- Are **independent** — neither task needs the other's output to start
- Would each take meaningful time (not trivial one-liners)

Do NOT use parallel when:
- Tasks modify the same files
- One task depends on the output of another
- The user needs to review/approve before the next step
- Chrome DevTools MCP is needed by more than one task (single browser instance — serialize these)

## How to execute

### 1. Parse and validate tasks

Read the user's request and identify discrete tasks. For each task, determine:
- **Scope**: Which files/directories it touches
- **Type**: `frontend`, `backend`, `data`, `docs`, `tests`, or `mixed`
- **Risk**: `low` (read-only, docs, tests), `medium` (new files, additive changes), `high` (modifying shared code, schema changes)

Present the task breakdown to the user:

```
## Parallel Plan

| # | Task | Scope | Risk | Isolation |
|---|------|-------|------|-----------|
| 1 | Description | frontend/ | medium | worktree |
| 2 | Description | app/services/ | medium | worktree |
| 3 | Description | docs/ | low | inline |

Estimated conflict risk: LOW — no overlapping files.
```

### 2. Check for conflicts

Before launching, verify scopes don't overlap:
- Run `git status` to see uncommitted changes that could cause merge issues
- If any two tasks touch the same file, **warn the user** and suggest serializing those tasks
- If there are uncommitted changes in a task's scope, warn — worktree branches from HEAD, not working tree

### 3. Launch agents

For each task, launch an Agent with these settings:

- **Worktree tasks** (medium/high risk, or modifies code): Use `isolation: "worktree"` so the agent works on an isolated repo copy. The agent's changes live on a temporary branch that gets merged after review.
- **Inline tasks** (low risk, read-only, or docs-only): Run without worktree isolation — faster, no merge step needed.
- **Background**: Set `run_in_background: true` for all parallel agents so they run concurrently.

Each agent prompt MUST include:
1. The specific task description
2. Which files/directories are in scope (and which are OFF LIMITS)
3. The instruction: "Do NOT modify files outside your scope. If you encounter build errors in files you didn't edit, ignore them — another agent may be mid-edit."
4. Whether to commit or leave changes uncommitted

### 4. Collect results

As agents complete (you'll be notified automatically), collect their results. Present a summary:

```
## Parallel Results

| # | Task | Status | Branch/Changes | Notes |
|---|------|--------|---------------|-------|
| 1 | Description | done | worktree: /path (branch: xxx) | summary |
| 2 | Description | done | worktree: /path (branch: xxx) | summary |
| 3 | Description | done | inline | summary |
```

### 5. Merge worktree results

For each completed worktree agent that made changes:
1. Show the user the diff: `git diff main...branch-name` (or `git diff HEAD...branch-name`)
2. Ask the user to confirm before merging
3. Merge with: `git merge --no-ff branch-name` or cherry-pick individual commits
4. If merge conflicts arise, present them to the user — do NOT auto-resolve

### 6. Clean up worktrees (with safety guards)

After ALL worktree results are merged (or discarded), clean up. **Always audit before deleting.**

#### Step 6a: Audit — find unmerged work BEFORE deleting anything
```bash
# List all worktree branches and check if they have commits not in dev
for branch in $(git branch | grep 'worktree-agent-' | tr -d ' '); do
  ahead=$(git rev-list --count dev..$branch 2>/dev/null || echo "0")
  if [ "$ahead" -gt "0" ]; then
    echo "⚠ UNMERGED: $branch ($ahead commits ahead of dev)"
    git log --oneline dev..$branch | head -3
    echo ""
  fi
done
```

If any branches show as UNMERGED:
1. **Ask the user** if those changes should be merged or discarded
2. Cherry-pick or merge any wanted commits BEFORE proceeding
3. Only continue cleanup after user confirms unmerged work is handled

#### Step 6b: Safe removal — only delete merged/empty worktrees
```bash
# Remove worktree directories (force needed for dirty worktrees)
for dir in .claude/worktrees/agent-*; do
  [ -d "$dir" ] || continue
  git worktree remove --force "$dir" 2>/dev/null
done

# Delete ONLY branches that are fully merged into dev
git branch --merged dev | grep 'worktree-agent-' | xargs -r git branch -d 2>/dev/null

# For unmerged branches the user confirmed to discard:
# git branch -D worktree-agent-XXXX  (capital -D forces delete)

# Prune stale worktree metadata
git worktree prune
```

#### Step 6c: Verify cleanup
```bash
echo "Remaining worktree dirs: $(ls -d .claude/worktrees/agent-* 2>/dev/null | wc -l)"
echo "Remaining worktree branches: $(git branch | grep worktree-agent | wc -l)"
echo "Git worktrees: $(git worktree list | wc -l)"
```

**Safety guards:**
- NEVER delete branches without checking `git rev-list --count dev..$branch` first
- NEVER force-delete (`-D`) a branch that has unmerged commits without user confirmation
- Use `git branch -d` (lowercase) for merged branches — git refuses if not merged
- Always audit (Step 6a) before removal (Step 6b)
- Log which branches were skipped as unmerged so nothing is silently lost

**When to clean up:**
- After every `/parallel` session's merges are complete
- When worktree count exceeds ~20 (check with `ls .claude/worktrees/agent-* | wc -l`)
- Before deploying (stale worktrees waste disk space)

**Do NOT clean up** while agents are still running — their worktrees are active.

---

## Scope Rules for This Project

These are the natural isolation boundaries in the Shift codebase:

| Scope | Directory/Files | Safe to parallelize with |
|-------|----------------|--------------------------|
| `frontend` | `frontend/**` | backend, data, docs, tests |
| `backend-routes` | `app/routers/**` | frontend, data, docs (NOT services if route calls service) |
| `backend-services` | `app/services/**` | frontend, data, docs |
| `backend-models` | `app/models.py` | **NEVER parallelize** — single file, high conflict risk |
| `data` | `data/**`, `scripts/seed_*` | frontend, backend, docs |
| `templates` | `templates/**` | frontend, data, docs (NOT backend if route renders template) |
| `docs` | `docs/**` | everything |
| `tests` | `tests/**` | docs (careful with backend — tests import app code) |
| `css` | `static/css/**`, `static/styles.css` | backend, data, docs, tests |

### Hard rules
- **`app/models.py`** — Never parallelize. All schema work is serial.
- **`app/db.py`** — Never parallelize. Database setup is serial.
- **Chrome DevTools MCP** — One agent at a time. Queue others.
- **`app/main.py`** — Rarely parallelize. Router registration changes affect everything.

---

## Agent Roles

Beyond basic worker agents, use these specialized roles for larger initiatives:

### PM Agent (Project Manager)
Use when a workstream has 2+ workers and needs coordination. The PM agent:
- **Reads** the codebase, benchmark data, INDEX.md BL records, and audit/ findings BEFORE workers start
- **Writes a plan** with measurable KPIs and clear scope per worker
- **Audits** worker output against KPIs after completion
- **Works with the Scribe** to document findings

Launch PMs **before** workers when possible (sequential: PM plans → workers implement). If launching all in parallel, embed enough context in each worker prompt so they don't need PM output.

**PM prompt template:**
```
You are the PM for [workstream]. Your job is to analyze, define KPIs, and write a plan.
1. Read [relevant files] to understand current state
2. Read docs/reference/INDEX.md for existing BL records
3. Check audit/ folder for existing findings
4. Write a plan to audit/pm_[workstream]_plan.md with:
   - Objectives and WHY
   - Measurable KPIs (with baselines)
   - Worker A scope / Worker B scope
   - Audit checklist
   - Risks
DO NOT write code. Only analyze and write the plan.
```

### Scribe Agent
Use for any initiative that produces measurable results. The Scribe:
- **Documents** baseline metrics before changes
- **Creates** benchmark reports in audit/
- **Tracks** KPIs with before/after tables
- **Updates** docs (HANDOFF.md, SESSION_STATE.md, INDEX.md) with new BL records

Launch the Scribe in parallel with workers — it writes to docs/audit (non-overlapping with code changes).

**Scribe prompt template:**
```
You are the Scribe for [initiative]. Create documentation:
1. audit/[initiative]_baseline.md — pre-change metrics
2. audit/[initiative]_kpis.md — KPI tracking table
3. Update docs/reference/INDEX.md with new BL records
4. Get current git commit hash for the report header
Commit your docs.
```

### Combining Roles (Large Initiatives)
For a 4-part optimization with 2 workers each:

| Agent | Role | Isolation | Runs |
|-------|------|-----------|------|
| PM Part 1 | Analyze + plan | main repo | background |
| PM Part 2 | Analyze + plan | main repo | background |
| Worker 1A | Implement | worktree | background |
| Worker 1B | Implement | worktree | background |
| Worker 2A | Implement | worktree | background |
| Worker 2B | Implement | worktree | background |
| Scribe | Document | main repo (docs/) | background |

**Lesson learned**: PMs are most valuable when run BEFORE workers (sequential). Running PMs and workers all in parallel means PMs can't guide workers — they become expensive research agents instead. Sequential PM → parallel workers is the better pattern when you have time.

---

## Example invocations

### Two independent features
```
/parallel
1. Add a "notes" column to the Export page table (frontend/)
2. Create a new /api/v2/students/{id}/notes endpoint (app/routers/api_v2.py, app/services/)
```

### Three-way split
```
/parallel
1. Fix the student list click handler (frontend/components/students/)
2. Write tests for the transfer endpoint (tests/)
3. Update HANDOFF.md with today's progress (docs/)
```

### Research + build
```
/parallel
1. Research how ESL/HSD programs are structured — read data/seeds/ and docs/reference/
2. Build the Add Student page (frontend/components/students/AddStudent.tsx)
```

### PM + Workers + Scribe (large initiative)
```
/parallel
Phase: React Performance Optimization

PM agents (analysis only, no worktree):
1. PM Part 1: Analyze code splitting opportunities, write plan to audit/
2. PM Part 2: Analyze memory leaks, write plan to audit/

Worker agents (worktree isolated):
3. Worker 1A: Convert App.tsx imports to React.lazy()
4. Worker 1B: Create ErrorBoundary + Suspense components
5. Worker 2A: Configure react-query cache limits
6. Worker 2B: Add route-change cache cleanup

Scribe (docs only, no worktree):
7. Scribe: Create baseline benchmark report + KPI tracking in audit/
```

### Audit agents (investigation, no code changes)
```
/parallel
Audit all admin tables for drill-down pattern candidates:
1. Audit SPS/SCS/CLS/PERS (GenericIssueTable) — check row counts + grouping potential
2. Audit ComplianceDashboard — check if parent-child relationship exists
3. Audit FinancialAid + Canvas — check data model for grouping
4. Audit Absences + Workshops + SMS — check remaining tables
```
