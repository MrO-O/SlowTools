export const DEFAULT_EXCLUDED_NAMES = [
  '.git',
  'node_modules',
  'dist',
  'build',
  '.next',
  '.cache',
  'target',
  '.venv',
  '__pycache__',
]

export interface ScanProgress {
  files: number
  directories: number
  totalEntries: number
}

export interface FolderTreeOptions {
  maxDepth: number
  maxEntries: number
  excludedNames: string[]
  includeFiles: boolean
  includeHidden: boolean
  sortEntries: boolean
  signal: AbortSignal
  onProgress: (progress: ScanProgress) => void
}

export interface FolderTreeResult {
  text: string
  progress: ScanProgress
  truncated: boolean
}

export class ScanCancelledError extends Error {
  constructor() {
    super('Scan cancelled')
    this.name = 'ScanCancelledError'
  }
}

type DirectoryEntry = [string, FileSystemHandle]
type IterableDirectoryHandle = FileSystemDirectoryHandle & {
  entries: () => AsyncIterableIterator<DirectoryEntry>
}

const YIELD_EVERY = 100

function yieldToBrowser(): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, 0))
}

function isHidden(name: string): boolean {
  return name.startsWith('.')
}

export function parseExcludedNames(value: string): string[] {
  return value
    .split(/[\n,]/u)
    .map((name) => name.trim())
    .filter(Boolean)
}

/**
 * Traverses only directory metadata. Files are represented by their handles and
 * names; getFile() is intentionally never called.
 */
export async function generateFolderTree(
  root: FileSystemDirectoryHandle,
  options: FolderTreeOptions,
): Promise<FolderTreeResult> {
  const progress: ScanProgress = { files: 0, directories: 0, totalEntries: 0 }
  const lines = [`${root.name}/`]
  const excludedNames = new Set(options.excludedNames)
  let truncated = false
  // Entries are reserved as soon as they are discovered. This keeps nested
  // directories within the global limit even when sorting buffers siblings.
  let reservedEntries = 0
  let workSinceYield = 0

  const checkCancelled = () => {
    if (options.signal.aborted) {
      throw new ScanCancelledError()
    }
  }

  const reportProgress = () => options.onProgress({ ...progress })

  const yieldWhenNeeded = async () => {
    workSinceYield += 1
    if (workSinceYield >= YIELD_EVERY) {
      reportProgress()
      await yieldToBrowser()
      workSinceYield = 0
      checkCancelled()
    }
  }

  const listEntries = async (directory: FileSystemDirectoryHandle): Promise<DirectoryEntry[]> => {
    const entries: DirectoryEntry[] = []

    const iterableDirectory = directory as IterableDirectoryHandle
    for await (const [name, handle] of iterableDirectory.entries()) {
      checkCancelled()

      if (excludedNames.has(name) || (!options.includeHidden && isHidden(name))) {
        continue
      }

      if (reservedEntries >= options.maxEntries) {
        truncated = true
        break
      }

      entries.push([name, handle])
      reservedEntries += 1
      await yieldWhenNeeded()
    }

    if (options.sortEntries) {
      entries.sort(([nameA, handleA], [nameB, handleB]) => {
        if (handleA.kind !== handleB.kind) {
          return handleA.kind === 'directory' ? -1 : 1
        }

        return nameA.localeCompare(nameB)
      })
    }

    return entries
  }

  const walk = async (
    directory: FileSystemDirectoryHandle,
    prefix: string,
    depth: number,
  ): Promise<void> => {
    const entries = await listEntries(directory)

    for (let index = 0; index < entries.length; index += 1) {
      checkCancelled()

      const [name, handle] = entries[index]
      const isLast = index === entries.length - 1
      const branch = isLast ? '└─ ' : '├─ '
      const childPrefix = `${prefix}${isLast ? '   ' : '│  '}`

      progress.totalEntries += 1
      if (handle.kind === 'file') {
        progress.files += 1
        if (options.includeFiles) {
          lines.push(`${prefix}${branch}${name}`)
        }
      } else {
        progress.directories += 1
        lines.push(`${prefix}${branch}${name}/`)

        if (depth + 1 >= options.maxDepth) {
          lines.push(`${childPrefix}└─ … (max depth reached)`)
        } else {
          await walk(handle as FileSystemDirectoryHandle, childPrefix, depth + 1)
        }
      }

      await yieldWhenNeeded()
    }
  }

  if (options.maxEntries < 1) {
    truncated = true
  } else {
    await walk(root, '', 0)
  }

  reportProgress()
  if (truncated) {
    lines.push('')
    lines.push(`… Scan truncated after ${progress.totalEntries} entries (entry limit: ${options.maxEntries}).`)
  }

  return { text: lines.join('\n'), progress, truncated }
}
