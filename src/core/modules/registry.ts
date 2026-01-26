/**
 * 模块注册表
 * 存储和管理所有模块定义，提供注册、注销、查询功能
 * 这是模块系统的核心存储层
 */
import { isValidModuleId } from "./types";
import type { ModuleDefinition, ModuleId } from "./types";

export class ModuleRegistry {
  // 使用 Map 存储模块定义，以模块ID为键
  private readonly definitions = new Map<ModuleId, ModuleDefinition>();

  /**
   * 注册模块定义
   * @param definition 模块定义对象，包含清单和工厂函数
   */
  register(definition: ModuleDefinition): void {
    if (!isValidModuleId(definition.manifest.id)) {
      throw new Error(
        `Invalid module id "${definition.manifest.id}". ` +
          "Module ids must follow reverse-domain style: com.company.product.module",
      );
    }
    this.definitions.set(definition.manifest.id, definition);
  }

  /**
   * 注销模块定义
   * @param moduleId 要注销的模块ID
   */
  unregister(moduleId: ModuleId): void {
    this.definitions.delete(moduleId);
  }

  /**
   * 列出所有已注册的模块定义
   * @returns 所有模块定义的数组
   */
  list(): ModuleDefinition[] {
    return Array.from(this.definitions.values());
  }

  /**
   * 根据ID获取模块定义
   * @param moduleId 模块ID
   * @returns 模块定义，如果不存在则返回 undefined
   */
  get(moduleId: ModuleId): ModuleDefinition | undefined {
    return this.definitions.get(moduleId);
  }
}
