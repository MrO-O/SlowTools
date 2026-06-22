import { FolderTreeTool } from './folder-tree/FolderTreeTool'
import { TextCounterTool } from './text-counter/TextCounterTool'
import type { ToolDefinition } from './types'

export const toolRegistry: ToolDefinition[] = [
  {
    id: 'folder-tree-generator',
    name: 'Folder Tree Generator',
    description: '从本地文件夹生成可复制的目录树。',
    category: '文件',
    tags: ['目录树', '本地扫描'],
    Component: FolderTreeTool,
  },
  {
    id: 'text-counter',
    name: 'Text Counter',
    description: '统计文本的字符、单词和行数。',
    category: '文字',
    tags: ['文本', '本地保存'],
    Component: TextCounterTool,
  },
]
