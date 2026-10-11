<#
.SYNOPSIS
    Runs OpsLog on this PC at http://localhost:8080. No GitHub, Python or Node needed.

.DESCRIPTION
    OpsLog is a static web app (HTML/CSS/JavaScript). This script serves the OpsLog folder
    with a small built-in web server (.NET HttpListener) bound to localhost only, then opens
    it in your browser.

    Why not just double-click index.html? Browsers treat "localhost" as a secure address,
    so microphone (voice entries), notifications, offline mode and "Install app" all work.
    They do not work, or keep re-prompting, from a file:// path.

    Your data stays in the browser profile for http://localhost:<Port>. Keep the same port,
    because a different port is a different address with separate storage.

.PARAMETER Port
    Local port to listen on. Default 8080.

.PARAMETER Browser
    Edge, Chrome or Default. Which browser to open. Default Edge.

.PARAMETER NoBrowser
    Start the server without opening a browser (used by the logon task).

.PARAMETER InstallAtLogon
    Create a scheduled task that starts the server hidden every time you sign in.

.PARAMETER Uninstall
    Remove the logon task.

.EXAMPLE
    .\tools\Start-OpsLog.ps1
    Serves OpsLog at http://localhost:8080 and opens it in Edge. Press Ctrl+C to stop.

.EXAMPLE
    .\tools\Start-OpsLog.ps1 -InstallAtLogon
    Always-on: the server starts silently at every sign-in.

.EXAMPLE
    .\tools\Start-OpsLog.ps1 -Uninstall
#>
[CmdletBinding(DefaultParameterSetName = 'Run')]
param(
    [Parameter(ParameterSetName = 'Run')]
    [Parameter(ParameterSetName = 'Install')]
    [ValidateRange(1024, 65535)]
    [int]$Port = 8080,

    [Parameter(ParameterSetName = 'Run')]
    [ValidateSet('Edge', 'Chrome', 'Default')]
    [string]$Browser = 'Edge',

    [Parameter(ParameterSetName = 'Run')]
    [switch]$NoBrowser,

    [Parameter(Mandatory, ParameterSetName = 'Install')]
    [switch]$InstallAtLogon,

    [Parameter(Mandatory, ParameterSetName = 'Uninstall')]
    [switch]$Uninstall
)

$ErrorActionPreference = 'Stop'
$TaskName = 'OpsLog Local Server'
$Root     = Split-Path -Parent $PSScriptRoot          # the OpsLog folder (tools\..)
$Url      = "http://localhost:$Port/"

# ---- Logon task management ------------------------------------------------------------
if ($Uninstall) {
    if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
        Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
        Write-Host "Removed scheduled task '$TaskName'." -ForegroundColor Green
    } else {
        Write-Host "No '$TaskName' task found." -ForegroundColor Yellow
    }
    return
}

