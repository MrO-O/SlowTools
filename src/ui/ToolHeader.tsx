import type { ReactNode } from 'react'

interface ToolHeaderProps {
  eyebrow: string
  title: string
  description: string
  actions?: ReactNode
}

export function ToolHeader({ eyebrow, title, description, actions }: ToolHeaderProps) {
  return (
    <header className="tool-header">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {actions && <div className="tool-header__actions">{actions}</div>}
    </header>
  )
}
