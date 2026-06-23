# SlowTools project rules

- SlowTools 是纯前端、本地优先的浏览器工具箱；不要引入后端、账号、数据库或云同步。
- 新工具必须在 `src/tools/registry.ts` 中登记，并保持工具定义与 React 组件分离。
- 大型本地文件或文本处理必须避免读取不必要内容，并使用异步、可取消或带限制的流程。
- 批量重命名必须先预览并完成风险检测；默认不覆盖文件。
- UI 优先复用 `src/ui/` 的 ToolHeader、ToolSection、ActionBar、StatusMessage。大型结果使用滚动容器或显示上限，不要让页面被撑破。
- Git 操作由 Codex 按仓库状态判断执行；禁止强推、`reset --hard` 或危险的历史重写。
