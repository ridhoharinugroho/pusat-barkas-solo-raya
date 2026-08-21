# Pusat Barkas Solo Raya - Backend HTTP Server & Database API
$port = 5500
$root = $PSScriptRoot

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Prefixes.Add("http://127.0.0.1:$port/")

# Add local IP if available
try {
    $ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notmatch "Loopback|vEthernet" -and $_.IPAddress -notmatch "^169\." } | Select-Object -First 1).IPAddress
    if ($ip) {
        $listener.Prefixes.Add("http://${ip}:$port/")
    }
} catch {}

$mimeTypes = @{
    ".html" = "text/html; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".js"   = "application/javascript; charset=utf-8"
    ".json" = "application/json; charset=utf-8"
    ".png"  = "image/png"
    ".jpg"  = "image/jpeg"
    ".jpeg" = "image/jpeg"
    ".svg"  = "image/svg+xml"
    ".ico"  = "image/x-icon"
}

# Ensure db directory exists
$dbDir = Join-Path $root "db"
if (-not (Test-Path $dbDir)) { New-Item -ItemType Directory -Path $dbDir | Out-Null }

try {
    $listener.Start()
    Write-Host "==========================================================" -ForegroundColor Green
    Write-Host "  Pusat Barkas Solo Raya - Fullstack Server & Online DB" -ForegroundColor Cyan
    Write-Host "==========================================================" -ForegroundColor Green
    Write-Host "Local URL    : http://localhost:$port/" -ForegroundColor White
    if ($ip) {
        Write-Host "Mobile/HP URL: http://${ip}:$port/" -ForegroundColor Yellow
    }
    Write-Host "API Endpoints: /api/settings, /api/texts, /api/listings" -ForegroundColor Magenta
    Write-Host "Tekan Ctrl+C untuk menghentikan server.`n" -ForegroundColor Gray

    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        # Add CORS Headers for multi-device cross-origin support
        $response.AddHeader("Access-Control-Allow-Origin", "*")
        $response.AddHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        $response.AddHeader("Access-Control-Allow-Headers", "Content-Type, Authorization")

        if ($request.HttpMethod -eq "OPTIONS") {
            $response.StatusCode = 200
            $response.Close()
            continue
        }

        $rawUrl = $request.Url.AbsolutePath

        # -------------------------------------------------------------
        # REST API ROUTING
        # -------------------------------------------------------------
        if ($rawUrl.StartsWith("/api/")) {
            $apiPath = $rawUrl.Substring(5) # e.g. "settings", "texts", "listings", "users"
            $dbFile = Join-Path $dbDir "$apiPath.json"
            if ($apiPath -eq "settings") { $dbFile = Join-Path $dbDir "site_settings.json" }
            if ($apiPath -eq "texts") { $dbFile = Join-Path $dbDir "custom_texts.json" }
            if ($apiPath -eq "users") { $dbFile = Join-Path $dbDir "users.json" }

            if ($request.HttpMethod -eq "GET") {
                if (Test-Path $dbFile) {
                    $jsonBytes = [System.IO.File]::ReadAllBytes($dbFile)
                    $response.ContentType = "application/json; charset=utf-8"
                    $response.StatusCode = 200
                    $response.ContentLength64 = $jsonBytes.Length
                    $response.OutputStream.Write($jsonBytes, 0, $jsonBytes.Length)
                } else {
                    $response.StatusCode = 404
                }
                $response.Close()
                continue
            }
            elseif ($request.HttpMethod -eq "POST" -or $request.HttpMethod -eq "PUT") {
                $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
                $bodyString = $reader.ReadToEnd()
                
                # Write to database file (UTF8 No BOM)
                $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
                [System.IO.File]::WriteAllText($dbFile, $bodyString, $utf8NoBom)
                
                $responseBytes = [System.Text.Encoding]::UTF8.GetBytes($bodyString)
                $response.ContentType = "application/json; charset=utf-8"
                $response.StatusCode = 200
                $response.ContentLength64 = $responseBytes.Length
                $response.OutputStream.Write($responseBytes, 0, $responseBytes.Length)
                $response.Close()
                continue
            }
        }

        # -------------------------------------------------------------
        # STATIC FILE SERVING
        # -------------------------------------------------------------
        $urlPath = $rawUrl.TrimStart('/')
        if ([string]::IsNullOrWhiteSpace($urlPath)) { $urlPath = "index.html" }

        $filePath = Join-Path $root $urlPath

        if (Test-Path $filePath -PathType Leaf) {
            $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
            $contentType = if ($mimeTypes.ContainsKey($ext)) { $mimeTypes[$ext] } else { "application/octet-stream" }
            
            $bytes = [System.IO.File]::ReadAllBytes($filePath)
            $response.ContentType = $contentType
            $response.StatusCode = 200
            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $response.StatusCode = 404
            $errBytes = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
            $response.OutputStream.Write($errBytes, 0, $errBytes.Length)
        }
        $response.Close()
    }
} catch {
    Write-Host "Server stopped: $_" -ForegroundColor Red
} finally {
    if ($listener.IsListening) { $listener.Stop() }
}
