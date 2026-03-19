#!/usr/bin/env bash
# generate-types.sh
#
# Generates typed models from the canonical JSON Schema contract files:
#   1. Pydantic models (Python) via datamodel-code-generator
#   2. TypeScript interfaces via json-schema-to-typescript (npm)
#
# Output goes to contracts/generated/{python,typescript}/.
# Both output directories are wiped and recreated on each run to avoid stale types.
#
# Prerequisites:
#   pip install -r infra/scripts/requirements-codegen.txt
#   npm install -g json-schema-to-typescript
#
# Usage:
#   ./infra/scripts/generate-types.sh

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SCHEMA_DIR="$REPO_ROOT/contracts/json-schema"
PYTHON_OUT="$REPO_ROOT/contracts/generated/python"
TS_OUT="$REPO_ROOT/contracts/generated/typescript"

# ── Preflight checks ──────────────────────────────────────────────────────────

if ! command -v datamodel-codegen &>/dev/null; then
  echo "ERROR: datamodel-codegen not found."
  echo "       pip install -r infra/scripts/requirements-codegen.txt"
  exit 1
fi

if ! command -v json2ts &>/dev/null; then
  echo "ERROR: json2ts (json-schema-to-typescript) not found."
  echo "       npm install -g json-schema-to-typescript"
  exit 1
fi

if [ ! -d "$SCHEMA_DIR" ]; then
  echo "ERROR: Schema directory not found: $SCHEMA_DIR"
  exit 1
fi

# ── Clean output directories ──────────────────────────────────────────────────

echo "Cleaning output directories..."
rm -rf "$PYTHON_OUT" "$TS_OUT"
mkdir -p "$PYTHON_OUT" "$TS_OUT"

# ── Generate Pydantic models ─────────────────────────────────────────────────

echo ""
echo "Generating Pydantic models..."

py_count=0
for schema_file in "$SCHEMA_DIR"/*.schema.json; do
  basename="$(basename "$schema_file" .schema.json)"
  # Convert kebab-case to snake_case for Python module names
  module_name="$(echo "$basename" | tr '-' '_')"
  output_file="$PYTHON_OUT/${module_name}.py"

  datamodel-codegen \
    --input "$schema_file" \
    --input-file-type jsonschema \
    --output "$output_file" \
    --output-model-type pydantic_v2.BaseModel \
    --target-python-version 3.12 \
    --use-standard-collections \
    --use-union-operator \
    --field-constraints \
    --capitalise-enum-members \
    --use-double-quotes \
    --collapse-root-models

  py_count=$((py_count + 1))
  echo "  ✓ $basename → $module_name.py"
done

# Generate __init__.py that re-exports everything
init_file="$PYTHON_OUT/__init__.py"
echo '"""Auto-generated Pydantic models from contracts/json-schema/. DO NOT EDIT."""' > "$init_file"
for py_file in "$PYTHON_OUT"/*.py; do
  mod="$(basename "$py_file" .py)"
  if [ "$mod" != "__init__" ]; then
    echo "from .${mod} import *  # noqa: F401, F403" >> "$init_file"
  fi
done

# ── Generate TypeScript types ────────────────────────────────────────────────

echo ""
echo "Generating TypeScript types..."

ts_count=0
for schema_file in "$SCHEMA_DIR"/*.schema.json; do
  basename="$(basename "$schema_file" .schema.json)"
  # Convert kebab-case to camelCase for TS file names
  ts_filename="$(echo "$basename" | sed -E 's/-([a-z])/\U\1/g')"
  output_file="$TS_OUT/${ts_filename}.ts"

  json2ts \
    --input "$schema_file" \
    --output "$output_file" \
    --bannerComment "/* Auto-generated from contracts/json-schema/${basename}.schema.json — DO NOT EDIT */" \
    --unreachableDefinitions

  ts_count=$((ts_count + 1))
  echo "  ✓ $basename → ${ts_filename}.ts"
done

# Generate index.ts barrel export
index_file="$TS_OUT/index.ts"
echo "/* Auto-generated barrel export — DO NOT EDIT */" > "$index_file"
for ts_file in "$TS_OUT"/*.ts; do
  mod="$(basename "$ts_file" .ts)"
  if [ "$mod" != "index" ]; then
    echo "export * from \"./${mod}\";" >> "$index_file"
  fi
done

# ── Summary ──────────────────────────────────────────────────────────────────

echo ""
echo "═══════════════════════════════════════════"
echo " Code generation complete"
echo "═══════════════════════════════════════════"
echo ""
echo " Python (Pydantic v2):  $py_count models → $PYTHON_OUT/"
echo " TypeScript:            $ts_count types  → $TS_OUT/"
echo ""
echo " Files generated:"
echo ""
echo " Python:"
ls -1 "$PYTHON_OUT"/*.py | while read -r f; do echo "   $(basename "$f")"; done
echo ""
echo " TypeScript:"
ls -1 "$TS_OUT"/*.ts | while read -r f; do echo "   $(basename "$f")"; done
echo ""
