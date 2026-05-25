$ErrorActionPreference = "Stop"

$baseUrl = "http://localhost:3000"
$organizationId = "cmpjyw3cw0000vl9srpqgrbee"

Write-Host "Health"
Invoke-RestMethod "$baseUrl/health"

Write-Host "Products"
Invoke-RestMethod "$baseUrl/api/organizations/$organizationId/products"

Write-Host "Availability"
Invoke-RestMethod "$baseUrl/api/organizations/$organizationId/availability"

Write-Host "Stock items"
Invoke-RestMethod "$baseUrl/api/organizations/$organizationId/stock-items"
