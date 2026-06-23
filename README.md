# SlowTools

一个纯浏览器端的小工具集合。它没有账户、后端或云端同步；每个工具都可以保持简单，并逐步生长。

## 工具页约定

工具页使用统一结构：工具标题、状态提示、输入/设置分区、结果/预览分区和操作栏。新增工具时优先复用 `src/ui/` 中的 `ToolHeader`、`ToolSection`、`ActionBar` 和 `StatusMessage`，避免为单个工具重新发明布局。

大型结果区域应放进可滚动容器或设置显示上限；完整数据仍可用于本地导出。Batch File Renamer 的表格最多渲染前 500 行，脚本和 CSV 导出保持完整映射。

## 内置工具

- **Text Counter**：统计输入文本的字符、非空字符、单词和行数。
- **Folder Tree Generator**：选择本地文件夹并生成可复制或下载的目录树。扫描只使用文件/文件夹名称和结构，不上传数据、不读取文件内容或文件大小。
- **Batch File Renamer**：扫描文件名，按规则生成重命名预览并检查冲突。浏览器支持可靠同目录移动时才会显示直接执行；其他环境可导出 PowerShell、Node.js 或 CSV 映射。

目录树工具默认最多扫描 10,000 个条目、最多深入 8 层；达到任一限制时会显示省略或截断提示。默认排除 `.git`、`node_modules`、`dist`、`build` 等常见大型目录，且这些选项可在工具内修改。Chromium 系浏览器会使用直接的文件夹选择；Firefox 会自动使用兼容模式，仍可生成包含文件的目录树，但无法显示空文件夹。

## 本地运行

```bash
npm install
npm run dev
```

打开终端显示的本地地址即可使用。生产构建：

```bash
npm run build
npm run preview
```

Windows 用户也可以直接双击 `start-slowtools.bat`：首次运行会安装依赖，随后启动本地服务并打开浏览器。保持打开的命令窗口即可继续运行；按 `Ctrl + C` 可停止服务。

## 新增工具

1. 在 `src/tools/` 新建工具文件夹和 React 组件，例如 `src/tools/my-tool/MyTool.tsx`。
2. 在 `src/tools/registry.ts` 导入组件，并添加一个 `ToolDefinition` 对象。
3. 如果工具需要本地保存，使用 `src/storage/localStorage.ts` 中的小封装，并采用唯一、带项目前缀的 key（例如 `slowtools:my-tool:value`）。

首页会从注册表自动生成工具卡片；选中后会显示该定义中的 `Component`。不需要额外路由或插件配置。

## GitHub Pages

本项目没有服务端路由，构建产物可直接静态托管。若部署在仓库项目页（例如 `https://<user>.github.io/SlowTools/`），构建时设置仓库路径：

```bash
VITE_BASE_PATH=/SlowTools/ npm run build
```

PowerShell 中可使用：

```powershell
$env:VITE_BASE_PATH='/SlowTools/'; npm run build
```

随后将 `dist/` 作为 GitHub Pages 发布目录（或交给你偏好的简单 Actions 工作流）。如果部署在用户或组织主页根路径，则不设置 `VITE_BASE_PATH`。

本仓库已包含 GitHub Actions 发布工作流：每次推送到 `master` 会构建并部署到 GitHub Pages。首次使用时，请在 GitHub 仓库的 **Settings → Pages → Build and deployment** 中将 Source 设置为 **GitHub Actions**。

## 当前本地数据

Text Counter 会将输入内容自动保存在当前浏览器的 localStorage：

```text
slowtools:text-counter:text
```

点击“清空”会同时清空输入与这条本地记录。

Folder Tree Generator 只会保存扫描设置（深度、条目限制、排除目录及显示/排序选项），不会保存目录树结果或所选文件夹：

```text
slowtools:folder-tree:settings
```

Batch File Renamer 只保存扫描和规则设置，不保存文件列表、预览结果或目录句柄：

```text
slowtools:batch-renamer:settings
```

重命名工具始终先生成预览，并阻止空名称、Windows 非法字符、重复目标名、与未改名文件的冲突等风险。导出的 PowerShell 与 Node.js 脚本默认均为 dry-run：先把脚本里的根目录 `CHANGE_ME` 改为实际扫描目录，确认输出后再将 `$DryRun` / `DRY_RUN` 改为 `false`。脚本会再次检查源文件和目标文件，且不会覆盖已有文件。

文本匹配默认使用普通文本替换所有出现位置；也可选择简单通配符模式（`*` 为任意文本、`?` 为单个字符），不支持正则表达式。替换内容留空即表示删除匹配内容。
