import { useEffect, useMemo, useState } from 'react'
import { ToolHeader } from '../../ui/ToolHeader'
import { ToolSection } from '../../ui/ToolSection'
import { readStoredText, removeStoredValue, writeStoredText } from '../../storage/localStorage'

const storageKey = 'slowtools:text-counter:text'

function getTextStats(text: string) {
  const nonWhitespaceCharacters = text.replace(/\s/g, '').length
  const words = text.trim() ? text.trim().split(/\s+/u).length : 0
  const lines = text === '' ? 0 : text.split(/\r\n|\r|\n/u).length

  return {
    characters: text.length,
    nonWhitespaceCharacters,
    words,
    lines,
  }
}

export function TextCounterTool() {
  const [text, setText] = useState(() => readStoredText(storageKey))
  const stats = useMemo(() => getTextStats(text), [text])

  useEffect(() => {
    writeStoredText(storageKey, text)
  }, [text])

  const clearText = () => {
    setText('')
    removeStoredValue(storageKey)
  }

  return (
    <div className="tool-panel">
      <ToolHeader eyebrow="文字工具" title="Text Counter" description="输入或粘贴文字，实时查看统计结果。" actions={<button className="button button--quiet" type="button" onClick={clearText} disabled={!text}>清空</button>} />
      <ToolSection title="文字内容" description="内容会自动保存在此浏览器中。">
        <textarea id="text-counter-input" value={text} onChange={(event) => setText(event.target.value)} placeholder="从这里开始写，或粘贴一段文字……" rows={12} />
      </ToolSection>
      <ToolSection title="统计结果">
        <dl className="stats-grid">
          <div><dt>字符数</dt><dd>{stats.characters}</dd></div>
          <div><dt>非空字符数</dt><dd>{stats.nonWhitespaceCharacters}</dd></div>
          <div><dt>单词数</dt><dd>{stats.words}</dd></div>
          <div><dt>行数</dt><dd>{stats.lines}</dd></div>
        </dl>
      </ToolSection>
    </div>
  )
}
