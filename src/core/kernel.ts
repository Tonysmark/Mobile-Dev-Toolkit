/**
 * 核心内核类
 * 系统的核心控制器，负责协调模块系统和适配器系统
 * 管理整个应用的生命周期和资源
 */
import { AdapterRegistry } from "./adapters/registry";
import { EventBus } from "./events/eventBus";
import { ModuleLoader } from "./modules/loader";
import { ModuleManager } from "./modules/manager";
import { ModuleRegistry } from "./modules/registry";
import type { ModuleContext, ModuleProvider } from "./modules/types";

export class CoreKernel {
  // 模块注册表：存储所有已注册的模块定义
  private readonly moduleRegistry = new ModuleRegistry();
  // 适配器注册表：存储平台适配器，用于隔离平台差异
  private readonly adapterRegistry = new AdapterRegistry();
  // 事件总线：提供模块间通信机制
  private readonly eventBus = new EventBus();
  // 模块加载器：负责从提供者加载模块定义
  private readonly moduleLoader = new ModuleLoader(this.moduleRegistry);
  // 模块管理器：负责模块实例化和生命周期管理
  private moduleManager?: ModuleManager;

  /**
   * 创建模块上下文
   * 为模块提供访问适配器和事件系统的接口
   */
  private createModuleContext(): ModuleContext {
    return {
      // 通过能力名称查找对应的适配器
      getAdapter: (capability) =>
        this.adapterRegistry.findByCapability(capability),
      // 事件发射器：通过事件总线发送事件
      emitEvent: (event: string, payload?: unknown) => {
        this.eventBus.emit(event, payload);
      },
    };
  }

  /**
   * 启动内核
   * 1. 从提供者加载模块定义
   * 2. 创建模块管理器
   * 3. 初始化所有模块
   */
  async boot(providers: ModuleProvider[]): Promise<void> {
    // 步骤1：从提供者加载模块定义到注册表
    await this.moduleLoader.loadFromProviders(providers);
    // 步骤2：创建模块管理器，传入注册表、上下文和事件总线
    this.moduleManager = new ModuleManager(
      this.moduleRegistry,
      this.createModuleContext(),
      this.eventBus,
    );
    // 步骤3：初始化所有已注册的模块
    await this.moduleManager.initAll();
  }

  /**
   * 获取模块注册表
   */
  getModuleRegistry(): ModuleRegistry {
    return this.moduleRegistry;
  }

  /**
   * 获取适配器注册表
   */
  getAdapterRegistry(): AdapterRegistry {
    return this.adapterRegistry;
  }

  /**
   * 获取模块管理器
   */
  getModuleManager(): ModuleManager | undefined {
    return this.moduleManager;
  }

  /**
   * 获取事件总线
   */
  getEventBus(): EventBus {
    return this.eventBus;
  }
}
