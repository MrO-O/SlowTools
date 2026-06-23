import { ActionBar } from '../../ui/ActionBar'
import { ToolSection } from '../../ui/ToolSection'
import type { RenamePreviewItem, RenameSummary } from './types'

const PREVIEW_DISPLAY_LIMIT = 500

interface PreviewSectionProps {
  preview: RenamePreviewItem[]
  summary: RenameSummary
  canGenerate: boolean
  canDirectRename: boolean
  isRenaming: boolean
  onGenerate: () => void
  onDirectRename: () => void
  onExportPowerShell: () => void
  onExportNode: () => void
  onExportCsv: () => void
}

export function PreviewSection({
  preview,
  summary,
  canGenerate,
  canDirectRename,
  isRenaming,
  onGenerate,
  onDirectRename,
  onExportPowerShell,
  onExportNode,
  onExportCsv,
}: PreviewSectionProps) {
  const visiblePreview = preview.slice(0, PREVIEW_DISPLAY_LIMIT)
  const hasPreview = preview.length > 0

  return (
    <div className="preview-stack">
      <ToolSection
        title="3. 预览与安全检查"
        description={hasPreview ? '预览不会修改文件。请先处理冲突、重复和风险项。' : '扫描文件并设置规则后，在这里生成重命名预览。'}
        actions={<button className="button button--primary" type="button" onClick={onGenerate} disabled={!canGenerate || isRenaming}>生成预览</button>}
      >
        {!hasPreview ? <div className="empty-state">尚未生成预览。完整扫描后，点击“生成预览”检查名称变化与风险。</div> : <>
          <div className="summary-pills">
            <span>可执行 {summary.ready}</span><span>未变化 {summary.unchanged}</span><span>冲突 {summary.conflict}</span><span>重复 {summary.duplicate}</span><span>非法 {summary.invalid}</span><span>风险 {summary.risky}</span>
          </div>
          {preview.length > PREVIEW_DISPLAY_LIMIT && <p className="table-note">仅显示前 {PREVIEW_DISPLAY_LIMIT} 行；导出仍包含完整预览中的所有可执行项。</p>}
          <div className="table-wrap">
            <table className="preview-table">
              <thead><tr><th>旧路径</th><th>旧文件名</th><th>新文件名</th><th>状态</th></tr></thead>
              <tbody>{visiblePreview.map((item) => <tr key={item.id} className={`status-${item.status}`}><td>{item.path}</td><td>{item.name}</td><td>{item.newName || '—'}{item.notes.length > 0 && <small>{item.notes.join(' ')}</small>}</td><td>{item.executed === 'success' ? '已完成' : item.executed === 'failed' ? '失败' : item.status}</td></tr>)}</tbody>
            </table>
          </div>
        </>}
      </ToolSection>

      {hasPreview && <ToolSection title="4. 执行与导出" description={canDirectRename ? '当前环境支持直接重命名；执行前会再次确认。' : '当前环境不提供可靠的直接重命名能力，可导出 dry-run 脚本。'}>
        <ActionBar>
          {canDirectRename && <button className="button button--primary" type="button" onClick={onDirectRename} disabled={isRenaming}>确认并直接重命名</button>}
          <button className="button" type="button" onClick={onExportPowerShell}>导出 PowerShell</button>
          <button className="button" type="button" onClick={onExportNode}>导出 Node.js</button>
          <button className="button" type="button" onClick={onExportCsv}>导出 CSV</button>
        </ActionBar>
      </ToolSection>}
    </div>
  )
}
