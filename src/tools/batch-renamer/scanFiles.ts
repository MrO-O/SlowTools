import type { ScanProgress, ScannedFile } from './types'

export const DEFAULT_EXCLUDED_NAMES = ['.git', 'node_modules', 'dist', 'build', '.next', '.cache']

export class ScanCancelledError extends Error {
  constructor() {
    super('Scan cancelled')
    this.name = 'ScanCancelledError'
  }
}

interface ScanOptions {
  recursive: boolean
  maxDepth: number
  maxEntries: number
  excludedNames: string[]
  signal: AbortSignal
  onProgress: (progress: ScanProgress) => void
}

interface ScanResult {
  files: ScannedFile[]
  progress: ScanProgress
  truncated: boolean
  depthLimited: boolean
}

type DirectoryEntry = [string, FileSystemHandle]
type IterableDirectoryHandle = FileSystemDirectoryHandle & { entries: () => AsyncIterableIterator<DirectoryEntry> }

const YIELD_EVERY = 100

function yieldToBrowser(): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, 0))
}

export function parseExcludedNames(value: string): string[] {
  return value.split(/[\n,]/u).map((name) => name.trim()).filter(Boolean)
}

export async function scanDirectoryFiles(root: FileSystemDirectoryHandle, options: ScanOptions): Promise<ScanResult> {
  const files: ScannedFile[] = []
  const progress: ScanProgress = { files: 0, directories: 0, totalEntries: 0 }
  const excluded = new Set(options.excludedNames)
  let truncated = false
  let depthLimited = false
  let work = 0

  const checkCancelled = () => {
    if (options.signal.aborted) throw new ScanCancelledError()
  }
  const update = () => options.onProgress({ ...progress })
  const yieldWhenNeeded = async () => {
    work += 1
    if (work >= YIELD_EVERY) {
      update()
      await yieldToBrowser()
      work = 0
      checkCancelled()
    }
  }

  const walk = async (directory: FileSystemDirectoryHandle, directoryPath: string, depth: number): Promise<void> => {
    const iterable = directory as IterableDirectoryHandle
    for await (const [name, handle] of iterable.entries()) {
      checkCancelled()
      if (progress.totalEntries >= options.maxEntries) {
        truncated = true
        return
      }
      progress.totalEntries += 1

      if (handle.kind === 'file') {
        progress.files += 1
        files.push({
          id: `${directoryPath}/${name}`,
          path: directoryPath ? `${directoryPath}/${name}` : name,
          directoryPath,
          name,
          handle: handle as FileSystemFileHandle,
          parentHandle: directory,
        })
      } else {
        progress.directories += 1
        if (excluded.has(name)) {
          await yieldWhenNeeded()
          continue
        }
        if (!options.recursive) {
          await yieldWhenNeeded()
          continue
        }
        if (depth + 1 >= options.maxDepth) {
          depthLimited = true
          await yieldWhenNeeded()
          continue
        }
        await walk(handle as FileSystemDirectoryHandle, directoryPath ? `${directoryPath}/${name}` : name, depth + 1)
        if (truncated) return
      }
      await yieldWhenNeeded()
    }
  }

  await walk(root, '', 0)
  update()
  return { files, progress, truncated, depthLimited }
}

export async function scanSelectedFiles(files: File[], options: ScanOptions): Promise<ScanResult> {
  const scannedFiles: ScannedFile[] = []
  const progress: ScanProgress = { files: 0, directories: 0, totalEntries: 0 }
  const excluded = new Set(options.excludedNames)
  let truncated = false

  for (let index = 0; index < files.length; index += 1) {
    if (options.signal.aborted) throw new ScanCancelledError()
    if (progress.totalEntries >= options.maxEntries) {
      truncated = true
      break
    }
    const file = files[index]
    const path = file.webkitRelativePath || file.name
    const parts = path.split('/').filter(Boolean)
    if (parts.some((part) => excluded.has(part))) continue

    const name = parts.at(-1) ?? file.name
    const directoryPath = parts.slice(0, -1).join('/')
    progress.files += 1
    progress.totalEntries += 1
    scannedFiles.push({ id: path, path, directoryPath, name })

    if ((index + 1) % YIELD_EVERY === 0) {
      options.onProgress({ ...progress })
      await yieldToBrowser()
    }
  }

  options.onProgress({ ...progress })
  return { files: scannedFiles, progress, truncated, depthLimited: false }
}
