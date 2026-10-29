<#
.SYNOPSIS
One-time, re-runnable setup of NurseFlow's hosted development environment on Google Cloud.

.DESCRIPTION
Creates, or confirms, everything the two deploy workflows need:
  - the GCP project, linked to billing, with the required APIs enabled
  - an Artifact Registry repository for the container images
  - one runtime service account per Cloud Run service, plus a deployer account
  - the database password and solver token in Secret Manager
  - Workload Identity Federation, so GitHub Actions can deploy without a stored Google key
  - the branch-restricted "gcp-development" GitHub environment and its non-secret variables

Every step checks before it creates, so running the script again only fills in
what is missing. Secret values are never printed, written to disk, or passed on
a command line: you type the database password at a hidden prompt, the solver
token is generated here, and both are sent to Secret Manager through stdin.

Requires Windows, the gcloud CLI signed in (gcloud auth login), and the GitHub
CLI signed in with admin access to the repository (gh auth login).

.EXAMPLE
./deploy/development/bootstrap-gcp.ps1 -ProjectId nurseflow-dev-1234 -BillingAccount 012345-6789AB-CDEF01
#>
param(
    # GCP project IDs are globally unique; choose one such as nurseflow-dev-<suffix>.
    [Parameter(Mandatory)]
    [string]$ProjectId,
    # Needed only the first time, if the project is not linked to billing yet.
    [string]$BillingAccount,
    [switch]$RotateDatabasePassword,
    [switch]$RotateSolverToken
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$Region = 'us-east4'
$Repository = 'nurseflow'
$GitHubRepository = 'pratham124/nurse-flow'
# Trust the numeric repository ID, which stays the same even if the repository
# is renamed or a different repository later takes the same name.
$GitHubRepositoryId = '1225352400'
$GitHubBranch = 'codex/go-migration'
$GitHubEnvironment = 'gcp-development'
$Pool = 'github'
$Provider = 'nurseflow-deploy'
$ApiAccount = "nurseflow-api-dev@$ProjectId.iam.gserviceaccount.com"
$SolverAccount = "nurseflow-solver-dev@$ProjectId.iam.gserviceaccount.com"
$DeployerAccount = "nurseflow-deployer@$ProjectId.iam.gserviceaccount.com"
$DatabaseSecret = 'nurseflow-db-password'
$SolverSecret = 'nurseflow-solver-token'

# Runs a command and stops the script if it fails. Windows PowerShell does not
# stop on a failing external command by itself. It uses $args rather than a
# param block so flags such as --project pass through unchanged.
function Invoke-Checked {
    $command, $arguments = $args
    & $command @arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Failed: $($args -join ' ')"
    }
}

# Returns $true when the gcloud command succeeds, hiding its output. Used for
# "does this already exist?" checks.
function Test-Gcloud {
    # Windows PowerShell turns redirected stderr into errors under 'Stop'.
    $ErrorActionPreference = 'Continue'
    & gcloud @args *> $null
    return ($LASTEXITCODE -eq 0)
}

function Write-Step([string]$Message) {
    Write-Host "`n== $Message" -ForegroundColor Cyan
}

# Sends the value to Secret Manager through stdin, without a trailing newline.
# (Piping a string to an external command in PowerShell would append one.)
function Add-SecretVersion([string]$Secret, [string]$Value) {
    $info = New-Object System.Diagnostics.ProcessStartInfo
    $info.FileName = $env:ComSpec
    $info.Arguments = "/d /c gcloud secrets versions add $Secret --project $ProjectId --data-file=-"
    $info.UseShellExecute = $false
    $info.RedirectStandardInput = $true
    # Windows PowerShell's process stdin otherwise starts with a UTF-8 byte
    # order mark, which would become part of the stored secret.
    $previousEncoding = [Console]::InputEncoding
    [Console]::InputEncoding = New-Object System.Text.UTF8Encoding $false
    try {
        $process = [System.Diagnostics.Process]::Start($info)
    } finally {
        [Console]::InputEncoding = $previousEncoding
    }
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($Value)
    $process.StandardInput.BaseStream.Write($bytes, 0, $bytes.Length)
    $process.StandardInput.Close()
    $process.WaitForExit()
    if ($process.ExitCode -ne 0) {
        throw "Could not add a version to secret $Secret."
    }
}

function Test-SecretHasVersion([string]$Secret) {
    $version = & gcloud secrets versions list $Secret --project $ProjectId --filter 'state=ENABLED' --limit 1 --format 'value(name)'
    if ($LASTEXITCODE -ne 0) {
        throw "Could not list versions of secret $Secret."
    }
    return [bool]$version
}

