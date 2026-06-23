import type { RenamePreviewItem } from './types'

interface RenameMapping {
  oldPath: string
  newPath: string
}

function getReadyMappings(items: RenamePreviewItem[]): RenameMapping[] {
  return items
    .filter((item) => item.status === 'ready')
    .map((item) => ({ oldPath: item.path, newPath: item.newPath }))
}

function toBase64(value: string): string {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  bytes.forEach((byte) => { binary += String.fromCharCode(byte) })
  return btoa(binary)
}

export function makePowerShellScript(items: RenamePreviewItem[]): string {
  const mappings = toBase64(JSON.stringify(getReadyMappings(items)))
  return `# SlowTools Batch File Renamer\n# Set $Root to the folder that was scanned. Keep $DryRun = $true to preview.\n\n$Root = 'CHANGE_ME'\n$DryRun = $true\n$MappingBase64 = '${mappings}'\n$Renames = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($MappingBase64)) | ConvertFrom-Json\n\nforeach ($item in $Renames) {\n  $source = Join-Path -Path $Root -ChildPath $item.oldPath\n  $target = Join-Path -Path $Root -ChildPath $item.newPath\n\n  if (-not (Test-Path -LiteralPath $source -PathType Leaf)) {\n    Write-Warning "Missing source: $source"\n    continue\n  }\n  if (Test-Path -LiteralPath $target) {\n    Write-Warning "Target already exists, skipped: $target"\n    continue\n  }\n  if ($DryRun) {\n    Write-Host "[dry-run] $source -> $target"\n    continue\n  }\n  try {\n    Rename-Item -LiteralPath $source -NewName (Split-Path -Leaf $target) -ErrorAction Stop\n    Write-Host "Renamed: $source -> $target"\n  } catch {\n    Write-Warning "Failed: $source :: $($_.Exception.Message)"\n    break\n  }\n}\n`
}

export function makeNodeScript(items: RenamePreviewItem[]): string {
  const mappings = toBase64(JSON.stringify(getReadyMappings(items)))
  return `// SlowTools Batch File Renamer\n// Set ROOT to the folder that was scanned. Keep DRY_RUN = true to preview.\n\nimport { access, rename } from 'node:fs/promises'\nimport path from 'node:path'\n\nconst ROOT = 'CHANGE_ME'\nconst DRY_RUN = true\nconst renames = JSON.parse(Buffer.from('${mappings}', 'base64').toString('utf8'))\n\nasync function exists(filePath) {\n  try { await access(filePath); return true } catch { return false }\n}\n\nfor (const item of renames) {\n  const source = path.resolve(ROOT, item.oldPath)\n  const target = path.resolve(ROOT, item.newPath)\n  if (!(await exists(source))) {\n    console.warn('Missing source:', source)\n    continue\n  }\n  if (await exists(target)) {\n    console.warn('Target already exists, skipped:', target)\n    continue\n  }\n  if (DRY_RUN) {\n    console.log('[dry-run]', source, '->', target)\n    continue\n  }\n  try {\n    await rename(source, target)\n    console.log('Renamed:', source, '->', target)\n  } catch (error) {\n    console.error('Failed:', source, error.message)\n    break\n  }\n}\n`
}

function csvCell(value: string): string {
  return `"${value.replace(/"/gu, '""')}"`
}

export function makeCsv(items: RenamePreviewItem[]): string {
  const rows = ['old_path,new_path,status,notes']
  items.forEach((item) => rows.push([
    csvCell(item.path),
    csvCell(item.newPath),
    csvCell(item.status),
    csvCell(item.notes.join(' | ')),
  ].join(',')))
  return rows.join('\n')
}
