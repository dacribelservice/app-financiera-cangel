$path = "app.js"
$c = Get-Content $path -Raw
# Fix some common broken UTF8 characters seen in the output
$c = $c -replace "Ã³", "ó"
$c = $c -replace "Ã©", "é"
$c = $c -replace "Ã", "í" # This might be wrong, but common
$c = $c -replace "Ã±", "ñ"
$c = $c -replace "Ã¡", "á"
$c = $c -replace "Ãº", "ú"
# Fix the headers
$c = $c -replace "â•", "="
$c = $c -replace "â• ", "="
$c = $c -replace "â•", "="
$c = $c -replace "â”€", "-"

$c | Set-Content $path -Encoding UTF8

$path2 = "ui/sales.js"
$c2 = Get-Content $path2 -Raw
$c2 = $c2 -replace "Ã³", "ó"
$c2 = $c2 -replace "Ã©", "é"
$c2 = $c2 -replace "Ã", "í"
$c2 = $c2 -replace "Ã±", "ñ"
$c2 = $c2 -replace "Ã¡", "á"
$c2 = $c2 -replace "Ãº", "ú"
$c2 | Set-Content $path2 -Encoding UTF8
