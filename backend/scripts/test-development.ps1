# Synthetic checks only: never reads or writes the real saved credential.
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$fixtureFolder = Join-Path $env:TEMP ('nurseflow-credential-test-' + [guid]::NewGuid().ToString('N'))
$fixturePath = Join-Path $fixtureFolder 'credential.xml'
$fixtureCertificate = Join-Path $fixtureFolder 'certificate.crt'
$fixturePassword = 'synthetic-credential-test-only'
$global:fixtureGoExitCode = 0

function global:Read-Host {
    param([string]$Prompt, [switch]$AsSecureString)
    if (-not $AsSecureString) { throw 'Unexpected non-password prompt' }
    ConvertTo-SecureString 'synthetic-credential-test-only' -AsPlainText -Force
}

function global:go {
    if ($env:NURSEFLOW_DB_PASSWORD -ne 'synthetic-credential-test-only') {
        throw 'Command did not receive the decrypted synthetic credential'
    }
    if ($env:NURSEFLOW_DB_HOST -ne 'aws-0-us-east-1.pooler.supabase.com') {
        throw 'Unexpected development host'
    }
    if ($args[0] -eq 'test' -and ($env:NURSEFLOW_TEST_DATABASE_URL -or $env:NURSEFLOW_DATABASE_TESTS -ne '1')) {
        throw 'Live check did not clear the local override and enable integration tests'
    }
    $global:LASTEXITCODE = $global:fixtureGoExitCode
}

$originalPassword = $env:NURSEFLOW_DB_PASSWORD
$originalOverride = $env:NURSEFLOW_TEST_DATABASE_URL
New-Item -ItemType Directory -Path $fixtureFolder | Out-Null
Set-Content -LiteralPath $fixtureCertificate -Value 'Synthetic public certificate fixture'
try {
    $env:NURSEFLOW_DB_PASSWORD = 'previous-process-value'
    $env:NURSEFLOW_TEST_DATABASE_URL = 'previous-local-override'
    $output = & "$PSScriptRoot/development.ps1" Save -CredentialPath $fixturePath -CertificatePath $fixtureCertificate 6>&1
    if (-not (Test-Path -LiteralPath $fixturePath)) { throw 'Verified credential was not saved' }
    if ([System.IO.File]::ReadAllText($fixturePath).Contains($fixturePassword) -or (($output | Out-String).Contains($fixturePassword))) {
        throw 'Synthetic password appeared in saved plaintext or output'
    }
    $loaded = Import-Clixml -LiteralPath $fixturePath
    if ($loaded.Credential.GetNetworkCredential().Password -ne $fixturePassword) {
        throw 'Windows DPAPI credential round trip failed'
    }
    & "$PSScriptRoot/development.ps1" Check -CredentialPath $fixturePath
    & "$PSScriptRoot/development.ps1" TestTemplates -CredentialPath $fixturePath
    if ($env:NURSEFLOW_DB_PASSWORD -ne 'previous-process-value' -or $env:NURSEFLOW_TEST_DATABASE_URL -ne 'previous-local-override') {
        throw 'The helper did not restore the process environment'
    }
    $savedBeforeFailure = [System.IO.File]::ReadAllText($fixturePath)
    $global:fixtureGoExitCode = 1
    $failed = $false
    try {
        & "$PSScriptRoot/development.ps1" Save -CredentialPath $fixturePath -CertificatePath $fixtureCertificate
    } catch {
        $failed = $true
    }
    if (-not $failed -or [System.IO.File]::ReadAllText($fixturePath) -ne $savedBeforeFailure) {
        throw 'Failed connection overwrote the saved credential'
    }
    if ($env:NURSEFLOW_DB_PASSWORD -ne 'previous-process-value') {
        throw 'Failure did not restore the process environment'
    }
    Write-Output 'PASS: DPAPI round trip, no plaintext/output leakage, environment restoration, live-test settings, and failed-save protection.'
} finally {
    $env:NURSEFLOW_DB_PASSWORD = $originalPassword
    $env:NURSEFLOW_TEST_DATABASE_URL = $originalOverride
    Remove-Item Function:go, Function:Read-Host
    # Only the two explicitly named synthetic fixture files are removed.
    Remove-Item -LiteralPath $fixturePath,$fixtureCertificate -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $fixtureFolder -ErrorAction SilentlyContinue
}
