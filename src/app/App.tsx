import { useState } from 'react'
import { toolRegistry } from '../tools/registry'

export default function App() {
  const [selectedToolId, setSelectedToolId] = useState(toolRegistry[0]?.id ?? '')
  const selectedTool = toolRegistry.find((tool) => tool.id === selectedToolId)

  return (
    <main className="app-shell">
      <header className="site-header">
        <a className="brand" href="/" aria-label="SlowTools 首页">
          <span className="brand-mark" aria-hidden="true">S</span>
          <span>SlowTools</span>
        </a>
      </header>

      <section className="intro" aria-labelledby="page-title">
        <span className="eyebrow">本地浏览器工具箱</span>
        <h1 id="page-title">浏览器端小工具集合</h1>
        <p>无需账户，工具数据仅保存在当前浏览器中。</p>
      </section>

      <div className="workspace">
        <aside className="tool-list" aria-label="工具列表">
          <div className="section-heading">
            <h2>工具</h2>
            <span>{toolRegistry.length}</span>
          </div>
          <div className="tool-cards">
            {toolRegistry.map((tool) => {
              const isSelected = tool.id === selectedToolId

              return (
                <button
                  className={`tool-card ${isSelected ? 'is-selected' : ''}`}
                  key={tool.id}
                  type="button"
                  onClick={() => setSelectedToolId(tool.id)}
                  aria-pressed={isSelected}
                >
                  <span className="tool-card-category">{tool.category}</span>
                  <strong>{tool.name}</strong>
                  <span>{tool.description}</span>
                  <span className="tag-list">
                    {tool.tags.map((tag) => (
                      <span className="tag" key={tag}>{tag}</span>
                    ))}
                  </span>
                </button>
              )
            })}
          </div>
        </aside>

        <section className="tool-detail" aria-live="polite">
          {selectedTool ? <selectedTool.Component /> : <p>请选择一个工具。</p>}
        </section>
      </div>
    </main>
  )
}
