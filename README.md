# SlowTools

一个纯浏览器端的小工具集合。它没有账户、后端或云端同步；每个工具都可以保持简单，并逐步生长。

## 内置工具

- **Text Counter**：统计输入文本的字符、非空字符、单词和行数。
- **Folder Tree Generator**：选择本地文件夹并生成可复制或下载的目录树。扫描只使用文件/文件夹名称和结构，不上传数据、不读取文件内容或文件大小。

目录树工具默认最多扫描 10,000 个条目、最多深入 8 层；达到任一限制时会显示省略或截断提示。默认排除 `.git`、`node_modules`、`dist`、`build` 等常见大型目录，且这些选项可在工具内修改。建议使用支持 File System Access API 的 Chromium 系浏览器。

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
