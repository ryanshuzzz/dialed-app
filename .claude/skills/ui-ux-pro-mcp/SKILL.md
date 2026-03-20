---
name: ui-ux-pro-mcp
description: Use the UI/UX Pro MCP server (design search, palettes, typography, stack guidelines, landing patterns, design systems). Use when improving UI/UX, choosing colors or fonts, accessibility, dashboards or landing layouts, React/Tailwind/shadcn patterns, or when the user mentions ui-ux-pro-mcp, design system, or curated design references.
---

# UI/UX Pro MCP

[MCP server](https://modelcontextprotocol.io/) backed by **1,900+ curated design documents** (BM25 search). Source: **[redf0x1/ui-ux-pro-mcp](https://github.com/redf0x1/ui-ux-pro-mcp)** (npm: `ui-ux-pro-mcp`). Data lineage: [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill).

## Install (Cursor / VS Code)

Add to MCP config (e.g. Cursor **Settings → MCP** or user `mcp.json`):

```json
{
  "mcpServers": {
    "ui-ux-pro": {
      "command": "npx",
      "args": ["ui-ux-pro-mcp", "--stdio"]
    }
  }
}
```

Requires Node/npm on `PATH`. Alternative: `npm i -g ui-ux-pro-mcp` then `"command": "ui-ux-pro-mcp"`, `"args": ["--stdio"]`. Restart the editor after changes.

## When to use it

- Pick **UI style**, **color palette**, **typography**, or **chart** choices before coding.
- **UX / accessibility** (forms, touch targets, WCAG) — use `search_ux_guidelines`.
- **Framework-specific** guidance — `search_stack` with `stack_name` (e.g. `react`, `nextjs`, `html-tailwind`, `shadcn`).
- **One-shot design system** — `get_design_system` (see upstream README for `mode: "dark"` and `_meta` intent).
- **iOS / Android** — queries with platform keywords (e.g. `ios`, `material 3`) bias platform CSV results per upstream docs.

## How to work with the tools

1. **Discover tools** in the MCP descriptors folder your environment exposes (or list tools in the client).
2. **Read each tool’s schema** before calling (required parameters, `max_results` caps, etc.).
3. Prefer **narrow tools** (`search_colors`, `search_typography`, …) over `search_all` unless the question spans domains.
4. Pass **concrete queries** (“fintech dashboard dark mode”, “accessible form labels”, “SaaS pricing section”).
5. Apply results to **this repo’s stack**: `frontend/` is **React 19 + TypeScript + Vite + Tailwind** — align recommendations with existing components and tokens; do not replace the product’s design system wholesale without an explicit request.

## Tool map (quick reference)

| Tool | Use for |
|------|--------|
| `search_ui_styles` | Visual styles (glassmorphism, brutalism, …) |
| `search_colors` | Industry palettes, hex codes |
| `search_typography` | Pairings, Google Fonts, Tailwind hints |
| `search_charts` | Dashboard / viz choices |
| `search_ux_guidelines` | UX + a11y practices |
| `search_icons` | Lucide-oriented icon picks |
| `search_landing` | Landing / marketing patterns |
| `search_products` | Product-type / industry UX |
| `search_prompts` | Templates / implementation checklists |
| `search_stack` | React, Vue, Next.js, Flutter, etc. |
| `search_all` | Broad exploratory query |
| `get_design_system` | Bundled system in one call |

**`search_stack`:** supply `stack_name` per upstream (e.g. `react`, `nextjs`, `html-tailwind`, `shadcn`).

## If the MCP is unavailable

Fall back to **browser-test** / **design-review** skills and project conventions (`frontend/src`, Tailwind, existing layouts). Suggest the user add the JSON block above and reload MCP.

## Links

- Repo & full API: [github.com/redf0x1/ui-ux-pro-mcp](https://github.com/redf0x1/ui-ux-pro-mcp)
- npm: [ui-ux-pro-mcp](https://www.npmjs.com/package/ui-ux-pro-mcp)