if ($env:OS -ne 'Windows_NT') {
    throw 'This script sends secrets through cmd.exe and requires Windows.'
}

Write-Step 'Checking signed-in tools'
foreach ($tool in 'gcloud', 'gh') {
    if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
        throw "$tool is not installed or not on PATH."
    }
}
$account = & gcloud auth list --filter 'status:ACTIVE' --format 'value(account)'
if (-not $account) {
    throw 'Run gcloud auth login first.'
}
Write-Host "gcloud account: $account"
Invoke-Checked gh auth status

Write-Step "Project $ProjectId"
if (-not (Test-Gcloud projects describe $ProjectId)) {
    Invoke-Checked gcloud projects create $ProjectId --name 'NurseFlow Dev'
}
$billingEnabled = & gcloud billing projects describe $ProjectId --format 'value(billingEnabled)'
if ($billingEnabled -ne 'True') {
    if (-not $BillingAccount) {
        throw 'The project is not linked to billing. Re-run with -BillingAccount (see: gcloud billing accounts list).'
    }
    Invoke-Checked gcloud billing projects link $ProjectId --billing-account $BillingAccount
}
$projectNumber = & gcloud projects describe $ProjectId --format 'value(projectNumber)'
if (-not $projectNumber) {
    throw 'Could not read the project number.'
}

Write-Step 'Enabling APIs'
Invoke-Checked gcloud services enable run.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com iam.googleapis.com iamcredentials.googleapis.com sts.googleapis.com --project $ProjectId

Write-Step "Artifact Registry repository $Repository ($Region)"
if (-not (Test-Gcloud artifacts repositories describe $Repository --location $Region --project $ProjectId)) {
    Invoke-Checked gcloud artifacts repositories create $Repository --repository-format docker --location $Region --description 'NurseFlow development images' --project $ProjectId
}

Write-Step 'Service accounts'
$accounts = @(
    @{ Email = $ApiAccount; Name = 'NurseFlow API (development runtime)' },
    @{ Email = $SolverAccount; Name = 'NurseFlow solver (development runtime)' },
    @{ Email = $DeployerAccount; Name = 'NurseFlow GitHub deployer' }
)
foreach ($serviceAccount in $accounts) {
    if (-not (Test-Gcloud iam service-accounts describe $serviceAccount.Email --project $ProjectId)) {
        $id = $serviceAccount.Email.Split('@')[0]
        Invoke-Checked gcloud iam service-accounts create $id --display-name $serviceAccount.Name --project $ProjectId
    }
}

Write-Step 'Secrets'
foreach ($secret in $DatabaseSecret, $SolverSecret) {
    if (-not (Test-Gcloud secrets describe $secret --project $ProjectId)) {
        Invoke-Checked gcloud secrets create $secret --replication-policy automatic --project $ProjectId
    }
}
if ($RotateDatabasePassword -or -not (Test-SecretHasVersion $DatabaseSecret)) {
    # The limited nurseflow_go password for the DEVELOPMENT Supabase project only.
    $secure = Read-Host 'Development nurseflow_go database password (hidden)' -AsSecureString
    $password = [System.Net.NetworkCredential]::new('', $secure).Password
    if (-not $password) {
        throw 'The password must not be empty.'
    }
    Add-SecretVersion $DatabaseSecret $password
    $password = $null
    Write-Host 'Stored a new database password version.'
} else {
    Write-Host 'Database password already stored (use -RotateDatabasePassword to replace it).'
}
if ($RotateSolverToken -or -not (Test-SecretHasVersion $SolverSecret)) {
    # 32 random bytes as hex. Nobody needs to know it: both services read it from Secret Manager.
    $bytes = New-Object byte[] 32
    $random = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $random.GetBytes($bytes)
    $random.Dispose()
    Add-SecretVersion $SolverSecret (($bytes | ForEach-Object { $_.ToString('x2') }) -join '')
    Write-Host 'Stored a new solver token version. Re-run both deploy workflows so running instances pick it up.'
} else {
    Write-Host 'Solver token already stored (use -RotateSolverToken to replace it).'
}

