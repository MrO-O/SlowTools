import type { RenamePreviewItem, RenameRules, RenameStatus, RenameSummary, ScannedFile } from './types'

const invalidWindowsCharacters = /[<>:"/\\|?*]/u
const reservedWindowsNames = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/iu

function splitFileName(name: string) {
  const lastDot = name.lastIndexOf('.')
  if (lastDot <= 0) {
    return { stem: name, extension: '' }
  }

  return { stem: name.slice(0, lastDot), extension: name.slice(lastDot) }
}

function wildcardToRegExp(pattern: string): RegExp {
  const escaped = pattern
    .split(/([*?])/u)
    .map((part) => {
      if (part === '*') return '.*'
      if (part === '?') return '.'
      return part.replace(/[|\\{}()[\]^$+?.]/gu, '\\$&')
    })
    .join('')
  return new RegExp(`^${escaped}$`, 'u')
}

function applyTextReplacement(value: string, rules: RenameRules): string {
  if (!rules.findText) return value
  if (rules.matchMode === 'literal') {
    return value.split(rules.findText).join(rules.replaceText)
  }
  return wildcardToRegExp(rules.findText).test(value) ? rules.replaceText : value
}

function transformText(value: string, rules: RenameRules): string {
  let result = applyTextReplacement(value, rules)
  if (rules.trimExtraSpaces) {
    result = result.trim().replace(/\s+/gu, ' ')
  }
  if (rules.spaceMode === 'underscore') {
    result = result.replace(/\s/gu, '_')
  } else if (rules.spaceMode === 'hyphen') {
    result = result.replace(/\s/gu, '-')
  }
  if (rules.caseMode === 'lower') {
    return result.toLowerCase()
  }
  if (rules.caseMode === 'upper') {
    return result.toUpperCase()
  }
  return result
}

function buildNewName(name: string, rules: RenameRules, index: number): string {
  const { stem, extension } = splitFileName(name)
  const source = rules.modifyExtension ? name : stem
  const renamed = `${rules.prefix}${transformText(source, rules)}${rules.suffix}`
  const number = rules.numberingEnabled
    ? String(rules.numberStart + index).padStart(Math.max(1, rules.numberPadding), '0')
    : ''
  const numbered = rules.numberingEnabled
    ? rules.numberPosition === 'prefix' ? `${number}${renamed}` : `${renamed}${number}`
    : renamed

  return rules.modifyExtension ? numbered : `${numbered}${extension}`
}

function getInvalidNote(name: string): string | null {
  if (!name.trim()) return '新文件名为空。'
  if (invalidWindowsCharacters.test(name)) return '包含 Windows 非法字符。'
  if (/[.\s]$/u.test(name)) return 'Windows 文件名不能以空格或句点结尾。'
  if (reservedWindowsNames.test(name)) return '使用了 Windows 保留名称。'
  return null
}

function makePath(directoryPath: string, name: string): string {
  return directoryPath ? `${directoryPath}/${name}` : name
}

export function makeRenamePreview(files: ScannedFile[], rules: RenameRules): RenamePreviewItem[] {
  const sortedFiles = [...files].sort((left, right) => left.path.localeCompare(right.path))
  const preview: RenamePreviewItem[] = sortedFiles.map((file, index) => {
    const newName = buildNewName(file.name, rules, index)
    return {
      ...file,
      newName,
      newPath: makePath(file.directoryPath, newName),
      status: newName === file.name ? 'unchanged' as RenameStatus : 'ready' as RenameStatus,
      notes: [],
    }
  })

  const byTarget = new Map<string, RenamePreviewItem[]>()
  const byOriginalPath = new Map(preview.map((item) => [item.path, item]))
  preview.forEach((item) => {
    const group = byTarget.get(item.newPath) ?? []
    group.push(item)
    byTarget.set(item.newPath, group)
  })

  preview.forEach((item) => {
    if (item.status === 'unchanged') return
    const invalidNote = getInvalidNote(item.newName)
    if (invalidNote) {
      item.status = 'invalid'
      item.notes.push(invalidNote)
      return
    }
    if ((byTarget.get(item.newPath)?.length ?? 0) > 1) {
      item.status = 'duplicate'
      item.notes.push('多个文件会得到同一个目标名称。')
      return
    }

    const existingTarget = byOriginalPath.get(item.newPath)
    if (existingTarget && existingTarget.path !== item.path) {
      if (existingTarget.newName === existingTarget.name) {
        item.status = 'conflict'
        item.notes.push('目标名称已被未改名的文件占用。')
      } else {
        item.status = 'risky'
        item.notes.push('目标名称属于本次队列中的另一个文件；需要临时名称才能安全交换。')
      }
      return
    }

    if (item.newPath.length >= 240) {
      item.status = 'risky'
      item.notes.push('目标相对路径接近 Windows 常见路径长度限制。')
    }
  })

  return preview
}

export function summarizePreview(items: RenamePreviewItem[]): RenameSummary {
  return items.reduce<RenameSummary>((summary, item) => {
    summary[item.status] += 1
    return summary
  }, { unchanged: 0, ready: 0, conflict: 0, invalid: 0, duplicate: 0, risky: 0 })
}
