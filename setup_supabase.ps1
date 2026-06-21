# WomenSafe Supabase Setup and Deployment Script
# This script automates logging in, linking, pushing database schema, and deploying Edge Functions.

$ProjectRef = "htrmibvimwvldtoncxuw"

# Read .env file to get RESEND_API_KEY
$ResendKey = ""
if (Test-Path ".env") {
    $EnvContent = Get-Content ".env"
    foreach ($Line in $EnvContent) {
        if ($Line -match "^RESEND_API_KEY=(.+)$") {
            $ResendKey = $Matches[1].Trim()
        }
    }
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " WomenSafe Supabase Deployment Wizard" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Supabase login
Write-Host "[1/5] Checking Supabase Login..." -ForegroundColor Yellow
$LoginCheck = npx supabase projects list 2>&1
if ($LoginCheck -match "login") {
    Write-Host "You are not logged in to the Supabase CLI." -ForegroundColor Yellow
    Write-Host "Please generate a Personal Access Token here:" -ForegroundColor Gray
    Write-Host "https://supabase.com/dashboard/account/tokens" -ForegroundColor Blue
    Write-Host ""
    $Token = Read-Host "Paste your Personal Access Token"
    if ([string]::IsNullOrEmpty($Token)) {
        Write-Error "Access Token is required to proceed."
        exit 1
    }
    Write-Host "Logging in..." -ForegroundColor Yellow
    npx supabase login --token $Token
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to log in to Supabase CLI."
        exit 1
    }
    Write-Host "Successfully logged in!" -ForegroundColor Green
} else {
    Write-Host "Already logged in to Supabase CLI." -ForegroundColor Green
}
Write-Host ""

# 2. Link local project
Write-Host "[2/5] Linking to project $ProjectRef..." -ForegroundColor Yellow
Write-Host "You will need your Supabase Database Password (created when you created the project)." -ForegroundColor Gray
$DbPassword = Read-Host "Enter your Supabase Database Password" -AsSecureString
$BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($DbPassword)
$PlainPassword = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)

if ([string]::IsNullOrEmpty($PlainPassword)) {
    Write-Error "Database password is required to link the project."
    exit 1
}

npx supabase link --project-ref $ProjectRef --password $PlainPassword
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to link Supabase project. Please verify your password."
    exit 1
}
Write-Host "Project successfully linked!" -ForegroundColor Green
Write-Host ""

# 3. Push migrations
Write-Host "[3/5] Pushing Database migrations..." -ForegroundColor Yellow
npx supabase db push --password $PlainPassword
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to push migrations to the database."
    exit 1
}
Write-Host "Database schema created successfully!" -ForegroundColor Green
Write-Host ""

# 4. Deploy Edge Functions
Write-Host "[4/5] Deploying Edge Functions..." -ForegroundColor Yellow
Write-Host "Deploying 'send-emergency-notification'..." -ForegroundColor Gray
npx supabase functions deploy send-emergency-notification --no-verify-jwt --project-ref $ProjectRef
Write-Host "Deploying 'send-broadcast-message'..." -ForegroundColor Gray
npx supabase functions deploy send-broadcast-message --project-ref $ProjectRef
Write-Host "Deploying 'send-individual-message'..." -ForegroundColor Gray
npx supabase functions deploy send-individual-message --project-ref $ProjectRef
Write-Host "Edge Functions deployed successfully!" -ForegroundColor Green
Write-Host ""

# 5. Set Resend API Key in Supabase Secrets
Write-Host "[5/5] Configuring Resend API Key..." -ForegroundColor Yellow
if ([string]::IsNullOrEmpty($ResendKey) -or $ResendKey -eq "your_resend_api_key") {
    $ResendKey = Read-Host "Resend API Key not found in .env. Please enter it now"
}

if (![string]::IsNullOrEmpty($ResendKey) -and $ResendKey -ne "your_resend_api_key") {
    Write-Host "Setting RESEND_API_KEY secret on Supabase..." -ForegroundColor Gray
    npx supabase secrets set "RESEND_API_KEY=$ResendKey" --project-ref $ProjectRef
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "Failed to set RESEND_API_KEY secret. You may need to set it manually in Supabase Project Settings."
    } else {
        Write-Host "RESEND_API_KEY configured successfully!" -ForegroundColor Green
    }
} else {
    Write-Warning "No Resend API Key provided. Edge Functions will fail to send emails until configured."
}
Write-Host ""

Write-Host "========================================" -ForegroundColor Green
Write-Host " Supabase Backend Setup Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host "You can now test the frontend locally by running: npm run dev" -ForegroundColor Cyan
