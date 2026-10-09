Add-Type -AssemblyName System.Drawing
$filePath = "C:\Users\barta\.gemini\antigravity-ide\brain\cf82051e-0313-4563-a71d-f777895c7227\.user_uploaded\media_1791485499338.jpg"
$img = [System.Drawing.Bitmap]::FromFile($filePath)
Write-Host "Width: $($img.Width), Height: $($img.Height)"

# Find bounding box of the bottom train (facing left)
# Background is white (R,G,B > 245)
$minY = 190
$maxY = 280
$foundMinX = 999
$foundMaxX = 0
$foundMinY = 999
$foundMaxY = 0

for ($y = $minY; $y -lt $maxY; $y++) {
    for ($x = 0; $x -lt $img.Width; $x++) {
        $c = $img.GetPixel($x, $y)
        if ($c.R -lt 240 -or $c.G -lt 240 -or $c.B -lt 240) {
            if ($x -lt $foundMinX) { $foundMinX = $x }
            if ($x -gt $foundMaxX) { $foundMaxX = $x }
            if ($y -lt $foundMinY) { $foundMinY = $y }
            if ($y -gt $foundMaxY) { $foundMaxY = $y }
        }
    }
}

Write-Host "Bottom train bbox: X [$foundMinX..$foundMaxX], Y [$foundMinY..$foundMaxY]"
$img.Dispose()
