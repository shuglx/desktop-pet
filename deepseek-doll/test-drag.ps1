# Z-DASH DeskPet automated drag test v3 (fullscreen overlay architecture)
# Uses SendInput (real injected input) instead of SetCursorPos/mouse_event
# (synthesized legacy moves may not trigger Electron's forward hook)
# Requires app started with freeze mode: PET_FREEZE=1 (dev) or --freeze (exe)
param(
  [string]$LogFile = ""
)

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

Add-Type @"
using System;
using System.Runtime.InteropServices;
public class MouseSim {
  [StructLayout(LayoutKind.Sequential)]
  struct MOUSEINPUT { public int dx, dy; public uint mouseData, dwFlags, time; public IntPtr dwExtraInfo; }
  [StructLayout(LayoutKind.Sequential)]
  struct INPUT { public uint type; public MOUSEINPUT mi; }
  static void Send(uint flags, int dx, int dy) {
    INPUT[] inp = new INPUT[1];
    inp[0].type = 0; // INPUT_MOUSE
    inp[0].mi.dx = dx; inp[0].mi.dy = dy;
    inp[0].mi.dwFlags = flags;
    SendInput(1, inp, Marshal.SizeOf(typeof(INPUT)));
  }
  [DllImport("user32.dll", SetLastError = true)]
  static extern uint SendInput(uint n, INPUT[] inputs, int size);
  [DllImport("user32.dll")] public static extern int GetSystemMetrics(int i);
  [DllImport("user32.dll")] static extern IntPtr GetDC(IntPtr h);
  [DllImport("gdi32.dll")] static extern int GetDeviceCaps(IntPtr h, int i);
  [DllImport("user32.dll")] static extern int ReleaseDC(IntPtr h, IntPtr dc);
  public static int[] PhysSize() {
    IntPtr dc = GetDC(IntPtr.Zero);
    int w = GetDeviceCaps(dc, 118); // DESKTOPHORZRES (physical)
    int h = GetDeviceCaps(dc, 117); // DESKTOPVERTRES
    ReleaseDC(IntPtr.Zero, dc);
    return new int[] { w, h };
  }
  // absolute move over primary monitor physical surface (0..65535 normalized)
  public static void MoveToPhys(int px, int py, int w, int h) {
    int dx = (int)Math.Round((double)px * 65535 / (w - 1));
    int dy = (int)Math.Round((double)py * 65535 / (h - 1));
    Send(0x8001, dx, dy); // ABSOLUTE | MOVE
  }
  public static void LeftDown() { Send(0x0002, 0, 0); }
  public static void LeftUp()   { Send(0x0004, 0, 0); }
}
"@

if (-not $LogFile) { $LogFile = Join-Path $env:APPDATA "z-dash-desktop-pet\pet-error.log" }

function Get-PetRoots($path) {
  if (-not (Test-Path $path)) { return @() }
  $lines = Get-Content $path | Where-Object { $_ -match 'diag: petRoot (\{.*\})' }
  $out = @()
  foreach ($l in $lines) {
    if ($l -match 'diag: petRoot (\{.*\})') {
      try { $out += ($Matches[1] | ConvertFrom-Json) } catch {}
    }
  }
  return $out
}

Start-Sleep -Milliseconds 500
$roots = @(Get-PetRoots $LogFile)
if ($roots.Count -lt 1) { Write-Output "FAIL: no petRoot diag in log (is app in freeze mode?)"; exit 1 }
$before = $roots[0]
Write-Output ("pet before: x={0} y={1} w={2} h={3}" -f $before.x, $before.y, $before.width, $before.height)

# logical (DIP) -> physical conversion factor
$phys = [MouseSim]::PhysSize()
$physW = $phys[0]; $physH = $phys[1]
$logW = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds.Width
$dpi = $physW / $logW
Write-Output ("logical {0}px physical {1}x{2}px dpi {3:N2}" -f $logW, $physW, $physH, $dpi)

# pet body center: root top-left + (170,102), converted to physical
$cx = [int](($before.x + 170) * $dpi)
$cy = [int](($before.y + 102) * $dpi)
Write-Output ("cursor start (physical): ({0},{1})" -f $cx, $cy)

# hover first so renderer disables click-through
[MouseSim]::MoveToPhys($cx, $cy, $physW, $physH)
Start-Sleep -Milliseconds 900
# nudge a bit to generate extra mousemove events
[MouseSim]::MoveToPhys($cx + 6, $cy, $physW, $physH)
Start-Sleep -Milliseconds 150
[MouseSim]::MoveToPhys($cx, $cy, $physW, $physH)
Start-Sleep -Milliseconds 300

# down -> drag (-320,-260 logical = *dpi physical) in 10 steps -> up
$dxl = -320; $dyl = -260; $steps = 10
[MouseSim]::LeftDown()
Start-Sleep -Milliseconds 300
for ($i = 1; $i -le $steps; $i++) {
  $nx = [int](($cx + $dxl * $dpi * $i / $steps))
  $ny = [int](($cy + $dyl * $dpi * $i / $steps))
  [MouseSim]::MoveToPhys($nx, $ny, $physW, $physH)
  Start-Sleep -Milliseconds 60
}
Start-Sleep -Milliseconds 200
[MouseSim]::LeftUp()
Start-Sleep -Milliseconds 1200

$roots2 = @(Get-PetRoots $LogFile)
if ($roots2.Count -lt 2) { Write-Output "FAIL: no petRoot update after drag (pUp never fired?)"; exit 1 }
$after = $roots2[-1]
$moveX = [double]$after.x - [double]$before.x
$moveY = [double]$after.y - [double]$before.y
Write-Output ("pet after:  x={0} y={1}" -f $after.x, $after.y)
Write-Output ("pet moved:  ({0:N0},{1:N0})   mouse moved: ({2},{3})" -f $moveX, $moveY, $dxl, $dyl)

$ok = ([Math]::Abs($moveX - $dxl) -le 12) -and ([Math]::Abs($moveY - $dyl) -le 12)
if ($ok) { Write-Output "RESULT: PASS - drag follows mouse" } else { Write-Output "RESULT: FAIL - drag does not follow mouse" }

$alive = Get-Process | Where-Object { $_.ProcessName -like '*electron*' -or $_.ProcessName -like '*DeskPet*' }
Write-Output ("process alive: {0}" -f ($null -ne $alive))
if (Test-Path $LogFile) {
  $errs = Get-Content $LogFile | Where-Object { $_ -match 'Uncaught|JS错误|renderer gone' }
  if ($errs) { Write-Output "--- errors in log ---"; $errs | Select-Object -Last 5 } else { Write-Output "no JS errors (good)" }
}
