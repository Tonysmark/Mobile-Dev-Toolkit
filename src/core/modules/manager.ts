/**
 * 模块管理器
 * 负责模块实例的创建、生命周期管理和激活状态控制
 * 实现模块的初始化、激活、停用和销毁流程
 */
import type { EventBus } from "../events/eventBus";
import type {
  ModuleActivationMode,
  ModuleContext,
  ModuleDefinition,
  ModuleId,
  ModuleInstance,
} from "./types";
import { ModuleRegistry } from "./registry";

export class ModuleManager {
  // 当前激活的模块ID集合（包含 parallel/background）
  private readonly activeModuleIds = new Set<ModuleId>();
  // 当前激活的独占模块ID
  private activeExclusiveModuleId: ModuleId | null = null;
  // 存储所有模块实例，以模块ID为键
  private readonly instances = new Map<ModuleId, ModuleInstance>();

  constructor(
    private readonly registry: ModuleRegistry,
    private readonly context: ModuleContext,
    private readonly eventBus: EventBus,
  ) {}

  private async isModuleEnabled(definition: ModuleDefinition): Promise<boolean> {
    const { enabled, supports } = definition.manifest;
    if (enabled && !(await enabled(this.context))) {
      return false;
    }
    if (supports && !(await supports(this.context))) {
      return false;
    }
    return true;
  }

  private getActivationMode(instance: ModuleInstance): ModuleActivationMode {
    return instance.manifest.activationMode ?? "exclusive";
  }

  /**
   * 初始化所有模块
   * 遍历注册表中的所有模块定义，创建实例并调用初始化生命周期钩子
   */
  async initAll(): Promise<void> {
    const definitions = this.registry.list();
    for (const definition of definitions) {
      if (!(await this.isModuleEnabled(definition))) {
        continue;
      }
      // 使用工厂函数创建模块实例
      const instance = definition.factory(this.context);
      // 存储实例
      this.instances.set(definition.manifest.id, instance);
      // 调用初始化生命周期钩子
      await instance.lifecycle?.onInit?.();
      // 后台模块在初始化后自动激活
      if (this.getActivationMode(instance) === "background") {
        await this.activate(definition.manifest.id);
      }
    }
    // 发射模块就绪事件
    this.eventBus.emit("modules:ready", {
      moduleIds: Array.from(this.instances.keys()),
    });
  }

  /**
   * 激活指定模块
   * 如果已有激活模块，先停用它，然后激活新模块
   * @param moduleId 要激活的模块ID
   */
  async activate(moduleId: ModuleId): Promise<void> {
    const next = this.instances.get(moduleId);
    if (!next) {
      return;
    }
    // 如果已经是激活状态，直接返回
    if (this.activeModuleIds.has(moduleId)) {
      return;
    }

    const activationMode = this.getActivationMode(next);

    if (activationMode === "exclusive") {
      // 仅切换独占工作区模块，不影响 parallel/background
      if (this.activeExclusiveModuleId) {
        const current = this.instances.get(this.activeExclusiveModuleId);
        await current?.lifecycle?.onDeactivate?.();
        this.activeModuleIds.delete(this.activeExclusiveModuleId);
      }
      this.activeExclusiveModuleId = moduleId;
    }

    this.activeModuleIds.add(moduleId);
    await next.lifecycle?.onActivate?.();

    // 发射模块激活事件
    this.eventBus.emit("module:activated", {
      moduleId,
      activationMode,
      activeExclusiveModuleId: this.activeExclusiveModuleId,
      activeModuleIds: Array.from(this.activeModuleIds),
    });
  }

  /**
   * 销毁所有模块
   * 调用所有模块的销毁生命周期钩子，清理资源
   */
  async disposeAll(): Promise<void> {
    for (const instance of this.instances.values()) {
      await instance.lifecycle?.onDispose?.();
    }
    this.instances.clear();
    this.activeModuleIds.clear();
    this.activeExclusiveModuleId = null;
  }

  /**
   * 获取当前激活的模块ID
   * @returns 激活的模块ID，如果没有则返回 null
   */
  getActiveModuleId(): ModuleId | null {
    return this.activeExclusiveModuleId;
  }

  /**
   * 获取当前激活的所有模块ID
   * @returns 激活模块ID数组（包含 parallel/background）
   */
  getActiveModuleIds(): ModuleId[] {
    return Array.from(this.activeModuleIds);
  }
}
