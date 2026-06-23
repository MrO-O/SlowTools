import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { readStoredText, writeStoredText } from '../../storage/localStorage'
import { makeRenamePreview, summarizePreview } from './renameRules'
import { DEFAULT_EXCLUDED_NAMES, parseExcludedNames, ScanCancelledError, scanDirectoryFiles, scanSelectedFiles } from './scanFiles'
import { makeCsv, makeNodeScript, makePowerShellScript } from './scriptExport'
import type { RenamePreviewItem, RenameRules, ScanProgress, ScannedFile } from './types'

const settingsKey = 'slowtools:batch-renamer:settings'

interface RenamerSettings extends RenameRules {
  recursive: boolean
  maxDepth: number
  maxEntries: number
  excludedNames: string
}

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
  const filesInput = useRef<HTMLInputElement | null>(null)
  const directoryPicker = (window as unknown as { showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker

  useEffect(() => {
    writeStoredText(settingsKey, JSON.stringify(settings))
  }, [settings])

  useEffect(() => () => abortController.current?.abort(), [])

  const updateSetting = <Key extends keyof RenamerSettings>(key: Key, value: RenamerSettings[Key]) => {
    setSettings((current) => ({ ...current, [key]: value }))
  }

  const canDirectRename = useMemo(() => !scanWarning.includes('扫描已截断') && preview.some((item) => item.status === 'ready') && preview
    .filter((item) => item.status === 'ready')
    .every((item) => typeof (item.handle as MovableFileHandle | undefined)?.move === 'function' && item.parentHandle), [preview, scanWarning])
  const summary = useMemo(() => summarizePreview(preview), [preview])

  const clearAll = () => {
    abortController.current?.abort()
    setDirectory(null)
    setSelectedFiles([])
    setSourceName('')
    setScannedFiles([])
    setPreview([])
    setProgress(emptyProgress)
    setMessage('')
    setScanWarning('')
  }

  const selectDirectory = async () => {
    if (!directoryPicker) {
      setMessage('当前浏览器不支持直接选择文件夹。请使用“选择文件列表”，或在 Chromium 系浏览器中选择文件夹。')
      return
    }
    try {
      const selected = await directoryPicker()
      setDirectory(selected)
      setSelectedFiles([])
      setSourceName(selected.name)
      setScannedFiles([])
      setPreview([])
      setMessage('文件夹已选择，点击“扫描文件”后生成规则预览。')
    } catch (error) {
      if ((error as DOMException).name !== 'AbortError') {
        setMessage('无法选择文件夹。请确认浏览器已授予访问权限后重试。')
      }
    }
  }

  const selectFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    if (!files.length) return
    const root = files[0].webkitRelativePath.split('/').filter(Boolean)[0]
    setDirectory(null)
    setSelectedFiles(files)
    setSourceName(root || `${files.length} 个文件`)
    setScannedFiles([])
    setPreview([])
    setMessage('文件列表已选择，点击“扫描文件”后生成规则预览。')
    event.target.value = ''
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
    setMessage(nextSummary.ready
      ? `已生成预览：${nextSummary.ready} 项可用于安全脚本导出。`
      : '已生成预览，但没有可安全重命名的文件。请检查规则和风险提示。')
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
    <div className="tool-panel batch-renamer-panel">
      <div className="tool-panel-heading">
        <div>
          <span className="eyebrow">文件工具</span>
          <h2>Batch File Renamer</h2>
          <p>先预览和检查风险，再选择直接重命名或导出本地脚本。不会上传或读取文件内容。</p>
        </div>
        <button className="clear-button" type="button" onClick={clearAll} disabled={isScanning || isRenaming}>清空</button>
      </div>

      <input ref={filesInput} className="visually-hidden" type="file" multiple onChange={selectFiles} />
      <div className="folder-tree-actions">
        <button className="primary-button" type="button" onClick={selectDirectory} disabled={isScanning || isRenaming || !directoryPicker}>选择文件夹</button>
        <button className="secondary-button" type="button" onClick={() => filesInput.current?.click()} disabled={isScanning || isRenaming}>选择文件列表</button>
        <span className="selected-directory">{sourceName || '尚未选择输入'}</span>
        <button className="secondary-button" type="button" onClick={scanFiles} disabled={isScanning || isRenaming || (!directory && !selectedFiles.length)}>扫描文件</button>
        {isScanning && <button className="secondary-button" type="button" onClick={() => abortController.current?.abort()}>取消扫描</button>}
      </div>
      {!directoryPicker && <p className="tool-message is-warning">当前浏览器不支持直接选择文件夹。可选择多个文件生成预览；如需扫描文件夹，请使用 Chromium 系浏览器。</p>}

      <div className="folder-settings renamer-settings">
        <label><input type="checkbox" checked={settings.recursive} onChange={(event) => updateSetting('recursive', event.target.checked)} />递归扫描子文件夹</label>
        <label>最大深度<input type="number" min="1" max="20" value={settings.maxDepth} onChange={(event) => updateSetting('maxDepth', Number(event.target.value))} /></label>
        <label>最大条目数<input type="number" min="1" max="100000" step="100" value={settings.maxEntries} onChange={(event) => updateSetting('maxEntries', Number(event.target.value))} /></label>
        <label className="excluded-field">排除目录（逗号或换行分隔）<textarea rows={2} value={settings.excludedNames} onChange={(event) => updateSetting('excludedNames', event.target.value)} /></label>
      </div>

      <section className="rename-rules" aria-labelledby="rename-rules-title">
        <div className="rules-heading"><h3 id="rename-rules-title">重命名规则</h3><p>修改规则不会改动文件；请先生成预览。</p></div>

        <div className="rule-group">
          <h4>文本匹配</h4>
          <div className="rules-grid">
            <label>匹配模式<select value={settings.matchMode} onChange={(event) => updateSetting('matchMode', event.target.value as RenameRules['matchMode'])}><option value="literal">普通文本（替换所有出现位置）</option><option value="wildcard">通配符（匹配整个文件名）</option></select></label>
            <label>查找内容<input value={settings.findText} placeholder={settings.matchMode === 'wildcard' ? settings.modifyExtension ? '例如：report-*.txt' : '例如：report-*' : '例如：draft'} onChange={(event) => updateSetting('findText', event.target.value)} /></label>
            <label>替换为<input value={settings.replaceText} placeholder="留空即删除匹配内容" onChange={(event) => updateSetting('replaceText', event.target.value)} /></label>
          </div>
          <p className="rule-help">普通文本会替换所有匹配内容。通配符会匹配当前处理范围（默认仅文件名）；只支持 <code>*</code>（任意文本）和 <code>?</code>（一个字符），不支持正则表达式。</p>
        </div>

        <div className="rule-group">
          <h4>空格规范化</h4>
          <div className="checkbox-row" role="group" aria-label="空格规则">
            <label><input type="checkbox" checked={settings.trimExtraSpaces} onChange={(event) => updateSetting('trimExtraSpaces', event.target.checked)} />先清理首尾空格，并合并连续空白</label>
            <label>再将空格输出为<select value={settings.spaceMode} onChange={(event) => updateSetting('spaceMode', event.target.value as RenameRules['spaceMode'])}><option value="keep">保留空格</option><option value="underscore">下划线</option><option value="hyphen">连字符</option></select></label>
          </div>
        </div>

        <div className="rule-group">
          <h4>附加与格式</h4>
          <div className="rules-grid">
            <label>前缀<input value={settings.prefix} onChange={(event) => updateSetting('prefix', event.target.value)} /></label>
            <label>后缀<input value={settings.suffix} onChange={(event) => updateSetting('suffix', event.target.value)} /></label>
            <label>大小写<select value={settings.caseMode} onChange={(event) => updateSetting('caseMode', event.target.value as RenameRules['caseMode'])}><option value="keep">保留</option><option value="lower">统一小写</option><option value="upper">统一大写</option></select></label>
            <label className="extension-scope">处理范围<span><input type="checkbox" checked={settings.modifyExtension} onChange={(event) => updateSetting('modifyExtension', event.target.checked)} />规则也作用于扩展名</span><small>默认只修改文件名；开启后文本、前后缀、大小写和编号也会处理扩展名。</small></label>
          </div>
        </div>

        <div className="rule-group">
          <h4>自动编号</h4>
          <div className="checkbox-row" role="group" aria-label="自动编号规则">
            <label><input type="checkbox" checked={settings.numberingEnabled} onChange={(event) => updateSetting('numberingEnabled', event.target.checked)} />启用自动编号</label>
            {settings.numberingEnabled && <><label>起始数字<input type="number" value={settings.numberStart} onChange={(event) => updateSetting('numberStart', Number(event.target.value))} /></label><label>位数<input type="number" min="1" max="12" value={settings.numberPadding} onChange={(event) => updateSetting('numberPadding', Number(event.target.value))} /></label><label>插入位置<select value={settings.numberPosition} onChange={(event) => updateSetting('numberPosition', event.target.value as RenameRules['numberPosition'])}><option value="prefix">文件名前</option><option value="suffix">文件名后</option></select></label></>}
          </div>
        </div>
      </section>

      <div className="scan-status" aria-live="polite"><span>文件 {progress.files}</span><span>文件夹 {progress.directories}</span><span>已扫描 {progress.totalEntries} 项</span></div>
      {scanWarning && <p className="tool-message is-warning">{scanWarning}</p>}
      {message && <p className="tool-message">{message}</p>}

      <div className="renamer-actions">
        <button className="secondary-button" type="button" onClick={generatePreview} disabled={!scannedFiles.length || isScanning || isRenaming}>生成预览</button>
        {canDirectRename ? <button className="primary-button" type="button" onClick={runDirectRename} disabled={isRenaming}>确认并直接重命名</button> : <span className="execution-note">当前环境只能导出脚本；不会在浏览器中假装完成重命名。</span>}
        <button className="text-button" type="button" onClick={() => download(makePowerShellScript(preview), 'slowtools-rename.ps1')} disabled={!preview.length}>导出 PowerShell</button>
        <button className="text-button" type="button" onClick={() => download(makeNodeScript(preview), 'slowtools-rename.mjs')} disabled={!preview.length}>导出 Node.js</button>
        <button className="text-button" type="button" onClick={() => download(makeCsv(preview), 'slowtools-rename-map.csv', 'text/csv;charset=utf-8')} disabled={!preview.length}>导出 CSV</button>
      </div>

      {preview.length > 0 && <>
        <div className="preview-summary">
          <span>可执行 {summary.ready}</span><span>未变化 {summary.unchanged}</span><span>冲突 {summary.conflict}</span><span>重复 {summary.duplicate}</span><span>非法 {summary.invalid}</span><span>风险 {summary.risky}</span>
        </div>
        <div className="preview-table-wrap">
          <table className="preview-table">
            <thead><tr><th>旧路径</th><th>旧文件名</th><th>新文件名</th><th>状态</th></tr></thead>
            <tbody>{preview.map((item) => <tr key={item.id} className={`status-${item.status}`}><td>{item.path}</td><td>{item.name}</td><td>{item.newName || '—'}{item.notes.length > 0 && <small>{item.notes.join(' ')}</small>}</td><td>{item.executed === 'success' ? '已完成' : item.executed === 'failed' ? '失败' : item.status}</td></tr>)}</tbody>
          </table>
        </div>
      </>}
    </div>
  )
}
