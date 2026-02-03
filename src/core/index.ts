/**
 * 核心模块导出
 * 统一导出核心系统的所有公共类和类型
 */

// 导出核心类
export { CoreKernel } from "./kernel";
export type { KernelSnapshot, KernelModuleSnapshot } from "./kernel";
export { AdapterRegistry } from "./adapters/registry";
export { EventBus } from "./events/eventBus";
export {
  EventNames,
  type EventName,
  type ModuleActivatedPayload,
  type ModuleDeactivatedPayload,
} from "./events/events";
export { ModuleLoader } from "./modules/loader";
export { ModuleManager } from "./modules/manager";
export type { ModuleManagerSnapshot } from "./modules/manager";
export { ModuleRegistry } from "./modules/registry";

// 导出适配器相关类型
export type { Adapter, AdapterId, AdapterMetadata, SystemCommandAdapter } from "./adapters/types";
export type { AdapterRegistrySnapshot } from "./adapters/registry";
export type { DeviceAdapter, DeviceFeature } from "./adapters/deviceAdapter";
export { isDeviceAdapter } from "./adapters/deviceAdapter";

// 导出模块相关类型
export type {
  ModuleActivationMode,
  ModuleContext,
  ModuleDefinition,
  ModuleEnablement,
  ModuleFactory,
  ModuleId,
  ModuleInstance,
  ModuleLifecycle,
  ModuleManifest,
  ModuleProvider,
  ModuleUIDescriptor,
} from "./modules/types";

export { MODULE_ID_PATTERN, isValidModuleId } from "./modules/types";

// 导出系统相关类型
export type { SystemExecutor, SystemRequest, SystemResponse } from "./system/types";

// 导出设备相关类型
export type {
  Device,
  DeviceStatus,
  DevicePlatform,
  Dependency,
  Dependencies,
  DependencyStatus,
} from "./device/types";
