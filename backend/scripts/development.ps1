param(
    [ValidateSet('Save', 'Check', 'TestTemplates', 'TestTemplateWrites', 'TestShifts', 'Api')]
    [string]$Action = 'Check',
    [string]$CredentialPath = (Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'NurseFlow/go-dev-credential.xml'),
    [string]$CertificatePath = $env:NURSEFLOW_DB_SSLROOTCERT
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if ($env:OS -ne 'Windows_NT') {
    throw 'This helper requires Windows DPAPI encryption.'
}

if ($Action -eq 'Save') {
    if (-not $CertificatePath) {
        $CertificatePath = Read-Host 'Full path to the development Supabase certificate'
    }
    $CertificatePath = $CertificatePath.Trim('"')
    if (-not (Test-Path -LiteralPath $CertificatePath -PathType Leaf)) {
        throw 'The certificate file does not exist.'
    }
    $password = Read-Host 'Working nurseflow_go development password' -AsSecureString
    $settings = [pscustomobject]@{
        HostName = 'aws-0-us-east-1.pooler.supabase.com'
        CertificatePath = (Resolve-Path -LiteralPath $CertificatePath).Path
        Credential = [pscredential]::new('nurseflow_go', $password)
    }
} else {
    if (-not (Test-Path -LiteralPath $CredentialPath -PathType Leaf)) {
        throw 'No saved development credential. Run this helper with Save first.'
    }
    try {
        $settings = Import-Clixml -LiteralPath $CredentialPath
    } catch {
        throw 'Cannot decrypt the saved credential. Use the Windows account and computer that saved it.'
    }
    if ($settings.Credential -isnot [pscredential] -or $settings.Credential.UserName -ne 'nurseflow_go') {
        throw 'The saved credential must belong to the development nurseflow_go role.'
    }
    if (-not (Test-Path -LiteralPath $settings.CertificatePath -PathType Leaf)) {
        throw 'The saved certificate path is missing. Run Save with the current certificate path.'
    }
}

# Change only this process's environment, then restore it even if the command fails.
$environment = @{
    NURSEFLOW_DB_HOST = $settings.HostName
    NURSEFLOW_DB_PASSWORD = $settings.Credential.GetNetworkCredential().Password
    NURSEFLOW_DB_SSLROOTCERT = $settings.CertificatePath
}
if ($Action -in @('TestTemplates', 'TestTemplateWrites', 'TestShifts')) {
    $environment.NURSEFLOW_DATABASE_TESTS = '1'
    $environment.NURSEFLOW_TEST_DATABASE_URL = $null
    $environment.NURSEFLOW_TEST_ALPHA_ID = '4ea34fc9-d17b-411e-83a0-8a82cf9b8977'
    $environment.NURSEFLOW_TEST_BETA_ID = '5e7093ff-d8ea-4734-ae77-73a3906f936e'
    $environment.NURSEFLOW_TEST_REGULAR_ID = '712ae250-d0c6-4af4-b19e-ee7844d0c295'
}
$previous = @{}
foreach ($name in $environment.Keys) {
    $previous[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
}

Push-Location -LiteralPath (Split-Path -Parent $PSScriptRoot)
try {
    foreach ($name in $environment.Keys) {
        [Environment]::SetEnvironmentVariable($name, $environment[$name], 'Process')
    }
    switch ($Action) {
        'TestTemplates' { & go test ./internal/database -run '^TestTemplateListIsolationIntegration$' -v -count=1 }
        'TestTemplateWrites' { & go test ./internal/database -run '^TestTemplateWritesIntegration$' -v -count=1 }
        'TestShifts' { & go test ./internal/database -run '^TestShiftWorkspaceIsolationIntegration$' -v -count=1 }
        'Api' { & go run ./cmd/api }
        default { & go run ./cmd/dbcheck }
    }
    if ($LASTEXITCODE -ne 0) {
        throw 'Development command failed. No new credential was saved.'
    }
    if ($Action -eq 'Save') {
        # Export-Clixml encrypts the PSCredential password with Windows DPAPI.
        # Only save after dbcheck proves this password works for the limited role.
        $folder = Split-Path -Parent $CredentialPath
        if (-not (Test-Path -LiteralPath $folder)) {
            New-Item -ItemType Directory -Path $folder | Out-Null
        }
        $settings | Export-Clixml -LiteralPath $CredentialPath -Depth 4
        Write-Host 'Verified development credential saved with Windows DPAPI encryption.'
    }
} finally {
    foreach ($name in $previous.Keys) {
        [Environment]::SetEnvironmentVariable($name, $previous[$name], 'Process')
    }
    Pop-Location
    $environment.NURSEFLOW_DB_PASSWORD = $null
    $settings = $null
    $password = $null
}
