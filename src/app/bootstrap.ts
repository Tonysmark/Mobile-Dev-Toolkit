/**
 * 系统引导模块
 * 负责创建和初始化核心内核，提供全局访问入口
 */
import { CoreKernel } from "../core";
import type { ModuleProvider } from "../core";
import { builtinModuleProvider } from "../modules/builtinProvider";
import { registerBuiltinViews } from "../modules/registerViews";
import { getModuleView } from "../ui/viewRegistry";

// 全局单例内核实例
const kernel = new CoreKernel();

/**
 * 启动系统引导流程
 * @param providers 模块提供者数组，用于动态加载模块
 */
export async function bootstrap(providers: ModuleProvider[] = []): Promise<void> {
  // 注册内置模块视图
  registerBuiltinViews();
  kernel.setViewResolver((viewId) => Boolean(getModuleView(viewId)));

  // 合并内置模块提供者和外部提供者
  const allProviders = [builtinModuleProvider, ...providers];

  // 启动内核
  await kernel.boot(allProviders);
}

/**
 * 获取全局内核实例
 * @returns 核心内核实例
 */
export function getKernel(): CoreKernel {
  return kernel;
}
