import { useEffect, useMemo, useRef, useState } from 'react'
import { StatusMessage } from '../../ui/StatusMessage'
import { ToolHeader } from '../../ui/ToolHeader'
import { readStoredText, writeStoredText } from '../../storage/localStorage'
import { makeRenamePreview, summarizePreview } from './renameRules'
import { DEFAULT_EXCLUDED_NAMES, parseExcludedNames, ScanCancelledError, scanDirectoryFiles, scanSelectedFiles } from './scanFiles'
import { makeCsv, makeNodeScript, makePowerShellScript } from './scriptExport'
import { PreviewSection } from './PreviewSection'
import { RenameRulesSection } from './RenameRulesSection'
import { SourceSection } from './SourceSection'
import type { RenamerSettings, RenamePreviewItem, ScanProgress, ScannedFile } from './types'

const settingsKey = 'slowtools:batch-renamer:settings'

const defaultSettings: RenamerSettings = {
  recursive: false,
  maxDepth: 3,
  maxEntries: 10_000,
  excludedNames: DEFAULT_EXCLUDED_NAMES.join(', '),
  matchMode: 'literal',
  findText: '',
  replaceText: '',
  spaceMode: 'keep',
  trimExtraSpaces: true,
  prefix: '',
  suffix: '',
  caseMode: 'keep',
  modifyExtension: false,
  numberingEnabled: false,
  numberStart: 1,
  numberPadding: 3,
  numberPosition: 'prefix',
}

type MovableFileHandle = FileSystemFileHandle & {
  move?: (destination: FileSystemDirectoryHandle, newName?: string) => Promise<void>
}

const emptyProgress: ScanProgress = { files: 0, directories: 0, totalEntries: 0 }

function getStoredSettings(): RenamerSettings {
  try {
    return { ...defaultSettings, ...(JSON.parse(readStoredText(settingsKey, '{}')) as Partial<RenamerSettings>) }
  } catch {
    return defaultSettings
  }
}

