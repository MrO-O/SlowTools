import { useRef, type ChangeEvent } from 'react'
import { ActionBar } from '../../ui/ActionBar'
import { StatusMessage } from '../../ui/StatusMessage'
import { ToolSection } from '../../ui/ToolSection'
import type { RenamerSettings } from './types'

interface SourceSectionProps {
  settings: RenamerSettings
  sourceName: string
  canChooseDirectory: boolean
  isScanning: boolean
  isRenaming: boolean
  canScan: boolean
  onChooseDirectory: () => void
  onFilesSelected: (files: File[]) => void
  onScan: () => void
  onCancel: () => void
  onSettingChange: (key: keyof RenamerSettings, value: RenamerSettings[keyof RenamerSettings]) => void
}

export function SourceSection({
  settings,
  sourceName,
  canChooseDirectory,
  isScanning,
  isRenaming,
  canScan,
  onChooseDirectory,
  onFilesSelected,
  onScan,
  onCancel,
  onSettingChange,
}: SourceSectionProps) {
  const filesInput = useRef<HTMLInputElement | null>(null)

  const chooseFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    if (files.length) onFilesSelected(files)
    event.target.value = ''
  }

  return (
    <ToolSection title="1. 文件来源与扫描" description="选择文件夹或文件列表后扫描文件名，不会读取文件内容。">
      <input ref={filesInput} className="visually-hidden" type="file" multiple onChange={chooseFiles} />
      <ActionBar>
        <button className="button button--primary" type="button" onClick={onChooseDirectory} disabled={!canChooseDirectory || isScanning || isRenaming}>选择文件夹</button>
        <button className="button" type="button" onClick={() => filesInput.current?.click()} disabled={isScanning || isRenaming}>选择文件列表</button>
        <span className="selection-label">{sourceName || '尚未选择输入'}</span>
        <button className="button" type="button" onClick={onScan} disabled={!canScan || isScanning || isRenaming}>扫描文件</button>
        {isScanning && <button className="button" type="button" onClick={onCancel}>取消扫描</button>}
      </ActionBar>

      {!canChooseDirectory && <StatusMessage tone="warning">当前浏览器不支持直接选择文件夹；可以选择文件列表生成预览。</StatusMessage>}

      <div className="tool-settings tool-settings--scan">
        <label className="toggle-field"><input type="checkbox" checked={settings.recursive} onChange={(event) => onSettingChange('recursive', event.target.checked)} />递归扫描子文件夹</label>
        <label>最大深度<input type="number" min="1" max="20" value={settings.maxDepth} onChange={(event) => onSettingChange('maxDepth', Number(event.target.value))} /></label>
        <label>最大条目数<input type="number" min="1" max="100000" step="100" value={settings.maxEntries} onChange={(event) => onSettingChange('maxEntries', Number(event.target.value))} /></label>
        <label className="form-field--wide">排除目录（逗号或换行分隔）<textarea rows={2} value={settings.excludedNames} onChange={(event) => onSettingChange('excludedNames', event.target.value)} /></label>
      </div>
    </ToolSection>
  )
}
