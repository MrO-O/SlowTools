import type { ReactNode } from 'react'

interface ToolSectionProps {
  title: string
  description?: string
  actions?: ReactNode
  children: ReactNode
  className?: string
}

export function ToolSection({ title, description, actions, children, className = '' }: ToolSectionProps) {
  return (
    <section className={`tool-section ${className}`.trim()}>
      <div className="tool-section__header">
        <div>
          <h3>{title}</h3>
          {description && <p>{description}</p>}
        </div>
        {actions && <div className="tool-section__actions">{actions}</div>}
      </div>
      <div className="tool-section__content">{children}</div>
    </section>
  )
}
