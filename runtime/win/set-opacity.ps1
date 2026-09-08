<#
.SYNOPSIS
    Set the opacity of the focused editor window.

.DESCRIPTION
    Marks the window WS_EX_LAYERED and applies a constant alpha through
    SetLayeredWindowAttributes. Emits a single compact JSON object on stdout so
    the extension never has to parse prose.

.PARAMETER Value
    Target opacity, 0.0 to 1.0.

.PARAMETER Processes
    Comma-separated image names that count as editor windows.

.PARAMETER Probe
    Resolve the target window and report it without changing anything.
#>
[CmdletBinding()]
param(
    [double] $Value = 1.0,
    [string] $Processes = 'cursor,code,vscodium,code - oss',
    [switch] $Probe
)

$ErrorActionPreference = 'Stop'

function Write-Result([bool] $Ok, [hashtable] $Fields) {
    $payload = @{ ok = $Ok }
    foreach ($key in $Fields.Keys) { $payload[$key] = $Fields[$key] }
    Write-Output ($payload | ConvertTo-Json -Compress)
}

Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;

public static class DiffuseNative
{
    public const int GWL_EXSTYLE = -20;
    public const int WS_EX_LAYERED = 0x00080000;
    public const uint LWA_ALPHA = 0x00000002;

    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll", SetLastError = true)]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);

    [DllImport("user32.dll", EntryPoint = "GetWindowLongW", SetLastError = true)]
    private static extern int GetWindowLong32(IntPtr hWnd, int nIndex);

    [DllImport("user32.dll", EntryPoint = "GetWindowLongPtrW", SetLastError = true)]
    private static extern IntPtr GetWindowLongPtr64(IntPtr hWnd, int nIndex);

    [DllImport("user32.dll", EntryPoint = "SetWindowLongW", SetLastError = true)]
    private static extern int SetWindowLong32(IntPtr hWnd, int nIndex, int dwNewLong);

    [DllImport("user32.dll", EntryPoint = "SetWindowLongPtrW", SetLastError = true)]
    private static extern IntPtr SetWindowLongPtr64(IntPtr hWnd, int nIndex, IntPtr dwNewLong);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool SetLayeredWindowAttributes(IntPtr hWnd, uint crKey, byte alpha, uint flags);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool GetLayeredWindowAttributes(IntPtr hWnd, out uint crKey, out byte alpha, out uint flags);

    public static IntPtr GetWindowLongCompat(IntPtr hWnd, int nIndex)
    {
        if (IntPtr.Size == 8) { return GetWindowLongPtr64(hWnd, nIndex); }
        return new IntPtr(GetWindowLong32(hWnd, nIndex));
    }

    public static IntPtr SetWindowLongCompat(IntPtr hWnd, int nIndex, IntPtr value)
    {
        if (IntPtr.Size == 8) { return SetWindowLongPtr64(hWnd, nIndex, value); }
        return new IntPtr(SetWindowLong32(hWnd, nIndex, value.ToInt32()));
    }
}
'@

$names = $Processes.Split(',') | ForEach-Object { $_.Trim().ToLowerInvariant() } | Where-Object { $_ }

function Resolve-Target {
    $foreground = [DiffuseNative]::GetForegroundWindow()
    if ($foreground -ne [IntPtr]::Zero) {
        $processId = 0
        [void][DiffuseNative]::GetWindowThreadProcessId($foreground, [ref] $processId)
        if ($processId -ne 0) {
            $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
            if ($process -and $names -contains $process.ProcessName.ToLowerInvariant()) {
                return [pscustomobject]@{ Handle = $foreground; Name = $process.ProcessName }
            }
        }
    }

    # The editor may not be focused (command palette, detached window).
    foreach ($name in $names) {
        $candidate = Get-Process -Name $name -ErrorAction SilentlyContinue |
            Where-Object { $_.MainWindowHandle -ne [IntPtr]::Zero } |
            Select-Object -First 1
        if ($candidate) {
            return [pscustomobject]@{ Handle = $candidate.MainWindowHandle; Name = $candidate.ProcessName }
        }
    }

    return $null
}

try {
    $target = Resolve-Target
    if (-not $target) {
        Write-Result $false @{ message = 'No editor window found' }
        exit 1
    }

    $currentAlpha = $null
    $key = 0
    $alphaOut = [byte] 0
    $flags = 0
    if ([DiffuseNative]::GetLayeredWindowAttributes($target.Handle, [ref] $key, [ref] $alphaOut, [ref] $flags)) {
        $currentAlpha = [int] $alphaOut
    }

    if ($Probe) {
        Write-Result $true @{ process = $target.Name; alpha = $currentAlpha }
        exit 0
    }

    $alpha = [int][math]::Round($Value * 255)
    if ($alpha -lt 1) { $alpha = 1 }
    if ($alpha -gt 255) { $alpha = 255 }

    $exStyle = [DiffuseNative]::GetWindowLongCompat($target.Handle, [DiffuseNative]::GWL_EXSTYLE)
    $layered = [IntPtr]([int64] $exStyle -bor [DiffuseNative]::WS_EX_LAYERED)
    [void][DiffuseNative]::SetWindowLongCompat($target.Handle, [DiffuseNative]::GWL_EXSTYLE, $layered)

    if (-not [DiffuseNative]::SetLayeredWindowAttributes($target.Handle, 0, [byte] $alpha, [DiffuseNative]::LWA_ALPHA)) {
        $code = [System.Runtime.InteropServices.Marshal]::GetLastWin32Error()
        Write-Result $false @{ message = "SetLayeredWindowAttributes failed (error $code)" }
        exit 1
    }

    Write-Result $true @{ process = $target.Name; alpha = $alpha; value = $Value }
    exit 0
}
catch {
    Write-Result $false @{ message = $_.Exception.Message }
    exit 1
}
