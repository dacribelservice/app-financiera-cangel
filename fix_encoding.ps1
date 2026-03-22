$path = "app.js"
$content = Get-Content $path
# Powershell reads it as UTF8 if told so
# Let's replace the broken characters with their correct versions if we can identify them.
# Or just let Powershell write it back as clean UTF8.
$Utf8NoBomEncoding = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllLines($path, $content, $Utf8NoBomEncoding)

$path2 = "ui/sales.js"
$content2 = Get-Content $path2
[System.IO.File]::WriteAllLines($path2, $content2, $Utf8NoBomEncoding)
