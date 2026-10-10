<#
.SYNOPSIS
    Registers Windows scheduled tasks that "call" you to update OpsLog during working hours.

.DESCRIPTION
    Browsers can only ring while the OpsLog page is open. This script makes the reminder
    independent of the browser: at every check-in slot Windows will

      1. play a ring and SPEAK an alert ("Time for your OpsLog check-in"), and
      2. bring an open OpsLog window to the front, or open OpsLog in "incoming call" mode
         (?call=1) so the assistant starts ringing on screen.

    Default schedule (matches the web app):
      Sunday - Wednesday : 08:00 - 14:00 and 15:00 - 16:00, every 30 minutes
      Thursday           : 08:00 - 15:00, every 30 minutes

    The tasks are created under the Task Scheduler folder \OpsLog\ and run as the
    logged-on user only (no admin rights, no stored password).

.PARAMETER AppUrl
    URL of your OpsLog site, e.g. https://<user>.github.io/my-tickets-/

.PARAMETER IntervalMinutes
    Minutes between check-ins. Default 30.

.PARAMETER Browser
    Edge, Chrome or Default. Edge/Chrome open OpsLog in a clean app window.

.PARAMETER NoVoice
    Do not speak the alert (ring sound only).

.PARAMETER SkipWhenLocked
    Do nothing while the workstation is locked (you are away from the desk).

.PARAMETER Unregister
    Remove all OpsLog check-in tasks.

.EXAMPLE
    .\Register-OpsLogCheckins.ps1 -AppUrl "https://maqboolkowdu.github.io/my-tickets-/"

.EXAMPLE
    .\Register-OpsLogCheckins.ps1 -AppUrl "https://maqboolkowdu.github.io/my-tickets-/" -Browser Edge -SkipWhenLocked

.EXAMPLE
    .\Register-OpsLogCheckins.ps1 -Unregister

.NOTES
    Requires Windows 10/11 or Windows Server 2016+ with the ScheduledTasks module (built in).
    Test a single alert immediately with:
        & "$env:LOCALAPPDATA\OpsLog\Invoke-OpsLogCheckin.ps1" -AppUrl "<your url>"
#>
[CmdletBinding(DefaultParameterSetName = 'Register', SupportsShouldProcess)]
param(
    [Parameter(Mandatory, ParameterSetName = 'Register')]
    [ValidatePattern('^https?://')]
    [string]$AppUrl,

    [Parameter(ParameterSetName = 'Register')]
    [ValidateRange(5, 240)]
    [int]$IntervalMinutes = 30,

    [Parameter(ParameterSetName = 'Register')]
    [ValidateSet('Edge', 'Chrome', 'Default')]
    [string]$Browser = 'Edge',

    [Parameter(ParameterSetName = 'Register')]
    [switch]$NoVoice,

    [Parameter(ParameterSetName = 'Register')]
    [switch]$SkipWhenLocked,

    [Parameter(Mandatory, ParameterSetName = 'Unregister')]
    [switch]$Unregister
)

$ErrorActionPreference = 'Stop'
$TaskPath   = '\OpsLog\'
$InstallDir = Join-Path $env:LOCALAPPDATA 'OpsLog'
$Invoker    = Join-Path $InstallDir 'Invoke-OpsLogCheckin.ps1'

# ---- Working windows (edit here if your shift changes) ---------------------------
$Windows = @(
    @{ Name = 'SunWed-Morning';   Days = 'Sunday','Monday','Tuesday','Wednesday'; Start = '08:00'; End = '14:00' }
    @{ Name = 'SunWed-Afternoon'; Days = 'Sunday','Monday','Tuesday','Wednesday'; Start = '15:00'; End = '16:00' }
    @{ Name = 'Thursday';         Days = 'Thursday';                              Start = '08:00'; End = '15:00' }
)

if ($Unregister) {
    $tasks = Get-ScheduledTask -TaskPath $TaskPath -ErrorAction SilentlyContinue
    if (-not $tasks) { Write-Host 'No OpsLog tasks found.' -ForegroundColor Yellow; return }
    $tasks | ForEach-Object {
        if ($PSCmdlet.ShouldProcess($_.TaskName, 'Unregister scheduled task')) {
            Unregister-ScheduledTask -TaskName $_.TaskName -TaskPath $TaskPath -Confirm:$false
            Write-Host "Removed $($_.TaskName)" -ForegroundColor Green
        }
    }
    return
}

# ---- 1. Write the per-slot alert script ----------------------------------------------
New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null

