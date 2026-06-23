import { ToolSection } from '../../ui/ToolSection'
import type { RenamerSettings, RenameRules } from './types'

interface RenameRulesSectionProps {
  settings: RenamerSettings
  onSettingChange: (key: keyof RenamerSettings, value: RenamerSettings[keyof RenamerSettings]) => void
}

export function RenameRulesSection({ settings, onSettingChange }: RenameRulesSectionProps) {
  return (
    <ToolSection title="2. 重命名规则" description="修改规则不会改动文件；请先生成预览。">
      <div className="rule-stack">
        <div className="rule-block">
          <h4>文本匹配</h4>
          <div className="form-grid">
            <label>匹配模式<select value={settings.matchMode} onChange={(event) => onSettingChange('matchMode', event.target.value as RenameRules['matchMode'])}><option value="literal">普通文本（替换所有出现位置）</option><option value="wildcard">通配符（匹配整个文件名）</option></select></label>
            <label>查找内容<input value={settings.findText} placeholder={settings.matchMode === 'wildcard' ? settings.modifyExtension ? '例如：report-*.txt' : '例如：report-*' : '例如：draft'} onChange={(event) => onSettingChange('findText', event.target.value)} /></label>
            <label>替换为<input value={settings.replaceText} placeholder="留空即删除匹配内容" onChange={(event) => onSettingChange('replaceText', event.target.value)} /></label>
          </div>
          <p className="field-help">普通文本会替换所有匹配内容。通配符仅支持 <code>*</code> 和 <code>?</code>，不支持正则表达式。</p>
        </div>

        <div className="rule-block">
          <h4>空格规范化</h4>
          <div className="inline-fields">
            <label className="toggle-field"><input type="checkbox" checked={settings.trimExtraSpaces} onChange={(event) => onSettingChange('trimExtraSpaces', event.target.checked)} />清理首尾空格并合并连续空白</label>
            <label>空格输出<select value={settings.spaceMode} onChange={(event) => onSettingChange('spaceMode', event.target.value as RenameRules['spaceMode'])}><option value="keep">保留空格</option><option value="underscore">下划线</option><option value="hyphen">连字符</option></select></label>
          </div>
        </div>

        <div className="rule-block">
          <h4>附加与格式</h4>
          <div className="form-grid">
            <label>前缀<input value={settings.prefix} onChange={(event) => onSettingChange('prefix', event.target.value)} /></label>
            <label>后缀<input value={settings.suffix} onChange={(event) => onSettingChange('suffix', event.target.value)} /></label>
            <label>大小写<select value={settings.caseMode} onChange={(event) => onSettingChange('caseMode', event.target.value as RenameRules['caseMode'])}><option value="keep">保留</option><option value="lower">统一小写</option><option value="upper">统一大写</option></select></label>
            <label>处理范围<select value={settings.modifyExtension ? 'all' : 'name'} onChange={(event) => onSettingChange('modifyExtension', event.target.value === 'all')}><option value="name">仅文件名</option><option value="all">文件名和扩展名</option></select></label>
          </div>
        </div>

        <div className="rule-block">
          <h4>自动编号</h4>
          <div className="inline-fields">
            <label className="toggle-field"><input type="checkbox" checked={settings.numberingEnabled} onChange={(event) => onSettingChange('numberingEnabled', event.target.checked)} />启用自动编号</label>
            {settings.numberingEnabled && <><label>起始数字<input type="number" value={settings.numberStart} onChange={(event) => onSettingChange('numberStart', Number(event.target.value))} /></label><label>位数<input type="number" min="1" max="12" value={settings.numberPadding} onChange={(event) => onSettingChange('numberPadding', Number(event.target.value))} /></label><label>插入位置<select value={settings.numberPosition} onChange={(event) => onSettingChange('numberPosition', event.target.value as RenameRules['numberPosition'])}><option value="prefix">文件名前</option><option value="suffix">文件名后</option></select></label></>}
          </div>
        </div>
      </div>
    </ToolSection>
  )
}
