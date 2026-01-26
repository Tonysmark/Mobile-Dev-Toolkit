/**
 * 模块类型定义
 * 定义模块系统的核心类型和接口
 */

/** 模块唯一标识符（全局唯一，推荐使用反向域名） */
export type ModuleId = string;

/**
 * 模块ID命名规则（严格约束）
 * - 使用小写反向域名风格：com.company.product.module
 * - 仅允许小写字母、数字、中划线和点
 * - 至少包含两个层级
 */
export const MODULE_ID_PATTERN = /^[a-z][a-z0-9-]*(\.[a-z0-9-]+)+$/;

/** 校验模块ID是否符合命名规则 */
export function isValidModuleId(moduleId: string): boolean {
  return MODULE_ID_PATTERN.test(moduleId);
}

/** 模块激活模式 */
export type ModuleActivationMode = "exclusive" | "parallel" | "background";

/**
 * 模块UI描述符（纯数据，不绑定任何UI框架）
 * UI层可使用该描述符决定如何渲染与布局，但模块本身不控制布局。
 */
export interface ModuleUIDescriptor {
  /** UI能力类型 */
  kind: "workspace" | "utility";
  /**
   * UI入口标识，由UI层解析到具体渲染实现
   * 不允许直接引用任何UI框架对象或组件
   */
  viewId: string;
  /** UI显示标题（可选） */
  title?: string;
  /** UI图标（可选） */
  icon?: string;
  /** UI说明（可选） */
  description?: string;
}

/** 模块启用判断函数 */
export type ModuleEnablement = (
  context: ModuleContext,
) => boolean | Promise<boolean>;

/**
 * 模块清单
 * 描述模块的元数据信息
 */
export interface ModuleManifest {
  /** 模块唯一ID */
  id: ModuleId;
  /** 模块显示名称 */
  name: string;
  /** 模块版本号 */
  version: string;
  /** 模块分类（可选） */
  category?: string;
  /** 模块图标（可选） */
  icon?: string;
  /** 模块激活模式（默认 exclusive） */
  activationMode?: ModuleActivationMode;
  /** 模块可声明UI能力，但不控制布局 */
  ui?: ModuleUIDescriptor;
  /**
   * 模块是否启用（可选）
   * 返回 false 将跳过该模块的实例化
   */
  enabled?: ModuleEnablement;
  /**
   * 模块是否支持当前运行环境（可选）
   * 返回 false 将跳过该模块的实例化
   */
  supports?: ModuleEnablement;
}

/**
 * 模块生命周期钩子
 * 定义模块在不同阶段的回调函数
 */
export interface ModuleLifecycle {
  /** 初始化时调用，模块实例创建后执行 */
  onInit?: () => void | Promise<void>;
  /** 激活时调用，模块被选中使用时执行 */
  onActivate?: () => void | Promise<void>;
  /** 停用时调用，模块失去焦点时执行 */
  onDeactivate?: () => void | Promise<void>;
  /** 销毁时调用，模块被移除时执行清理工作 */
  onDispose?: () => void | Promise<void>;
}

/**
 * 模块实例
 * 模块运行时的实际对象
 */
export interface ModuleInstance {
  /** 模块清单信息 */
  manifest: ModuleManifest;
  /** 生命周期钩子（可选） */
  lifecycle?: ModuleLifecycle;
}

/**
 * 模块上下文
 * 提供给模块的运行时环境，包含访问适配器和事件的接口
 */
export interface ModuleContext {
  /**
   * 根据能力名称获取适配器
   * 适配器由内核统一管理，模块仅能通过上下文请求
   */
  getAdapter: (capability: string) => import("../adapters/types").Adapter | undefined;
  /**
   * 发射事件到系统
   * 仅限系统级事件，不承载应用状态或UI上下文
   */
  emitEvent: (event: string, payload?: unknown) => void;
}

/**
 * 模块工厂函数
 * 接收上下文，返回模块实例
 */
export type ModuleFactory = (context: ModuleContext) => ModuleInstance;

/**
 * 模块定义
 * 包含模块清单和工厂函数，用于创建模块实例
 */
export interface ModuleDefinition {
  /** 模块清单 */
  manifest: ModuleManifest;
  /** 模块工厂函数 */
  factory: ModuleFactory;
}

/**
 * 模块提供者
 * 负责加载和提供模块定义，实现动态模块发现机制
 */
export interface ModuleProvider {
  /** 提供者唯一ID */
  id: string;
  /** 加载模块定义的方法 */
  load: () => Promise<ModuleDefinition[]>;
}
