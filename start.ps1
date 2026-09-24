# SalesSetu — Quick Start Launcher
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "   SalesSetu — AI Sales Operating System    " -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Cyan

$env:PATH = "C:\Program Files\nodejs;" + $env:PATH

# Check if backend node_modules exists
if (-not (Test-Path "backend\node_modules")) {
    Write-Host "`n[1/3] Installing Backend Dependencies..." -ForegroundColor Yellow
    Set-Location "backend"
    npm install
    Set-Location ".."
}

Write-Host "`n[2/3] Starting Backend API on http://localhost:5000..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "`$env:PATH = 'C:\Program Files\nodejs;' + `$env:PATH; cd '$PSScriptRoot\backend'; npm run dev"

Write-Host "`n[3/3] Starting Frontend Next.js on http://localhost:3000..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "`$env:PATH = 'C:\Program Files\nodejs;' + `$env:PATH; cd '$PSScriptRoot\frontend'; npm run dev"

Write-Host "`n============================================" -ForegroundColor Cyan
Write-Host " SalesSetu is launching!" -ForegroundColor Green
Write-Host " - Frontend: http://localhost:3000" -ForegroundColor White
Write-Host " - Backend:  http://localhost:5000" -ForegroundColor White
Write-Host "============================================" -ForegroundColor Cyan