function download(text: string, fileName: string, mimeType = 'text/plain;charset=utf-8') {
  const blob = new Blob([text], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

export function BatchRenamerTool() {
  const [settings, setSettings] = useState<RenamerSettings>(getStoredSettings)
  const [directory, setDirectory] = useState<FileSystemDirectoryHandle | null>(null)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [sourceName, setSourceName] = useState('')
  const [scannedFiles, setScannedFiles] = useState<ScannedFile[]>([])
  const [preview, setPreview] = useState<RenamePreviewItem[]>([])
  const [progress, setProgress] = useState<ScanProgress>(emptyProgress)
  const [isScanning, setIsScanning] = useState(false)
  const [isRenaming, setIsRenaming] = useState(false)
  const [message, setMessage] = useState('')
  const [scanWarning, setScanWarning] = useState('')
  const abortController = useRef<AbortController | null>(null)
  const directoryPicker = (window as unknown as { showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker

  useEffect(() => {
    writeStoredText(settingsKey, JSON.stringify(settings))
  }, [settings])

  useEffect(() => () => abortController.current?.abort(), [])

  const updateSetting = (key: keyof RenamerSettings, value: RenamerSettings[keyof RenamerSettings]) => {
    setSettings((current) => ({ ...current, [key]: value }))
  }

  const summary = useMemo(() => summarizePreview(preview), [preview])
  const canDirectRename = useMemo(() => !scanWarning.includes('扫描已截断') && preview.some((item) => item.status === 'ready') && preview
    .filter((item) => item.status === 'ready')
    .every((item) => typeof (item.handle as MovableFileHandle | undefined)?.move === 'function' && item.parentHandle), [preview, scanWarning])

  const resetScanResult = () => {
    setScannedFiles([])
    setPreview([])
    setProgress(emptyProgress)
    setScanWarning('')
  }

  const clearAll = () => {
    abortController.current?.abort()
    setDirectory(null)
    setSelectedFiles([])
    setSourceName('')
    resetScanResult()
    setMessage('')
  }

  const selectDirectory = async () => {
    if (!directoryPicker) return
    try {
      const selected = await directoryPicker()
      setDirectory(selected)
      setSelectedFiles([])
      setSourceName(selected.name)
      resetScanResult()
      setMessage('文件夹已选择，可以开始扫描。')
    } catch (error) {
      if ((error as DOMException).name !== 'AbortError') {
        setMessage('无法选择文件夹。请确认浏览器已授予访问权限后重试。')
      }
    }
  }

  const selectFiles = (files: File[]) => {
    const root = files[0].webkitRelativePath.split('/').filter(Boolean)[0]
    setDirectory(null)
    setSelectedFiles(files)
    setSourceName(root || `${files.length} 个文件`)
    resetScanResult()
    setMessage('文件列表已选择，可以开始扫描。')
  }

  const scanFiles = async () => {
    if (!directory && !selectedFiles.length) {
      setMessage('请先选择文件夹或文件列表。')
      return
    }
    const controller = new AbortController()
    abortController.current = controller
    setIsScanning(true)
    setProgress(emptyProgress)
    setPreview([])
    setScanWarning('')
    setMessage('正在扫描文件名…')

    const options = {
      recursive: settings.recursive,
      maxDepth: Math.max(1, Math.min(20, Math.floor(settings.maxDepth) || 1)),
      maxEntries: Math.max(1, Math.min(100_000, Math.floor(settings.maxEntries) || 1)),
      excludedNames: parseExcludedNames(settings.excludedNames),
      signal: controller.signal,
      onProgress: setProgress,
    }

    try {
      const result = directory
        ? await scanDirectoryFiles(directory, options)
        : await scanSelectedFiles(selectedFiles, options)
      setScannedFiles(result.files)
      setProgress(result.progress)
      setScanWarning([
        result.truncated ? `达到 ${options.maxEntries.toLocaleString()} 项上限，扫描已截断。` : '',
        result.depthLimited ? `达到 ${options.maxDepth} 层深度限制，未继续扫描更深目录。` : '',
      ].filter(Boolean).join(' '))
      setMessage(`扫描完成：找到 ${result.files.length} 个文件。现在可以生成重命名预览。`)
    } catch (error) {
      setMessage(error instanceof ScanCancelledError ? '扫描已取消。' : '扫描失败。请重新选择文件夹或文件列表后再试。')
    } finally {
      if (abortController.current === controller) abortController.current = null
      setIsScanning(false)
    }
  }

  const generatePreview = () => {
    if (!scannedFiles.length) {
      setMessage('请先扫描至少一个文件。')
      return
    }
    const nextPreview = makeRenamePreview(scannedFiles, settings)
    setPreview(nextPreview)
    const nextSummary = summarizePreview(nextPreview)
    setMessage(nextSummary.ready ? `已生成预览：${nextSummary.ready} 项可用于安全脚本导出。` : '已生成预览，但没有可安全重命名的文件。请检查规则和风险提示。')
  }

  const runDirectRename = async () => {
    const readyItems = preview.filter((item) => item.status === 'ready')
    if (!readyItems.length || !canDirectRename) return
    if (!window.confirm(`确认直接重命名 ${readyItems.length} 个文件吗？此操作无法在本工具中撤销。`)) return

    setIsRenaming(true)
    setMessage('正在执行真实重命名…')
    const nextPreview = [...preview]
    for (const item of readyItems) {
      try {
        await (item.handle as MovableFileHandle).move!(item.parentHandle!, item.newName)
        const index = nextPreview.findIndex((entry) => entry.id === item.id)
        nextPreview[index] = { ...nextPreview[index], executed: 'success' }
      } catch {
        const index = nextPreview.findIndex((entry) => entry.id === item.id)
        nextPreview[index] = { ...nextPreview[index], executed: 'failed', notes: [...nextPreview[index].notes, '真实重命名失败，已停止后续操作。'] }
        setPreview(nextPreview)
        setMessage(`重命名在 ${item.path} 处失败，已停止，未继续处理剩余文件。`)
        setIsRenaming(false)
        return
      }
    }
    setPreview(nextPreview)
    setMessage(`已成功重命名 ${readyItems.length} 个文件。建议重新扫描确认结果。`)
    setIsRenaming(false)
  }

  return (
    <div className="tool-panel batch-renamer">
      <ToolHeader
        eyebrow="文件工具"
        title="Batch File Renamer"
        description="先预览和检查风险，再选择直接重命名或导出本地脚本。不会上传或读取文件内容。"
        actions={<button className="button button--quiet" type="button" onClick={clearAll} disabled={isScanning || isRenaming}>清空</button>}
      />

      <div className="tool-status-area" aria-live="polite">
        {isScanning && <StatusMessage>正在扫描：文件 {progress.files}，文件夹 {progress.directories}，共 {progress.totalEntries} 项。</StatusMessage>}
        {scanWarning && <StatusMessage tone="warning">{scanWarning}</StatusMessage>}
        {message && <StatusMessage tone="info">{message}</StatusMessage>}
      </div>

      <div className="batch-layout">
        <div className="batch-layout__controls">
          <SourceSection
            settings={settings}
            sourceName={sourceName}
            canChooseDirectory={Boolean(directoryPicker)}
            isScanning={isScanning}
            isRenaming={isRenaming}
            canScan={Boolean(directory || selectedFiles.length)}
            onChooseDirectory={selectDirectory}
            onFilesSelected={selectFiles}
            onScan={scanFiles}
            onCancel={() => abortController.current?.abort()}
            onSettingChange={updateSetting}
          />
          <RenameRulesSection settings={settings} onSettingChange={updateSetting} />
        </div>

        <div className="batch-layout__results">
          <PreviewSection
            preview={preview}
            summary={summary}
            canGenerate={Boolean(scannedFiles.length) && !isScanning}
            canDirectRename={canDirectRename}
            isRenaming={isRenaming}
            onGenerate={generatePreview}
            onDirectRename={runDirectRename}
            onExportPowerShell={() => download(makePowerShellScript(preview), 'slowtools-rename.ps1')}
            onExportNode={() => download(makeNodeScript(preview), 'slowtools-rename.mjs')}
            onExportCsv={() => download(makeCsv(preview), 'slowtools-rename-map.csv', 'text/csv;charset=utf-8')}
          />
        </div>
      </div>
    </div>
  )
}
