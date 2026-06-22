import { TextCounterTool } from './text-counter/TextCounterTool'
import type { ToolDefinition } from './types'

export const toolRegistry: ToolDefinition[] = [
  {
    id: 'text-counter',
    name: 'Text Counter',
    description: '统计文本的字符、单词和行数。',
    category: '文字',
    tags: ['文本', '本地保存'],
    Component: TextCounterTool,
  },
]
