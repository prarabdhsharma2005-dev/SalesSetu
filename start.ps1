Write-Host "============================================" -ForegroundColor Cyan
Write-Host "   SalesSetu - AI Sales Operating System    " -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Cyan

$env:PATH = "C:\Program Files\nodejs;" + $env:PATH
$rootDir = $PSScriptRoot

Write-Host ""
Write-Host "[1/2] Starting Backend API on http://localhost:5000..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$rootDir\backend'; `$env:PATH = 'C:\Program Files\nodejs;' + `$env:PATH; npm run dev"

Write-Host "[2/2] Starting Frontend Next.js on http://localhost:3000..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$rootDir\frontend'; `$env:PATH = 'C:\Program Files\nodejs;' + `$env:PATH; npm run dev"

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host " SalesSetu is running!" -ForegroundColor Green
Write-Host " - Frontend: http://localhost:3000" -ForegroundColor White
Write-Host " - Backend:  http://localhost:5000" -ForegroundColor White
Write-Host "============================================" -ForegroundColor Cyan
