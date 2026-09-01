$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "Preparing PSNA Edmingle backend..." -ForegroundColor Cyan
Set-Location (Join-Path $ProjectRoot "backend")
if (-not (Test-Path ".env")) {
  Copy-Item ".env.example" ".env"
  Write-Host "Created backend\.env — add your real server-only keys." -ForegroundColor Yellow
}
npm install

Write-Host "Preparing PSNA teacher portal..." -ForegroundColor Cyan
Set-Location (Join-Path $ProjectRoot "portal")
if (-not (Test-Path ".env.local")) {
  Copy-Item ".env.example" ".env.local"
  Write-Host "Created portal\.env.local — add the public Supabase values." -ForegroundColor Yellow
}
npm install

Write-Host "Installation complete. Read START_HERE.md before running the SQL or sync." -ForegroundColor Green
Set-Location $ProjectRoot
