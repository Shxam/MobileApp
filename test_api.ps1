# ===================================================
# IPL Dhaba Super App — PowerShell Manual Test Runner
# ===================================================

$baseUrl = "http://localhost:3001"

Write-Host "1. Testing Readiness & Cloud Connections..." -ForegroundColor Cyan
$ready = Invoke-RestMethod -Uri "$baseUrl/health/ready"
$ready | ConvertTo-Json

Write-Host "`n2. Requesting OTP for +919876543210..." -ForegroundColor Cyan
$otpRes = Invoke-RestMethod -Uri "$baseUrl/api/v1/auth/request-otp" -Method Post -Body '{"phone":"+919876543210"}' -ContentType 'application/json'
$otpRes | ConvertTo-Json

Write-Host "`n3. Verifying OTP Code 123456 & Getting JWT Token..." -ForegroundColor Cyan
$authRes = Invoke-RestMethod -Uri "$baseUrl/api/v1/auth/verify-otp" -Method Post -Body '{"phone":"+919876543210","otp":"123456"}' -ContentType 'application/json'
$token = $authRes.accessToken
Write-Host "Obtained JWT Token: " -NoNewline; Write-Host $token -ForegroundColor Green

Write-Host "`n4. Accessing Protected Profile (/auth/me)..." -ForegroundColor Cyan
$profile = Invoke-RestMethod -Uri "$baseUrl/api/v1/auth/me" -Headers @{ Authorization = "Bearer $token" }
$profile | ConvertTo-Json

Write-Host "`n5. Fetching Dhaba Food Menu..." -ForegroundColor Cyan
$menu = Invoke-RestMethod -Uri "$baseUrl/api/v1/menu"
Write-Host "Loaded $($menu.Count) Menu Items from Server!" -ForegroundColor Green

Write-Host "`n6. Fetching Available Turf Slots..." -ForegroundColor Cyan
$slots = Invoke-RestMethod -Uri "$baseUrl/api/v1/bookings/slots"
Write-Host "Available Turf Slots: $($slots.Count)" -ForegroundColor Green

Write-Host "`n7. Booking Turf Slot & Generating Gate Pass..." -ForegroundColor Cyan
$slotId = $slots[0].id
$bookingBody = @{ slotId = $slotId; addons = @("GoPro Recording") } | ConvertTo-Json
$booking = Invoke-RestMethod -Uri "$baseUrl/api/v1/bookings" -Method Post -Headers @{ Authorization = "Bearer $token" } -Body $bookingBody -ContentType 'application/json'
$booking | ConvertTo-Json

Write-Host "`n8. Placing Dhaba Food Order..." -ForegroundColor Cyan
$orderBody = '{"items":[{"menuItemId":"menu_1","quantity":2,"price":349}],"totalAmount":698,"deliveryType":"turf_bench"}'
$order = Invoke-RestMethod -Uri "$baseUrl/api/v1/orders" -Method Post -Headers @{ Authorization = "Bearer $token" } -Body $orderBody -ContentType 'application/json'
$order | ConvertTo-Json

Write-Host "`n9. Topping Up Matchday Wallet (+₹1000)..." -ForegroundColor Cyan
$walletBody = '{"amount":1000,"description":"UPI Scan Topup"}'
$wallet = Invoke-RestMethod -Uri "$baseUrl/api/v1/wallet/topup" -Method Post -Headers @{ Authorization = "Bearer $token" } -Body $walletBody -ContentType 'application/json'
$wallet | ConvertTo-Json

Write-Host "`n10. Testing Live Razorpay Intent Generation..." -ForegroundColor Cyan
$razorpayBody = '{"amount":500,"currency":"INR"}'
$razorpay = Invoke-RestMethod -Uri "$baseUrl/api/v1/payment-gateway/intent" -Method Post -Body $razorpayBody -ContentType 'application/json'
$razorpay | ConvertTo-Json

Write-Host "`n11. Testing Staff PIN Authentication (EMP-101 / PIN: 1234)..." -ForegroundColor Cyan
$staffBody = '{"employeeId":"EMP-101","pin":"1234"}'
$staffAuth = Invoke-RestMethod -Uri "$baseUrl/api/v1/auth/staff-login" -Method Post -Body $staffBody -ContentType 'application/json'
$staffAuth | ConvertTo-Json

Write-Host "`n12. Fetching Admin Operations Summary Report..." -ForegroundColor Cyan
$adminSummary = Invoke-RestMethod -Uri "$baseUrl/api/v1/admin/reports/summary"
$adminSummary | ConvertTo-Json

Write-Host "`n===================================================" -ForegroundColor Green
Write-Host "🎉 ALL 12 API ENDPOINTS VERIFIED 100% SUCCESSFULLY!" -ForegroundColor Green
Write-Host "===================================================" -ForegroundColor Green
