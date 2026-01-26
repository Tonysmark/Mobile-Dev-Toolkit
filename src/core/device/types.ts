/**
 * 设备类型定义
 * 定义设备相关的核心类型和接口
 */

/** 设备状态 */
export type DeviceStatus = "device" | "offline" | "unauthorized" | "no-permissions";

/** 设备平台类型 */
export type DevicePlatform = "android" | "ios" | "harmonyos" | "unknown";

/** 设备信息 */
export interface Device {
  /** 设备唯一标识符 */
  id: string;
  /** 设备状态 */
  status: DeviceStatus;
  /** 设备型号（可选） */
  model?: string;
  /** 设备平台 */
  platform: DevicePlatform;
  /** 设备品牌（可选） */
  brand?: string;
  /** 系统版本（可选） */
  version?: string;
  /** 设备名称（可选） */
  name?: string;
}

/** 依赖工具状态 */
export type DependencyStatus = "available" | "unavailable" | "checking" | "unknown";

/** 依赖工具信息 */
export interface Dependency {
  /** 工具名称 */
  name: string;
  /** 工具显示名称 */
  displayName: string;
  /** 工具状态 */
  status: DependencyStatus;
  /** 工具版本（如果可用） */
  version?: string;
  /** 错误信息（如果不可用） */
  error?: string;
  /** 工具路径（如果可用） */
  path?: string;
}

/** 依赖工具列表 */
export interface Dependencies {
  /** Android 调试桥 */
  adb?: Dependency;
  /** HarmonyOS 调试工具 */
  hdc?: Dependency;
  /** iOS 设备工具 */
  idevice?: Dependency;
}
