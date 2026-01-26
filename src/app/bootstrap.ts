/**
 * 系统引导模块
 * 负责创建和初始化核心内核，提供全局访问入口
 */
import { CoreKernel } from "../core";
import type { ModuleProvider } from "../core";
import { TauriSystemAdapter } from "../core/adapters/tauriSystemAdapter";
import { AndroidDeviceAdapter } from "../core/adapters/androidDeviceAdapter";
import { IosDeviceAdapter } from "../core/adapters/iosDeviceAdapter";
import { HarmonyOSDeviceAdapter } from "../core/adapters/harmonyosDeviceAdapter";
import { builtinModuleProvider } from "../modules/builtinProvider";
import { registerBuiltinViews } from "../modules/registerViews";

// 全局单例内核实例
const kernel = new CoreKernel();

/**
 * 检测是否在 Tauri 环境中
 */
async function isTauriEnvironment(): Promise<boolean> {
  try {
    await import("@tauri-apps/api/core");
    return true;
  } catch {
    return false;
  }
}

async function getDependencyStatus() {
  try {
    const tauriApi = await import("@tauri-apps/api/core");
    return await tauriApi.invoke<{
      adb?: { status: string };
      hdc?: { status: string };
      idevice?: { status: string };
    }>("check_dependencies");
  } catch {
    return null;
  }
}

/**
 * 启动系统引导流程
 * @param providers 模块提供者数组，用于动态加载模块
 */
export async function bootstrap(providers: ModuleProvider[] = []): Promise<void> {
  // 注册内置模块视图
  registerBuiltinViews();

  // 检测并注册 Tauri 适配器
  if (await isTauriEnvironment()) {
    const adapter = new TauriSystemAdapter();
    kernel.getAdapterRegistry().register(adapter);

    const deps = await getDependencyStatus();
    if (deps?.adb?.status === "available") {
      kernel.getAdapterRegistry().register(new AndroidDeviceAdapter());
    }
    if (deps?.idevice?.status === "available") {
      kernel.getAdapterRegistry().register(new IosDeviceAdapter());
    }
    if (deps?.hdc?.status === "available") {
      kernel.getAdapterRegistry().register(new HarmonyOSDeviceAdapter());
    }
  }

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
