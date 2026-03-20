---
name: design-review
description: Audit a page or component against UI/UX best practices using the ui-ux-pro MCP. Use when reviewing designs, building new UI, or improving existing pages.
disable-model-invocation: true
argument-hint: student detail page
---

# Design Review

Perform a UI/UX audit of a page or component using the ui-ux-pro MCP server's design intelligence database (1,920+ curated resources).

## Workflow

1. **Identify the target**: If `$ARGUMENTS` is provided, audit that page/component. Otherwise, ask what to review.

2. **Gather current state**:
   - Read the relevant template file(s) and CSS
   - If chrome-devtools MCP is available, take a screenshot for visual reference

3. **Search for best practices** using ui-ux-pro MCP tools:
   - `search_components` — Find component-specific patterns (e.g., "data table", "form wizard", "modal")
   - `search_patterns` — Find UX patterns (e.g., "progressive disclosure", "empty state", "error handling")
   - `search_styles` — Find styling guidance (e.g., "color contrast", "typography scale", "spacing")
   - `search_platforms` — Find platform-specific conventions (e.g., "web accessibility", "mobile responsive")
   - `search_stack` — Find tech-stack-specific guidance (e.g., "Jinja2 templates", "CSS variables")
   - `search_all` — Broad search across all categories

4. **Audit against findings**: Compare the current implementation against the best practices found. Check:
   - Accessibility (WCAG compliance, keyboard navigation, screen readers)
   - Visual hierarchy and spacing
   - Responsive behavior
   - Error states and empty states
   - Loading states
   - Consistency with existing design system (CSS vars in `static/styles.css`)

5. **Report findings** as a prioritized list:
   - **Critical** — Accessibility violations, broken interactions
   - **Important** — UX anti-patterns, missing states
   - **Nice-to-have** — Polish, micro-interactions, visual refinements

6. **Offer to fix**: For each finding, offer a concrete code change. Apply fixes if the user approves.

## Project Context

- Brand colors: `#003462` (navy), `#00B7A3` (teal) — CSS vars in `:root`
- Stack: Jinja2 templates + vanilla CSS + minimal JS
- Base template: `templates/base.html` (includes `templates/partials/nav.html`)
- Global styles: `static/styles.css`
