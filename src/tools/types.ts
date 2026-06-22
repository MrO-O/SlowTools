import type { ComponentType } from 'react'

export type ToolId = string

export interface ToolDefinition {
  id: ToolId
  name: string
  description: string
  category: string
  tags: string[]
  Component: ComponentType
}
