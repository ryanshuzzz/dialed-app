# Token-efficient Agent usage

Reference doc for how we use Cursor Agent in this repo. For automatic hints to the model, see `.cursor/rules/token-efficiency.mdc`.

## Defaults for every Agent task

- Start with **one tight goal** plus **definition of done** (e.g. “tests green in X”, “no docs”).
- State **out of scope** explicitly (folders or features not to touch).
- If the target file is known, **name it** and prefer **no broad repo exploration** unless blocked.
- Prefer **one message with a short checklist** over many tiny follow-ups (each follow-up re-sends context).

## Threads

- **New chat when the task pivots** (new feature, new bug, new area). Avoid unrelated history in one thread.
- Paste only **minimal context**: error snippet, path, and about **10–30 relevant lines**—not whole files or huge logs.

## Agent behavior

- Ask for **short outputs**: bullets + files touched + commands run; avoid long essays unless debugging.
- Request **minimal diffs**: only change what is required for the task.
- Avoid **parallel sub-agents** unless tasks are truly independent and large.

## Context hygiene

- Close unrelated editor tabs when practical before a long Agent run.
- Do not `@` huge directories; `@` specific files.
- Keep stable project facts in **AGENTS.md** / Cursor rules so they are not repeated every chat.

## Tradeoff

**Agent plus many pivots** uses more tokens by design. Savings come from **fewer turns**, **smaller scope**, **fresh chats on pivot**, and **no unnecessary exploration**.
