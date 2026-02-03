# Architecture Review & Optimization Tasks

> 目标：识别当前架构层面的薄弱点，并产出可执行的改进任务清单。

## 1. 发现的架构缺点

### 1.1 内核/适配器生命周期缺少统一管理
- 适配器的注册与初始化逻辑放在 `bootstrap` 中直接操作注册表，内核没有统一的生命周期钩子（initialize/dispose）。
- 这会导致适配器的加载策略分散在 UI/App 层，违背“核心统一管理生命周期”的约束，后续引入更多平台或能力时将加剧耦合与重复逻辑。

### 1.2 模块激活/停用模型不完整
- `ModuleManager` 仅在激活独占模块时调用 `onDeactivate`，对 `parallel/background` 模块没有显式停用/卸载入口。
- 当前没有 “deactivate” API，也没有 “deactivate all” 的机制，模块资源释放将不可控（例如后台模块无法有序停止）。

### 1.3 模块注册缺少冲突检测与元数据一致性校验
- 模块注册时只校验 ID 格式，不检测重复 ID 覆盖。
- UI 视图注册与模块 UI 描述符是两个独立流程，缺少一致性校验（manifest 的 `viewId` 与注册表是否存在对应 view 未校验）。

### 1.4 事件总线缺少约定化事件模型
- 事件名使用字符串且未集中管理，没有事件 schema 或命名规范（如 `domain:action`），导致事件系统难以演进并易发生冲突。

### 1.5 内核状态对 UI 暴露缺少稳定快照层
- UI 侧直接读取 `ModuleRegistry` / `ModuleManager` 并通过 hook 监听事件，这种访问方式缺少稳定的 “read model” 或 “snapshot” API。
- 长期来看会让 UI 需要理解内核细节，难以切换实现或添加缓存层。

---

## 2. 建议的优化任务清单

### P0（高优先级）
1. **为适配器引入统一生命周期管理**
   - 在 `CoreKernel` 内新增 `initializeAdapters()` / `disposeAdapters()` 或等价能力。
   - 将平台检测/注册逻辑从 `bootstrap` 迁移到内核层或专用适配器工厂。

2. **补齐模块停用与释放能力**
   - 在 `ModuleManager` 中新增 `deactivate(moduleId)` 与 `deactivateAll()`。
   - 明确 `parallel/background` 的停用策略与事件触发。

### P1（中优先级）
3. **模块注册冲突检测与错误报告**
   - `ModuleRegistry.register` 对重复 ID 抛出明确异常或提供诊断日志。
   - 对 manifest 的必要字段做一致性校验（如 `ui.viewId` 必须是已注册视图）。

4. **建立事件命名约束或事件 schema**
   - 统一事件命名约定（如 `module:activated`、`device:changed`），集中定义在 `core/events` 目录。
   - 可选：增加类型化事件总线或事件映射表，以减少字符串散落。

### P2（可选优化）
5. **引入内核状态快照/查询层（read model）**
   - 在 `CoreKernel` 或 `ModuleManager` 中提供 `getSnapshot()` 方法。
   - UI 侧仅通过 snapshot 获取可渲染数据，隔离内核内部结构。

---

## 3. 预期收益
- **降低 UI/App 层与核心内核的耦合度**
- **提高模块生命周期的可控性与可测试性**
- **增强可维护性（减少隐式依赖与状态扩散）**
