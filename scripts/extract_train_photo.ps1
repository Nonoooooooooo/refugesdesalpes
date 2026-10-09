Add-Type -AssemblyName System.Drawing

$srcPath = "C:\Users\barta\.gemini\antigravity-ide\brain\cf82051e-0313-4563-a71d-f777895c7227\.user_uploaded\media_1791485499338.jpg"
$src = [System.Drawing.Bitmap]::FromFile($srcPath)

# Exact bounding box: X [12..361], Y [205..257]
$cropX = 11
$cropY = 204
$cropW = 361 - $cropX + 1
$cropH = 257 - $cropY + 1

$outBmp = New-Object System.Drawing.Bitmap($cropW, $cropH, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)

for ($y = 0; $y -lt $cropH; $y++) {
    for ($x = 0; $x -lt $cropW; $x++) {
        $origX = $cropX + $x
        $origY = $cropY + $y
        $c = $src.GetPixel($origX, $origY)
        
        # Pure white or almost pure white background
        # Calculate distance from white (255, 255, 255)
        $dist = [Math]::Sqrt(([Math]::Pow(255 - $c.R, 2) + [Math]::Pow(255 - $c.G, 2) + [Math]::Pow(255 - $c.B, 2)) / 3.0)
        
        if ($dist -lt 5.0) {
            # Completely transparent
            $outBmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
        } elseif ($dist -lt 25.0) {
            # Smooth edge anti-aliasing / alpha feathering
            $alpha = [int](($dist - 5.0) / 20.0 * 255.0)
            if ($alpha -gt 255) { $alpha = 255 }
            if ($alpha -lt 0) { $alpha = 0 }
            $outBmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($alpha, $c.R, $c.G, $c.B))
        } else {
            # Solid pixel
            $outBmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(255, $c.R, $c.G, $c.B))
        }
    }
}

$destPath = "c:\Users\barta\.gemini\antigravity-ide\scratch\refugesdesalpes\public\icons\tgv_inoui_model.png"
$outBmp.Save($destPath, [System.Drawing.Imaging.ImageFormat]::Png)
Write-Host "Saved refined train to $destPath ($cropW x $cropH)"

$outBmp.Dispose()
$src.Dispose()
