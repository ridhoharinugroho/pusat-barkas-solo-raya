###############################################
# push-users.ps1
# Reads Supabase configuration (URL & ANON_KEY) from environment variables
# or from js/lib/supabase.js if not set, then upserts default users
# to the Supabase REST endpoint /rest/v1/users.
###############################################

# Resolve Supabase URL and anon key
$supabaseUrl = 'https://rwjqqoulqdmtsweuvbef.supabase.co'
$supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ3anFxb3VscWRtdHN3ZXV2YmVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc2NzY0MjYsImV4cCI6MjEwMzI1MjQyNn0.xof6x2BoNkNp2ssXIiPJ4Dr3m-l7rFP9MaZFCSxfvZY'

if (-not $supabaseUrl -or -not $supabaseKey) {
    # Attempt to read from js/lib/supabase.js (relative to script location)
    $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
    $supabaseJsPath = Join-Path $scriptDir "..\\js\\lib\\supabase.js"
    if (Test-Path $supabaseJsPath) {
        $jsContent = Get-Content $supabaseJsPath -Raw
        if (-not $supabaseUrl) {
            if ($jsContent -match "const SUPABASE_URL\\s*=\\s*'([^']+)'") {
                $supabaseUrl = $Matches[1]
            }
        }
        if (-not $supabaseKey) {
            if ($jsContent -match "const SUPABASE_ANON_KEY\\s*=\\s*'([^']+)'") {
                $supabaseKey = $Matches[1]
            }
        }
    }
}

if (-not $supabaseUrl -or -not $supabaseKey) {
    Write-Error "Supabase configuration not found (SUPABASE_URL / SUPABASE_ANON_KEY)."
    exit 1
}

# API endpoint for the "users" table
$apiUrl = "$supabaseUrl/rest/v1/users"

# Default user payload – adjust fields according to your table schema
$defaultUsers = @(
    @{ id = 'user-101'; name = 'Zamir Shop'; store_name = 'Zamir Shop'; email = 'zamir@example.com'; phone = '08000000001'; region = 'unknown'; district = 'unknown' }
    @{ id = 'user-102'; name = 'Toko Pak Joko'; store_name = 'Toko Pak Joko'; email = 'pakjoko@example.com'; phone = '08000000002'; region = 'unknown'; district = 'unknown' }
    @{ id = 'user-103'; name = 'Rian Gadget'; store_name = 'Rian Gadget'; email = 'rian@example.com'; phone = '08000000003'; region = 'unknown'; district = 'unknown' }
    @{ id = 'user-104'; name = 'Siti Aisyah'; store_name = 'Siti Aisyah'; email = 'siti@example.com'; phone = '08000000004'; region = 'unknown'; district = 'unknown' }
)

$payloadJson = $defaultUsers | ConvertTo-Json -Depth 5

try {
    $response = Invoke-RestMethod -Method POST -Uri $apiUrl -Headers @{
        "apikey"          = $supabaseKey
        "Authorization"   = "Bearer $supabaseKey"
        "Content-Type"    = "application/json"
        "Prefer"          = "return=representation, resolution=merge-duplicates"
    } -Body $payloadJson
    Write-Host "✅ Users upserted successfully."
} catch {
    Write-Error "❌ Failed to upsert users: $_"
    exit 1
}
