/**
 * 模块加载器
 * 负责从模块提供者加载模块定义并注册到注册表中
 * 实现动态模块发现和注册机制
 */
import type { ModuleProvider } from "./types";
import { ModuleRegistry } from "./registry";

export class ModuleLoader {
  constructor(private readonly registry: ModuleRegistry) {}

  /**
   * 从多个提供者加载模块定义
   * 遍历所有提供者，加载其模块定义并注册到注册表
   * @param providers 模块提供者数组
   */
  async loadFromProviders(providers: ModuleProvider[]): Promise<void> {
    for (const provider of providers) {
      // 从提供者加载模块定义列表
      const definitions = await provider.load();
      // 将每个定义注册到注册表
      for (const definition of definitions) {
        this.registry.register(definition);
      }
    }
  }
}
