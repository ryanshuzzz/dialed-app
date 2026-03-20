---
name: gh
description: GitHub operations using the GitHub MCP server — create PRs, review code, manage issues, check CI. Use when working with GitHub repos.
disable-model-invocation: true
argument-hint: pr or issue 45
---

# GitHub Operations

Use the GitHub MCP server for repository operations without leaving the conversation.

## Usage

`/gh [action] [target]`

**Actions:**
- `/gh pr` — Create a pull request from the current branch
- `/gh pr 123` — Review PR #123 (diff, comments, checks)
- `/gh issues` — List open issues
- `/gh issue 45` — View issue #45 details
- `/gh checks` — Check CI status for current branch
- `/gh release` — View latest release info
- `/gh search [query]` — Search code/issues/PRs

## Workflows

### Create a PR
1. Check `git status` and `git log` for current branch state
2. Use GitHub MCP to create PR with title + body
3. Follow the PR template format:
   ```
   ## Summary
   - Bullet points of changes

   ## Test plan
   - [ ] How to verify
   ```

### Review a PR
1. Fetch PR details (title, description, author)
2. Fetch the diff (changed files)
3. Fetch comments and review status
4. Check CI/CD status
5. Provide review summary:
   - Changes overview
   - Potential issues found
   - Suggestions for improvement

### Triage Issues
1. List open issues with labels
2. Summarize each by priority/impact
3. Suggest assignees based on file ownership

## Fallback

If the GitHub MCP server is not connected or errors out, fall back to `gh` CLI commands via Bash:
- `gh pr create`, `gh pr view`, `gh pr diff`
- `gh issue list`, `gh issue view`
- `gh run list`, `gh run view`

## Setup Note

The GitHub MCP server requires a Personal Access Token. Set `GITHUB_PERSONAL_ACCESS_TOKEN` in the MCP config or environment.
