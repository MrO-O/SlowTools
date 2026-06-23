import type { ReactNode } from 'react'

type StatusTone = 'info' | 'warning' | 'success'

export function StatusMessage({ children, tone = 'info' }: { children: ReactNode; tone?: StatusTone }) {
  return <p className={`status-banner status-banner--${tone}`} role="status">{children}</p>
}
