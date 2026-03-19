---
name: math
description: Use Euclid MCP tools for deterministic math — calculate, convert units, and compute statistics instead of mental math
user-invocable: false
---

# Euclid Math Tools

## Core Principle

If a user's request requires a numerical result, unit conversion, or statistical computation, use the Euclid MCP tools. Mental calculations are predictions — these tools provide certainty.

## Three Primary Tools

**calculate** — Mathematical expressions (arithmetic, trig, logarithms, factorials, combinatorics).
- Expression string + optional precision parameter
- See [EXPRESSIONS.md](EXPRESSIONS.md) for operators, functions, constants, Unicode support

**convert** — Unit conversions (length, mass, volume, temperature, speed, time, area, data).
- Value + source unit + target unit
- See [UNITS.md](UNITS.md) for all supported units and aliases

**statistics** — Dataset metrics (mean, median, mode, std, variance, min, max, sum, percentile).
- Operation name + data array + optional percentile param
- See [STATISTICS.md](STATISTICS.md) for all operations and data format

## When to Use

- Any computation with a single correct answer
- Percentages, factorials, combinatorics
- Unit conversions (including natural language like "celsius" → degC)
- Statistical analysis of number arrays

## When NOT to Use

- Conceptual explanations (no numeric answer needed)
- Rough estimates the user explicitly requested
- Symbolic algebra without numeric answers

## Key Rules

- Always invoke tools rather than doing mental math
- If errors occur, use the hint and examples to correct inputs
- Preserve full precision unless the user asks for rounding
- Unicode symbols (×, ÷, ², √, π) are normalized automatically
