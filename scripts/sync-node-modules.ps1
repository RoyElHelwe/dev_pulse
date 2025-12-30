# Script to copy node_modules from Docker containers to local machine
# This is needed for VSCode TypeScript support
# MUST RUN AS ADMINISTRATOR for symlinks to work on Windows

# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "This script requires Administrator privileges for symlinks." -ForegroundColor Yellow
    Write-Host "Restarting as Administrator..." -ForegroundColor Cyan
    
    # Restart script as administrator
    $scriptPath = $MyInvocation.MyCommand.Path
    Start-Process powershell.exe -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`"" -Verb RunAs -Wait
    exit
}

Write-Host "Setting up node_modules for local development..." -ForegroundColor Cyan
Write-Host "Running as Administrator" -ForegroundColor Green

# Change to project directory - use absolute path
$projectDir = "C:\Users\user\Desktop\Projects\42\ft_trans"
Write-Host "Changing to project directory: $projectDir" -ForegroundColor Gray
Set-Location $projectDir

# Verify we're in the right directory
Write-Host "Current directory: $(Get-Location)" -ForegroundColor Gray

# Remove any existing node_modules locally using cmd rmdir (more reliable)
Write-Host "`nCleaning up old node_modules..." -ForegroundColor Yellow
cmd /c "rmdir /s /q `"$projectDir\apps\api-gateway\node_modules`" 2>nul"
cmd /c "rmdir /s /q `"$projectDir\apps\web\node_modules`" 2>nul"
Write-Host "Cleaned up old node_modules" -ForegroundColor Gray

# Build fresh images to ensure node_modules are installed
Write-Host "`nBuilding images (this may take a while)..." -ForegroundColor Yellow
docker-compose build api-gateway web
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to build images!" -ForegroundColor Red
    Write-Host "`nPress any key to exit..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

# Copy from api-gateway using temporary container (avoids volume mount issues)
Write-Host "`nCopying api-gateway node_modules..." -ForegroundColor Yellow
docker rm -f temp_api_copy 2>&1 | Out-Null
docker run -d --name temp_api_copy ft_trans-api-gateway sleep 60
docker cp "temp_api_copy:/app/apps/api-gateway/node_modules" "$projectDir\apps\api-gateway\"
$apiCopyResult = $LASTEXITCODE
if ($apiCopyResult -eq 0) {
    Write-Host "API Gateway node_modules copied successfully" -ForegroundColor Green
} else {
    Write-Host "Failed to copy API Gateway node_modules (exit code: $apiCopyResult)" -ForegroundColor Red
}
docker rm -f temp_api_copy 2>&1 | Out-Null

# Copy from web using temporary container
Write-Host "`nCopying web node_modules..." -ForegroundColor Yellow
docker rm -f temp_web_copy 2>&1 | Out-Null
docker run -d --name temp_web_copy ft_trans-web sleep 60
docker cp "temp_web_copy:/app/apps/web/node_modules" "$projectDir\apps\web\"
$webCopyResult = $LASTEXITCODE
if ($webCopyResult -eq 0) {
    Write-Host "Web node_modules copied successfully" -ForegroundColor Green
} else {
    Write-Host "Failed to copy Web node_modules (exit code: $webCopyResult)" -ForegroundColor Red
}
docker rm -f temp_web_copy 2>&1 | Out-Null

# Verify node_modules exist
Write-Host "`nVerifying node_modules..." -ForegroundColor Yellow
$apiSuccess = Test-Path "$projectDir\apps\api-gateway\node_modules"
$webSuccess = Test-Path "$projectDir\apps\web\node_modules"

Write-Host "API Gateway node_modules exists: $apiSuccess" -ForegroundColor Gray
Write-Host "Web node_modules exists: $webSuccess" -ForegroundColor Gray

if ($apiSuccess -and $webSuccess) {
    Write-Host "`nSuccess! All node_modules are in place." -ForegroundColor Green
    Write-Host "Now reload VSCode window (Ctrl+Shift+P > Reload Window)" -ForegroundColor Cyan
} else {
    Write-Host "`nWarning: Some node_modules may be missing" -ForegroundColor Yellow
    if (-not $apiSuccess) { Write-Host "  - API Gateway node_modules not found" -ForegroundColor Red }
    if (-not $webSuccess) { Write-Host "  - Web node_modules not found" -ForegroundColor Red }
}

Write-Host "`nPress any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

