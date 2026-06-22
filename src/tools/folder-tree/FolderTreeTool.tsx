import { useEffect, useRef, useState } from 'react'
import { readStoredText, writeStoredText } from '../../storage/localStorage'
import {
  DEFAULT_EXCLUDED_NAMES,
  generateFolderTree,
  generateFolderTreeFromFiles,
  parseExcludedNames,
  ScanCancelledError,
  type ScanProgress,
} from './folderTree'

const settingsKey = 'slowtools:folder-tree:settings'

interface FolderTreeSettings {
  maxDepth: number
  maxEntries: number
  excludedNames: string
  includeFiles: boolean
  includeHidden: boolean
  sortEntries: boolean
}

const defaultSettings: FolderTreeSettings = {
  maxDepth: 8,
  maxEntries: 10_000,
  excludedNames: DEFAULT_EXCLUDED_NAMES.join(', '),
  includeFiles: true,
  includeHidden: false,
  sortEntries: true,
}

function getStoredSettings(): FolderTreeSettings {
  try {
    const stored = JSON.parse(readStoredText(settingsKey, '{}')) as Partial<FolderTreeSettings>
    return { ...defaultSettings, ...stored }
  } catch {
    return defaultSettings
  }
}

function makeDownload(text: string, extension: 'txt' | 'md') {
  const content = extension === 'md' ? `\`\`\`text\n${text}\n\`\`\`\n` : text
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `folder-tree.${extension}`
  link.click()
  URL.revokeObjectURL(url)
}

const emptyProgress: ScanProgress = { files: 0, directories: 0, totalEntries: 0 }