$invokerBody = @'
param(
    [Parameter(Mandatory)][string]$AppUrl,
    [ValidateSet('Edge','Chrome','Default')][string]$Browser = 'Edge',
    [switch]$NoVoice,
    [switch]$SkipWhenLocked
)
# Skip while the session is locked (LogonUI runs on the lock screen).
if ($SkipWhenLocked -and (Get-Process -Name LogonUI -ErrorAction SilentlyContinue)) { return }

# 1) Ring + speak
try {
    1..2 | ForEach-Object { [console]::Beep(440, 350); [console]::Beep(480, 350); Start-Sleep -Milliseconds 250 }
} catch { }
if (-not $NoVoice) {
    try {
        Add-Type -AssemblyName System.Speech
        $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
        $hour  = (Get-Date).Hour
        $greet = if ($hour -lt 12) { 'Good morning' } else { 'Hi' }
        $synth.Speak("$greet. It's your OpsLog check-in. What have you been working on?")
        $synth.Dispose()
    } catch { }
}

# 2) Focus OpsLog if it is already open, otherwise open it in "incoming call" mode.
$existing = Get-Process msedge, chrome -ErrorAction SilentlyContinue |
    Where-Object { $_.MainWindowTitle -like '*OpsLog*' } | Select-Object -First 1
if ($existing) {
    Add-Type -Namespace OpsLog -Name Win -MemberDefinition @"
[DllImport("user32.dll")] public static extern bool SetForegroundWindow(System.IntPtr h);
[DllImport("user32.dll")] public static extern bool ShowWindow(System.IntPtr h, int c);
"@ -ErrorAction SilentlyContinue
    [OpsLog.Win]::ShowWindow($existing.MainWindowHandle, 9) | Out-Null   # SW_RESTORE
    [OpsLog.Win]::SetForegroundWindow($existing.MainWindowHandle) | Out-Null
    return   # the open page rings by itself at the slot
}

$sep = if ($AppUrl.Contains('?')) { '&' } else { '?' }
$url = ($AppUrl -replace '#.*$', '') + "${sep}call=1#/dashboard"
switch ($Browser) {
    'Edge'    { Start-Process 'msedge.exe'  -ArgumentList "--app=$url" }
    'Chrome'  { Start-Process 'chrome.exe'  -ArgumentList "--app=$url" }
    default   { Start-Process $url }
}
'@
Set-Content -Path $Invoker -Value $invokerBody -Encoding UTF8
Write-Host "Alert script written to $Invoker" -ForegroundColor Cyan

# ---- 2. Register one weekly task per working window ------------------------------------
$argList = @('-NoProfile', '-WindowStyle', 'Hidden', '-ExecutionPolicy', 'Bypass',
             '-File', "`"$Invoker`"", '-AppUrl', "`"$AppUrl`"", '-Browser', $Browser)
if ($NoVoice)        { $argList += '-NoVoice' }
if ($SkipWhenLocked) { $argList += '-SkipWhenLocked' }

$action    = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument ($argList -join ' ')
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited
$settings  = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
                -StartWhenAvailable:$false -ExecutionTimeLimit (New-TimeSpan -Minutes 5) -MultipleInstances IgnoreNew

foreach ($w in $Windows) {
    $start    = [datetime]::ParseExact($w.Start, 'HH:mm', $null)
    $end      = [datetime]::ParseExact($w.End,   'HH:mm', $null)
    # +1 minute so the END time itself also rings (e.g. 14:00 is included).
    $duration = ($end - $start) + (New-TimeSpan -Minutes 1)

    $trigger  = New-ScheduledTaskTrigger -Weekly -DaysOfWeek $w.Days -At $start
    $repeat   = New-ScheduledTaskTrigger -Once -At $start `
                    -RepetitionInterval (New-TimeSpan -Minutes $IntervalMinutes) -RepetitionDuration $duration
    $trigger.Repetition = $repeat.Repetition

    $name = "OpsLog Check-in - $($w.Name)"
    if ($PSCmdlet.ShouldProcess($name, 'Register scheduled task')) {
        Register-ScheduledTask -TaskName $name -TaskPath $TaskPath -Action $action -Trigger $trigger `
            -Principal $principal -Settings $settings -Description "OpsLog check-in call $($w.Start)-$($w.End) every $IntervalMinutes min ($($w.Days -join ', '))" -Force | Out-Null
        Write-Host ("Registered {0,-36} {1}-{2} every {3} min on {4}" -f $name, $w.Start, $w.End, $IntervalMinutes, ($w.Days -join ', ')) -ForegroundColor Green
    }
}

Write-Host ''
Write-Host 'Done. Review the tasks in Task Scheduler > Task Scheduler Library > OpsLog.' -ForegroundColor Cyan
Write-Host "Test an alert now:  & '$Invoker' -AppUrl '$AppUrl'" -ForegroundColor DarkGray
