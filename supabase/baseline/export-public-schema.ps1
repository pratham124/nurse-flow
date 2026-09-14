# Run this yourself in an interactive PowerShell terminal.
# pg_dump prompts privately for the EXISTING database password.
# This reads production schema; it does not modify the database or copy records.
$ErrorActionPreference = 'Stop'
$dumpTool = (Get-Command pg_dump -ErrorAction Stop).Source
$exportStamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$exportPath = Join-Path $PSScriptRoot "public-schema-$exportStamp.sql"
$partialPath = "$exportPath.partial"

if ((Test-Path -LiteralPath $exportPath) -or (Test-Path -LiteralPath $partialPath)) {
    throw 'An export with this timestamp already exists. Wait a second and retry.'
}

# Session pooler parameters verified in the source project dashboard.
# Keep credentials out of this connection string and out of shell history.
$sourceConnection = 'host=aws-1-us-east-1.pooler.supabase.com port=5432 dbname=postgres user=postgres.mkljczezkyqtuplzedpj sslmode=require connect_timeout=15'
$dumpArguments = @(
    "--dbname=$sourceConnection"
    '--password'
    '--schema-only'
    '--schema=public'
    '--no-owner'
    '--quote-all-identifiers'
    '--lock-wait-timeout=10s'
    "--file=$partialPath"
)

& $dumpTool @dumpArguments
if ($LASTEXITCODE -ne 0) {
    throw "Schema export failed. Do not restore the incomplete file: $partialPath"
}
Move-Item -LiteralPath $partialPath -Destination $exportPath
Write-Host "Schema exported for review: $exportPath"
Write-Host 'Do not restore yet: cross-schema dependencies and Supabase compatibility still need review.'
