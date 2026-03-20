# generate-types.ps1 — Windows-friendly twin of generate-types.sh
# Generates Pydantic + TypeScript from contracts/json-schema/
#
# Prerequisites:
#   pip install -r infra/scripts/requirements-codegen.txt
#   Node/npx (uses: npx --yes json-schema-to-typescript)
#
# Usage (repo root):
#   powershell -NoProfile -ExecutionPolicy Bypass -File infra/scripts/generate-types.ps1

$ErrorActionPreference = 'Stop'

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$venvScripts = Join-Path $RepoRoot '.venv\Scripts'
if (Test-Path $venvScripts) {
    $env:PATH = "$venvScripts;$env:PATH"
}
# Avoid UnicodeEncodeError when schemas contain non-ASCII (e.g. in descriptions).
$env:PYTHONUTF8 = '1'
$SchemaDir = Join-Path $RepoRoot 'contracts\json-schema'
$PythonOut = Join-Path $RepoRoot 'contracts\generated\python'
$TsOut = Join-Path $RepoRoot 'contracts\generated\typescript'

function ConvertTo-SnakeCaseModule([string] $kebab) {
    return $kebab.Replace('-', '_')
}

function ConvertTo-CamelCaseFilename([string] $kebab) {
    $parts = $kebab -split '-'
    if ($parts.Count -eq 0) { return $kebab }
    $sb = [System.Text.StringBuilder]::new($parts[0])
    for ($i = 1; $i -lt $parts.Count; $i++) {
        $p = $parts[$i]
        if ($p.Length -gt 0) {
            [void]$sb.Append($p.Substring(0, 1).ToUpperInvariant())
            if ($p.Length -gt 1) { [void]$sb.Append($p.Substring(1)) }
        }
    }
    return $sb.ToString()
}

function Test-CommandAvailable([string] $Name) {
    return $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}

if (-not (Test-CommandAvailable 'datamodel-codegen')) {
    Write-Error "datamodel-codegen not found. Run: pip install -r infra/scripts/requirements-codegen.txt"
}

if (-not (Test-CommandAvailable 'npx')) {
    Write-Error "npx not found. Install Node.js (LTS) and ensure it is on PATH."
}

if (-not (Test-Path $SchemaDir)) {
    Write-Error "Schema directory not found: $SchemaDir"
}

Write-Host "Cleaning output directories..."
if (Test-Path $PythonOut) { Remove-Item -Recurse -Force $PythonOut }
if (Test-Path $TsOut) { Remove-Item -Recurse -Force $TsOut }
New-Item -ItemType Directory -Path $PythonOut -Force | Out-Null
New-Item -ItemType Directory -Path $TsOut -Force | Out-Null

Write-Host ""
Write-Host "Generating Pydantic models..."

$pyCount = 0
Get-ChildItem -Path $SchemaDir -Filter '*.schema.json' | ForEach-Object {
    $basename = $_.BaseName -replace '\.schema$', ''
    $moduleName = ConvertTo-SnakeCaseModule $basename
    $outputFile = Join-Path $PythonOut "$moduleName.py"

    & datamodel-codegen `
        --input $_.FullName `
        --input-file-type jsonschema `
        --output $outputFile `
        --output-model-type pydantic_v2.BaseModel `
        --target-python-version 3.12 `
        --use-standard-collections `
        --use-union-operator `
        --field-constraints `
        --capitalise-enum-members `
        --use-double-quotes `
        --collapse-root-models

    $pyCount++
    Write-Host "  OK $basename -> $moduleName.py"
}

$initFile = Join-Path $PythonOut '__init__.py'
@"
"""Auto-generated Pydantic models from contracts/json-schema/. DO NOT EDIT."""
"@ | Set-Content -Path $initFile -Encoding utf8
Get-ChildItem -Path $PythonOut -Filter '*.py' | ForEach-Object {
    $mod = $_.BaseName
    if ($mod -ne '__init__') {
        Add-Content -Path $initFile -Encoding utf8 -Value "from .$mod import *  # noqa: F401, F403"
    }
}

Write-Host ""
Write-Host "Generating TypeScript types..."

$tsCount = 0
Get-ChildItem -Path $SchemaDir -Filter '*.schema.json' | ForEach-Object {
    $basename = $_.BaseName -replace '\.schema$', ''
    $tsFilename = ConvertTo-CamelCaseFilename $basename
    $outputFile = Join-Path $TsOut "$tsFilename.ts"
    $banner = "/* Auto-generated from contracts/json-schema/$basename.schema.json - DO NOT EDIT */"

    & npx --yes json-schema-to-typescript `
        --input $_.FullName `
        --output $outputFile `
        --cwd $SchemaDir `
        --bannerComment $banner `
        --unreachableDefinitions

    $tsCount++
    Write-Host "  OK $basename -> ${tsFilename}.ts"
}

$indexFile = Join-Path $TsOut 'index.ts'
"/* Auto-generated barrel export - DO NOT EDIT */" | Set-Content -Path $indexFile -Encoding utf8
Get-ChildItem -Path $TsOut -Filter '*.ts' | ForEach-Object {
    $mod = $_.BaseName
    if ($mod -ne 'index') {
        Add-Content -Path $indexFile -Encoding utf8 -Value "export * from `"./$mod`";"
    }
}

Write-Host ""
Write-Host "==========================================="
Write-Host " Code generation complete"
Write-Host "==========================================="
Write-Host ""
Write-Host " Python (Pydantic v2):  $pyCount models -> $PythonOut\"
Write-Host " TypeScript:            $tsCount types  -> $TsOut\"
Write-Host ""
