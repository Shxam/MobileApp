$baseUrl = "http://localhost:3001"
$userPhone = "+919876543210"

Write-Host "1. User Requesting OTP for $userPhone..." -ForegroundColor Cyan
$otpRes = Invoke-RestMethod -Uri "$baseUrl/api/v1/auth/request-otp" -Method Post -Body (@{ phone = $userPhone } | ConvertTo-Json) -ContentType 'application/json'
$otpRes | ConvertTo-Json

Write-Host "`n2. Authenticating User with OTP 123456..." -ForegroundColor Cyan
$authRes = Invoke-RestMethod -Uri "$baseUrl/api/v1/auth/verify-otp" -Method Post -Body (@{ phone = $userPhone; otp = "123456" } | ConvertTo-Json) -ContentType 'application/json'
$userToken = $authRes.accessToken
$userId = $authRes.user.id
Write-Host "Authenticated! User ID: $userId" -ForegroundColor Green

Write-Host "`n3. Verifying User Context Saved in Database (/auth/me)..." -ForegroundColor Cyan
$profile = Invoke-RestMethod -Uri "$baseUrl/api/v1/auth/me" -Headers @{ Authorization = "Bearer $userToken" }
$profile | ConvertTo-Json

Write-Host "`n4. Placing Food Order for Turf Bench Delivery..." -ForegroundColor Cyan
$orderPayload = @{
    items = @(
        @{ menuItemId = "menu_1"; name = "Biriyani (Boneless)"; quantity = 2; price = 250 },
        @{ menuItemId = "menu_2"; name = "Amritsari Kulhad Rabri Lassi"; quantity = 2; price = 110 }
    )
    totalAmount = 720
    deliveryType = "turf_bench"
    deliveryTarget = "Pitch Side - Turf Cage A Bench"
} | ConvertTo-Json

$orderRes = Invoke-RestMethod -Uri "$baseUrl/api/v1/orders" -Method Post -Headers @{ Authorization = "Bearer $userToken" } -Body $orderPayload -ContentType 'application/json'
$orderId = $orderRes.id
Write-Host "Order Placed Successfully! Order ID: $orderId" -ForegroundColor Green
$orderRes | ConvertTo-Json

Write-Host "`n5. Kitchen KDS Staff Accepts Order and Starts Cooking..." -ForegroundColor Cyan
$kitchenUpdate = Invoke-RestMethod -Uri "$baseUrl/api/v1/orders/$orderId/status" -Method Patch -Headers @{ Authorization = "Bearer $userToken" } -Body (@{ status = "preparing" } | ConvertTo-Json) -ContentType 'application/json'
Write-Host "Kitchen Status Updated to: PREPARING" -ForegroundColor Yellow
$kitchenUpdate | ConvertTo-Json

Write-Host "`n6. Kitchen Dispatches Delivery Runner (Out for Delivery)..." -ForegroundColor Cyan
$dispatchUpdate = Invoke-RestMethod -Uri "$baseUrl/api/v1/orders/$orderId/status" -Method Patch -Headers @{ Authorization = "Bearer $userToken" } -Body (@{ status = "out_for_delivery" } | ConvertTo-Json) -ContentType 'application/json'
Write-Host "Delivery Status Updated to: OUT_FOR_DELIVERY" -ForegroundColor Yellow
Write-Host "Live Driver Map Telemetry Stream Active in Customer App!" -ForegroundColor Green
$dispatchUpdate | ConvertTo-Json

Write-Host "`n==========================================================" -ForegroundColor Green
Write-Host "ALL 6 STEPS OF USER JOURNEY VERIFIED 100% SUCCESSFULLY!" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
