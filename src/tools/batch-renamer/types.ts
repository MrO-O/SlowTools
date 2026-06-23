export type RenameStatus = 'unchanged' | 'ready' | 'conflict' | 'invalid' | 'duplicate' | 'risky'

export interface ScannedFile {
  id: string
  path: string
  directoryPath: string
  name: string
  handle?: FileSystemFileHandle
  parentHandle?: FileSystemDirectoryHandle
}

export interface ScanProgress {
  files: number
  directories: number
  totalEntries: number
}

export interface RenameRules {
  matchMode: 'literal' | 'wildcard'
  findText: string
  replaceText: string
  spaceMode: 'keep' | 'underscore' | 'hyphen'
  trimExtraSpaces: boolean
  prefix: string
  suffix: string
  caseMode: 'keep' | 'lower' | 'upper'
  modifyExtension: boolean
  numberingEnabled: boolean
  numberStart: number
  numberPadding: number
  numberPosition: 'prefix' | 'suffix'
}

export interface RenamePreviewItem extends ScannedFile {
  newName: string
  newPath: string
  status: RenameStatus
  notes: string[]
  executed?: 'success' | 'failed'
}

export interface RenameSummary {
  unchanged: number
  ready: number
  conflict: number
  invalid: number
  duplicate: number
  risky: number
}
