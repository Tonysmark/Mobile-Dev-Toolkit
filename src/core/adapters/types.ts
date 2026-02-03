/**
 * 适配器类型定义
 * 定义适配器系统的核心类型和接口
 */

/** 适配器唯一标识符 */
export type AdapterId = string;

/**
 * 适配器元数据
 * 描述适配器的基本信息
 */
export interface AdapterMetadata {
  /** 适配器唯一ID */
  id: AdapterId;
  /** 目标平台（如 "android", "ios", "harmonyos"） */
  platform: string;
  /** 适配器版本号（可选） */
  version?: string;
}

/**
 * 适配器接口
 * 用于隔离不同平台的实现差异
 * 适配器由内核统一拥有与管理，模块仅能通过上下文请求能力
 */
export interface Adapter {
  /** 适配器元数据 */
  metadata: AdapterMetadata;
  /** 检查适配器是否支持指定的能力 */
  supports: (capability: string) => boolean;
  /**
   * 初始化钩子（可选）
   * 适配器创建后由内核统一调用
   */
  initialize?: () => void | Promise<void>;
  /**
   * 释放钩子（可选）
   * 应用退出或适配器卸载时调用
   */
  dispose?: () => void | Promise<void>;
}

/**
 * 系统命令适配器
 * 扩展 Adapter 接口，支持执行系统命令
 */
export interface SystemCommandAdapter extends Adapter {
  /** 执行系统命令请求 */
  execute: (
    request: import("../system/types").SystemRequest,
  ) => Promise<import("../system/types").SystemResponse>;
}
