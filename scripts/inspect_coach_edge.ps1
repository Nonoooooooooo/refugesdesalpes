Add-Type -AssemblyName System.Drawing

$srcPath = "C:\Users\barta\.gemini\antigravity-ide\brain\cf82051e-0313-4563-a71d-f777895c7227\.user_uploaded\media_1791485499338.jpg"
$src = [System.Drawing.Bitmap]::FromFile($srcPath)

# Let's inspect column by column from x=310 to 373 at y=230 (mid body of coach)
for ($x = 310; $x -le 373; $x += 5) {
    $c = $src.GetPixel($x, 230)
    Write-Host "X=$x : R=$($c.R), G=$($c.G), B=$($c.B)"
}

$src.Dispose()
