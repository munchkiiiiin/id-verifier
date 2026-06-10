Add-Type -AssemblyName System.Drawing

function Resize-Image {
    param (
        [string]$SourcePath,
        [string]$DestinationPath,
        [int]$Width,
        [int]$Height
    )
    $srcImage = [System.Drawing.Image]::FromFile($SourcePath)
    $destImage = New-Object System.Drawing.Bitmap($Width, $Height)
    $g = [System.Drawing.Graphics]::FromImage($destImage)
    $g.Clear([System.Drawing.Color]::Transparent)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.DrawImage($srcImage, 0, 0, $Width, $Height)
    $destImage.Save($DestinationPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $destImage.Dispose()
    $srcImage.Dispose()
}

$source = "C:\Users\dever\OneDrive\Desktop\id-verifier\public\pwa-512x512.png"
$resDir = "C:\Users\dever\OneDrive\Desktop\id-verifier\android\app\src\main\res"

$sizes = @{
    "mipmap-mdpi" = 48
    "mipmap-hdpi" = 72
    "mipmap-xhdpi" = 96
    "mipmap-xxhdpi" = 144
    "mipmap-xxxhdpi" = 192
}

foreach ($folder in $sizes.Keys) {
    $size = $sizes[$folder]
    $dir = Join-Path $resDir $folder
    
    Write-Host "Generating launcher icons in $folder ($size x $size)..."
    
    # Resize standard launcher icon
    Resize-Image -SourcePath $source -DestinationPath (Join-Path $dir "ic_launcher.png") -Width $size -Height $size
    # Resize round launcher icon
    Resize-Image -SourcePath $source -DestinationPath (Join-Path $dir "ic_launcher_round.png") -Width $size -Height $size
    # Resize foreground icon for adaptive icons
    Resize-Image -SourcePath $source -DestinationPath (Join-Path $dir "ic_launcher_foreground.png") -Width $size -Height $size
}

Write-Host "Launcher icons successfully updated!"