export function FolderTreeTool() {
  const [settings, setSettings] = useState<FolderTreeSettings>(getStoredSettings)
  const [directory, setDirectory] = useState<FileSystemDirectoryHandle | null>(null)
  const [fallbackFiles, setFallbackFiles] = useState<File[]>([])
  const [fallbackRootName, setFallbackRootName] = useState('')
  const [result, setResult] = useState('')
  const [progress, setProgress] = useState<ScanProgress>(emptyProgress)
  const [isScanning, setIsScanning] = useState(false)
  const [wasTruncated, setWasTruncated] = useState(false)
  const [message, setMessage] = useState('')
  const abortController = useRef<AbortController | null>(null)
  const fallbackInput = useRef<HTMLInputElement | null>(null)
  const picker = (window as unknown as {
    showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>
  }).showDirectoryPicker

  useEffect(() => {
    writeStoredText(settingsKey, JSON.stringify(settings))
  }, [settings])

  useEffect(() => () => abortController.current?.abort(), [])

  const updateSetting = <Key extends keyof FolderTreeSettings>(key: Key, value: FolderTreeSettings[Key]) => {
    setSettings((current) => ({ ...current, [key]: value }))
  }

  const chooseDirectory = async () => {
    if (!picker) {
      fallbackInput.current?.setAttribute('webkitdirectory', '')
      fallbackInput.current?.click()
      return
    }

    try {
      const selectedDirectory = await picker()
      setDirectory(selectedDirectory)
      setFallbackFiles([])
      setFallbackRootName('')
      setMessage('')
    } catch (error) {
      if ((error as DOMException).name !== 'AbortError') {
        setMessage('无法选择文件夹。请确认浏览器已授予访问权限后重试。')
      }
    }
  }

  const chooseFallbackDirectory = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files ?? [])
    if (!selectedFiles.length) {
      return
    }

    const relativePath = selectedFiles[0].webkitRelativePath
    const rootName = relativePath.split('/').filter(Boolean)[0] || 'selected-folder'
    setDirectory(null)
    setFallbackFiles(selectedFiles)
    setFallbackRootName(rootName)
    setMessage(`已选择 ${rootName}（兼容模式不会显示空文件夹）。`)
    event.target.value = ''
  }

  const startScan = async () => {
    if (!directory && !fallbackFiles.length) {
      setMessage('请先选择一个本地文件夹。')
      return
    }

    const controller = new AbortController()
    abortController.current = controller
    setIsScanning(true)
    setResult('')
    setProgress(emptyProgress)
    setWasTruncated(false)
    setMessage('正在扫描目录…')

    try {
      const scanOptions = {
        maxDepth: Math.max(0, Math.min(50, Math.floor(settings.maxDepth) || 0)),
        maxEntries: Math.max(1, Math.min(100_000, Math.floor(settings.maxEntries) || 1)),
        excludedNames: parseExcludedNames(settings.excludedNames),
        includeFiles: settings.includeFiles,
        includeHidden: settings.includeHidden,
        sortEntries: settings.sortEntries,
        signal: controller.signal,
        onProgress: setProgress,
      }
      const scanResult = directory
        ? await generateFolderTree(directory, scanOptions)
        : await generateFolderTreeFromFiles(fallbackFiles, fallbackRootName, scanOptions)
      setResult(scanResult.text)
      setProgress(scanResult.progress)
      setWasTruncated(scanResult.truncated)
      setMessage(scanResult.truncated ? '扫描完成，结果已截断。' : '扫描完成。')
    } catch (error) {
      if (error instanceof ScanCancelledError) {
        setMessage('扫描已取消。')
      } else {
        setMessage('扫描失败。请确认浏览器仍有权限访问该文件夹，然后重试。')
      }
    } finally {
      if (abortController.current === controller) {
        abortController.current = null
      }
      setIsScanning(false)
    }
  }

  const clearResult = () => {
    abortController.current?.abort()
    setResult('')
    setProgress(emptyProgress)
    setWasTruncated(false)
    setMessage('')
  }

  const copyResult = async () => {
    try {
      await navigator.clipboard.writeText(result)
      setMessage('目录树已复制。')
    } catch {
      setMessage('复制失败。请手动选择并复制结果。')
    }
  }

  return (
    <div className="tool-panel folder-tree-panel">
      <div className="tool-panel-heading">
        <div>
          <span className="eyebrow">文件工具</span>
          <h2>Folder Tree Generator</h2>
          <p>从本地文件夹生成目录树。不上传文件，也不会读取文件内容。</p>
        </div>
        <button className="clear-button" type="button" onClick={clearResult} disabled={!result && !isScanning}>
          清空结果
        </button>
      </div>

      {!picker && <p className="tool-message is-warning">当前浏览器使用兼容模式：可选择包含文件的文件夹，但空文件夹不会出现在目录树中。</p>}

      <input ref={fallbackInput} className="visually-hidden" type="file" multiple onChange={chooseFallbackDirectory} />

      <div className="folder-tree-actions">
        <button className="primary-button" type="button" onClick={chooseDirectory} disabled={isScanning}>
          选择文件夹
        </button>
        <span className="selected-directory">{directory?.name || fallbackRootName || '尚未选择文件夹'}</span>
        <button className="secondary-button" type="button" onClick={startScan} disabled={isScanning || (!directory && !fallbackFiles.length)}>
          开始生成
        </button>
        {isScanning && (
          <button className="secondary-button" type="button" onClick={() => abortController.current?.abort()}>
            取消扫描
          </button>
        )}
      </div>

      <div className="folder-settings">
        <label>
          最大深度
          <input type="number" min="0" max="50" value={settings.maxDepth} onChange={(event) => updateSetting('maxDepth', Number(event.target.value))} />
        </label>
        <label>
          最大条目数
          <input type="number" min="1" max="100000" step="100" value={settings.maxEntries} onChange={(event) => updateSetting('maxEntries', Number(event.target.value))} />
        </label>
        <label className="excluded-field">
          排除目录（按名称，用逗号或换行分隔）
          <textarea rows={3} value={settings.excludedNames} onChange={(event) => updateSetting('excludedNames', event.target.value)} />
        </label>
        <div className="checkbox-row" role="group" aria-label="扫描选项">
          <label><input type="checkbox" checked={settings.includeFiles} onChange={(event) => updateSetting('includeFiles', event.target.checked)} />显示文件</label>
          <label><input type="checkbox" checked={settings.includeHidden} onChange={(event) => updateSetting('includeHidden', event.target.checked)} />显示隐藏文件</label>
          <label><input type="checkbox" checked={settings.sortEntries} onChange={(event) => updateSetting('sortEntries', event.target.checked)} />按名称排序</label>
        </div>
      </div>

      <div className="scan-status" aria-live="polite">
        <span>文件 {progress.files}</span>
        <span>文件夹 {progress.directories}</span>
        <span>已扫描 {progress.totalEntries} 项</span>
        {wasTruncated && <strong>已截断</strong>}
      </div>
      {message && <p className="tool-message">{message}</p>}

      <div className="result-heading">
        <label htmlFor="folder-tree-result">目录树结果</label>
        <div>
          <button className="text-button" type="button" onClick={copyResult} disabled={!result}>复制</button>
          <button className="text-button" type="button" onClick={() => makeDownload(result, 'txt')} disabled={!result}>下载 .txt</button>
          <button className="text-button" type="button" onClick={() => makeDownload(result, 'md')} disabled={!result}>下载 .md</button>
        </div>
      </div>
      <textarea
        id="folder-tree-result"
        className="folder-tree-result"
        value={result}
        readOnly
        rows={16}
        placeholder="选择文件夹后，目录树会显示在这里。"
      />
    </div>
  )
}
