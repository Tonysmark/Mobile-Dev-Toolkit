/**
 * 系统类型定义
 * 定义系统请求和响应的接口
 */

/**
 * 系统请求
 * 用于向系统发送操作请求
 */
export interface SystemRequest {
  /** 请求类型 */
  kind: string;
  /** 请求负载数据（可选） */
  payload?: unknown;
}

/**
 * 系统响应
 * 系统操作的执行结果
 */
export interface SystemResponse {
  /** 操作是否成功 */
  ok: boolean;
  /** 响应数据（可选） */
  data?: unknown;
  /** 错误信息（可选） */
  error?: string;
}

/**
 * 系统执行器
 * 负责执行系统请求并返回响应
 */
export interface SystemExecutor {
  /** 执行系统请求 */
  execute: (request: SystemRequest) => Promise<SystemResponse>;
}
