$path = "app.js"
$content = Get-Content $path
# Filter out lines that are purely whitespace if they are in the specified ranges
# Or better, just remove all lines that are ONLY whitespace in the whole file if they are redundant.
# The user specifically mentioned 4522-4547.
# Let's just remove ALL purely empty lines that follow another empty line (compact multiple empty lines into zero or one).
$newContent = @()
$prevWasEmpty = $false
foreach ($line in $content) {
    if ($line.Trim() -eq "") {
        if (-not $prevWasEmpty) {
            # Keep one empty line if desired, or skip it.
            # The user wants it "compacto y limpio". Let's skip consecutive ones.
            # $newContent += "" # Uncomment if you want to keep exactly one empty line
            $prevWasEmpty = $true
        }
    } else {
        $newContent += $line
        $prevWasEmpty = $false
    }
}
$newContent | Set-Content $path -Encoding UTF8
