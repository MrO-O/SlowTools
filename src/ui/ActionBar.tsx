import type { ReactNode } from 'react'

export function ActionBar({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`tool-actions ${className}`.trim()}>{children}</div>
}
