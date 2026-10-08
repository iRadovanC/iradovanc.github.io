$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')
$manifest = @()
function Save-Asset($entry, $destination) {
    New-Item -ItemType Directory -Force -Path (Split-Path $destination) | Out-Null
    Invoke-WebRequest -Uri $entry.url -OutFile $destination
    $hash = (Get-FileHash -LiteralPath $destination -Algorithm MD5).Hash.ToLower()
    if ($hash -ne $entry.md5) { throw "Checksum mismatch: $destination" }
    Write-Output "Verified $destination"
}
foreach ($id in @('wooden_military_crate', 'power_box_01')) {
    $files = Invoke-RestMethod -Uri "https://api.polyhaven.com/files/$id"
    $info = Invoke-RestMethod -Uri "https://api.polyhaven.com/info/$id"
    $entry = $files.gltf.'1k'.gltf
    $directory = "assets/models/$id"
    Save-Asset $entry "$directory/$id.gltf"
    foreach ($dependency in $entry.include.PSObject.Properties) {
        Save-Asset $dependency.Value "$directory/$($dependency.Name)"
    }
    $manifest += @{id=$id; page="https://polyhaven.com/a/$id"; license='CC0-1.0'; authors=$info.authors; source=$entry; downloaded='2026-09-21'}
}
foreach ($id in @('plastered_wall_05', 'sandstone_blocks_05')) {
    $files = Invoke-RestMethod -Uri "https://api.polyhaven.com/files/$id"
    $info = Invoke-RestMethod -Uri "https://api.polyhaven.com/info/$id"
    $maps = @{}
    foreach ($kind in @('Diffuse','nor_gl','Rough')) {
        $entry = $files.$kind.'1k'.jpg
        Save-Asset $entry "assets/textures/${id}_${kind}.jpg"
        $maps[$kind] = $entry
    }
    $manifest += @{id=$id; page="https://polyhaven.com/a/$id"; license='CC0-1.0'; authors=$info.authors; source=$maps; downloaded='2026-09-21'}
}
$manifest | ConvertTo-Json -Depth 12 | Set-Content -Encoding utf8 assets/baghdad-manifest.json
