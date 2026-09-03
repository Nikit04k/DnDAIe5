const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const psScript = `
Add-Type -AssemblyName System.Drawing
$iconPath = Join-Path (Get-Location) 'build\\icon.png'
$outPath = Join-Path (Get-Location) 'build\\splash.bmp'

$width = 480
$height = 320
$bmp = New-Object System.Drawing.Bitmap($width, $height, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit

# Background dark slate
$bgBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(2, 6, 23))
$g.FillRectangle($bgBrush, 0, 0, $width, $height)

# Draw dragon icon in upper center
if (Test-Path $iconPath) {
    $icon = [System.Drawing.Image]::FromFile($iconPath)
    $iconSize = 140
    $iconX = [int](($width - $iconSize) / 2)
    $iconY = 32
    $g.DrawImage($icon, $iconX, $iconY, $iconSize, $iconSize)
    $icon.Dispose()
}

# Title font
$titleFont = New-Object System.Drawing.Font('Segoe UI', 20, [System.Drawing.FontStyle]::Bold)
$titleBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(245, 158, 11)) # Amber 500
$titleText = 'DnDAIe5'
$titleSize = $g.MeasureString($titleText, $titleFont)
$titleX = ($width - $titleSize.Width) / 2
$g.DrawString($titleText, $titleFont, $titleBrush, $titleX, 185)

# Subtitle font
$subFont = New-Object System.Drawing.Font('Segoe UI', 10, [System.Drawing.FontStyle]::Regular)
$subBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(148, 163, 184)) # Slate 400
$subText = 'AI Dungeon Master & Party RPG'
$subSize = $g.MeasureString($subText, $subFont)
$subX = ($width - $subSize.Width) / 2
$g.DrawString($subText, $subFont, $subBrush, $subX, 226)

# Status line
$statusFont = New-Object System.Drawing.Font('Segoe UI', 9, [System.Drawing.FontStyle]::Italic)
$statusBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(217, 119, 6)) # Amber 600
$statusText = 'Unpacking and launching DnDAIe5 Portable...'
$statusSize = $g.MeasureString($statusText, $statusFont)
$statusX = ($width - $statusSize.Width) / 2
$g.DrawString($statusText, $statusFont, $statusBrush, $statusX, 266)

# Border outline
$pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(30, 41, 59), 2)
$g.DrawRectangle($pen, 1, 1, $width - 2, $height - 2)

$bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Bmp)
$g.Dispose()
$bmp.Dispose()
Write-Host 'Generated splash.bmp successfully.'
`;

fs.writeFileSync('scripts/make_splash.ps1', psScript);
try {
  execSync('powershell -NoProfile -ExecutionPolicy Bypass -File scripts/make_splash.ps1', { stdio: 'inherit' });
} catch (e) {
  console.error('Failed to create splash.bmp:', e);
}