if ($InstallAtLogon) {
    $arg = "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$PSCommandPath`" -Port $Port -NoBrowser"
    $user      = "$env:USERDOMAIN\$env:USERNAME"
    $action    = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $arg
    $trigger   = New-ScheduledTaskTrigger -AtLogOn -User $user
    $principal = New-ScheduledTaskPrincipal -UserId $user -LogonType Interactive -RunLevel Limited
    $settings  = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
                    -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew
    Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Principal $principal `
        -Settings $settings -Description "Serves OpsLog at $Url (localhost only)" -Force | Out-Null
    Start-ScheduledTask -TaskName $TaskName
    Write-Host "Installed. OpsLog now starts at every sign-in and is running at $Url" -ForegroundColor Green
    return
}

# ---- Helpers ----------------------------------------------------------------------------------
function Open-OpsLog {
    if ($NoBrowser) { return }
    switch ($Browser) {
        'Edge'   { try { Start-Process 'msedge.exe' -ArgumentList $Url } catch { Start-Process $Url } }
        'Chrome' { try { Start-Process 'chrome.exe' -ArgumentList $Url } catch { Start-Process $Url } }
        default  { Start-Process $Url }
    }
}

$Mime = @{
    '.html' = 'text/html; charset=utf-8';  '.js'  = 'text/javascript; charset=utf-8'
    '.css'  = 'text/css; charset=utf-8';   '.json' = 'application/json; charset=utf-8'
    '.svg'  = 'image/svg+xml';             '.png'  = 'image/png'
    '.ico'  = 'image/x-icon';              '.webmanifest' = 'application/manifest+json'
    '.md'   = 'text/markdown; charset=utf-8'; '.ps1' = 'text/plain; charset=utf-8'
    '.txt'  = 'text/plain; charset=utf-8'
}

# ---- Start the server ---------------------------------------------------------------------------
if (-not (Test-Path -LiteralPath (Join-Path $Root 'index.html'))) {
    Write-Host "index.html not found in $Root - keep this script in the 'tools' folder of OpsLog." -ForegroundColor Red
    return
}

$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add($Url)
try {
    $listener.Start()
} catch {
    # Port busy: maybe OpsLog is already running (e.g. the logon task). If so, just open it.
    try {
        Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3 | Out-Null
        Write-Host "OpsLog is already running at $Url" -ForegroundColor Cyan
        Open-OpsLog
    } catch {
        Write-Host "Could not start on $Url : $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "Another program may be using port $Port. Try: .\tools\Start-OpsLog.ps1 -Port 8090" -ForegroundColor Yellow
        Write-Host "(A new port is a new address, so export a backup in Settings and import it there.)" -ForegroundColor DarkGray
    }
    return
}

$sep      = [IO.Path]::DirectorySeparatorChar
$rootFull = [IO.Path]::GetFullPath($Root).TrimEnd('\', '/') + $sep
Write-Host ''
Write-Host "  OpsLog is running at $Url" -ForegroundColor Green
Write-Host "  Serving: $rootFull" -ForegroundColor DarkGray
Write-Host '  Press Ctrl+C to stop.' -ForegroundColor DarkGray
Write-Host ''
Open-OpsLog

try {
    while ($listener.IsListening) {
        # Wait in short slices so Ctrl+C is handled promptly.
        $pending = $listener.GetContextAsync()
        while (-not $pending.AsyncWaitHandle.WaitOne(500)) { }
        $ctx = $pending.GetAwaiter().GetResult()
        $req = $ctx.Request
        $res = $ctx.Response
        try {
            if ($req.HttpMethod -ne 'GET' -and $req.HttpMethod -ne 'HEAD') {
                $res.StatusCode = 405
            } else {
                $rel = [Uri]::UnescapeDataString($req.Url.AbsolutePath).TrimStart('/')
                if ([string]::IsNullOrEmpty($rel)) { $rel = 'index.html' }
                $full = [IO.Path]::GetFullPath((Join-Path $rootFull ($rel -replace '/', $sep)))
                if (Test-Path -LiteralPath $full -PathType Container) { $full = Join-Path $full 'index.html' }

                $outside = -not $full.StartsWith($rootFull, [StringComparison]::OrdinalIgnoreCase)
                $hidden  = $rel -match '(^|/)\.(git|github)(/|$)'
                if ($outside -or $hidden) {
                    $res.StatusCode = 403
                } elseif (-not (Test-Path -LiteralPath $full -PathType Leaf)) {
                    $res.StatusCode = 404
                } else {
                    $ext  = [IO.Path]::GetExtension($full).ToLowerInvariant()
                    $type = $Mime[$ext]
                    if (-not $type) { $type = 'application/octet-stream' }
                    $bytes = [IO.File]::ReadAllBytes($full)
                    $res.ContentType = $type
                    $res.AddHeader('Cache-Control', 'no-cache')
                    $res.ContentLength64 = $bytes.Length
                    if ($req.HttpMethod -eq 'GET') { $res.OutputStream.Write($bytes, 0, $bytes.Length) }
                }
            }
        } catch {
            $res.StatusCode = 500
        } finally {
            $res.OutputStream.Close()
        }
        Write-Verbose ("{0} {1} -> {2}" -f $req.HttpMethod, $req.Url.AbsolutePath, $res.StatusCode)
    }
} catch {
    # Errors raised while the listener is shutting down (Ctrl+C, sign-out) are expected.
    if ($listener.IsListening) { Write-Host "OpsLog server error: $($_.Exception.Message)" -ForegroundColor Red }
} finally {
    $listener.Stop()
    $listener.Close()
    Write-Host 'OpsLog server stopped.' -ForegroundColor Yellow
}