Write-Step 'Permissions'
# Each runtime account can read only the secrets its service uses.
Invoke-Checked gcloud secrets add-iam-policy-binding $DatabaseSecret --member "serviceAccount:$ApiAccount" --role roles/secretmanager.secretAccessor --project $ProjectId --format none
foreach ($runtime in $ApiAccount, $SolverAccount) {
    Invoke-Checked gcloud secrets add-iam-policy-binding $SolverSecret --member "serviceAccount:$runtime" --role roles/secretmanager.secretAccessor --project $ProjectId --format none
}
# The deployer can push images, manage the Cloud Run services (including making
# them publicly reachable), and attach the two runtime accounts. It has no secret
# access itself, but code it deploys runs as those accounts, so whoever can push
# to the deploy branch can, in effect, reach the secrets.
Invoke-Checked gcloud artifacts repositories add-iam-policy-binding $Repository --location $Region --member "serviceAccount:$DeployerAccount" --role roles/artifactregistry.writer --project $ProjectId --format none
Invoke-Checked gcloud projects add-iam-policy-binding $ProjectId --member "serviceAccount:$DeployerAccount" --role roles/run.admin --condition None --format none
foreach ($runtime in $ApiAccount, $SolverAccount) {
    Invoke-Checked gcloud iam service-accounts add-iam-policy-binding $runtime --member "serviceAccount:$DeployerAccount" --role roles/iam.serviceAccountUser --project $ProjectId --format none
}

Write-Step 'Workload Identity Federation for GitHub Actions'
if (-not (Test-Gcloud iam workload-identity-pools describe $Pool --location global --project $ProjectId)) {
    Invoke-Checked gcloud iam workload-identity-pools create $Pool --location global --display-name 'GitHub Actions' --project $ProjectId
}
# Google accepts a GitHub token only from this repository, on this branch, in
# the gcp-development environment.
$mapping = 'google.subject=assertion.sub,attribute.repository_id=assertion.repository_id,attribute.ref=assertion.ref,attribute.environment=assertion.environment'
$condition = "assertion.repository_id == '$GitHubRepositoryId' && assertion.ref == 'refs/heads/$GitHubBranch' && assertion.environment == '$GitHubEnvironment'"
$providerVerb = 'create-oidc'
if (Test-Gcloud iam workload-identity-pools providers describe $Provider --workload-identity-pool $Pool --location global --project $ProjectId) {
    $providerVerb = 'update-oidc'
}
Invoke-Checked gcloud iam workload-identity-pools providers $providerVerb $Provider --workload-identity-pool $Pool --location global --issuer-uri 'https://token.actions.githubusercontent.com' --attribute-mapping $mapping --attribute-condition $condition --project $ProjectId
$principal = "principalSet://iam.googleapis.com/projects/$projectNumber/locations/global/workloadIdentityPools/$Pool/attribute.repository_id/$GitHubRepositoryId"
Invoke-Checked gcloud iam service-accounts add-iam-policy-binding $DeployerAccount --member $principal --role roles/iam.workloadIdentityUser --project $ProjectId --format none

Write-Step "GitHub environment $GitHubEnvironment"
Invoke-Checked gh api --method PUT "repos/$GitHubRepository/environments/$GitHubEnvironment" -F 'deployment_branch_policy[protected_branches]=false' -F 'deployment_branch_policy[custom_branch_policies]=true' --silent
$branches = & gh api "repos/$GitHubRepository/environments/$GitHubEnvironment/deployment-branch-policies" --jq '.branch_policies[].name'
if ($LASTEXITCODE -ne 0) {
    throw 'Could not read the environment branch policies.'
}
if (@($branches) -notcontains $GitHubBranch) {
    Invoke-Checked gh api --method POST "repos/$GitHubRepository/environments/$GitHubEnvironment/deployment-branch-policies" -f "name=$GitHubBranch" -f 'type=branch' --silent
}
$variables = [ordered]@{
    GCP_PROJECT_ID = $ProjectId
    GCP_WORKLOAD_IDENTITY_PROVIDER = "projects/$projectNumber/locations/global/workloadIdentityPools/$Pool/providers/$Provider"
    GCP_DEPLOYER_SERVICE_ACCOUNT = $DeployerAccount
}
foreach ($name in $variables.Keys) {
    Invoke-Checked gh variable set $name --env $GitHubEnvironment --repo $GitHubRepository --body $variables[$name]
}

Write-Host "`nSetup complete for $ProjectId." -ForegroundColor Green
Write-Host 'Next: push the branch. Deploy the solver first; if the API workflow ran before the solver existed, use "Re-run jobs" on it.'
Write-Host 'See docs/go-migration/hosted-development.md for verification and rollback.'
