/**
 * 适配器注册表
 * 管理平台适配器，用于隔离不同平台（Android/iOS/HarmonyOS）的差异
 * 模块通过能力名称查找适配器，实现平台无关的代码
 */
import type { Adapter, AdapterId } from "./types";

export type AdapterRegistrySnapshot = {
  adapterIds: AdapterId[];
  platforms: string[];
};

export class AdapterRegistry {
  // 存储所有适配器，以适配器ID为键
  private readonly adapters = new Map<AdapterId, Adapter>();

  /**
   * 注册适配器
   * @param adapter 适配器实例
   */
  register(adapter: Adapter): void {
    if (this.adapters.has(adapter.metadata.id)) {
      throw new Error(`Adapter already registered: ${adapter.metadata.id}`);
    }
    this.adapters.set(adapter.metadata.id, adapter);
  }

  /**
   * 注销适配器
   * @param adapterId 要注销的适配器ID
   */
  unregister(adapterId: AdapterId): void {
    this.adapters.delete(adapterId);
  }

  /**
   * 列出所有已注册的适配器
   * @returns 所有适配器的数组
   */
  list(): Adapter[] {
    return Array.from(this.adapters.values());
  }

  /**
   * 根据能力名称查找适配器
   * 用于模块获取特定平台能力的实现
   * @param capability 能力名称（如 "file-system", "network" 等）
   * @returns 支持该能力的适配器，如果不存在则返回 undefined
   */
  findByCapability(capability: string): Adapter | undefined {
    return this.list().find((adapter) => adapter.supports(capability));
  }

  /**
   * 根据能力名称查找全部适配器
   * @param capability 能力名称
   * @returns 支持该能力的适配器数组
   */
  findAllByCapability(capability: string): Adapter[] {
    return this.list().filter((adapter) => adapter.supports(capability));
  }

  async initializeAll(): Promise<void> {
    for (const adapter of this.adapters.values()) {
      await adapter.initialize?.();
    }
  }

  async disposeAll(): Promise<void> {
    for (const adapter of this.adapters.values()) {
      await adapter.dispose?.();
    }
  }

  getSnapshot(): AdapterRegistrySnapshot {
    const adapters = this.list();
    return {
      adapterIds: adapters.map((adapter) => adapter.metadata.id),
      platforms: adapters.map((adapter) => adapter.metadata.platform),
    };
  }
}
