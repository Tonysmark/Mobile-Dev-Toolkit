/**
 * 依赖状态 Hook
 * 用于获取和监听依赖工具（adb/hdc/idevice）的可用状态
 */
import { useState, useEffect, useCallback } from "react";
import type { Dependencies, DependencyStatus } from "../../core/device/types";

/** 依赖状态 Hook 返回值 */
export interface UseDependencyStatusReturn {
  /** 依赖工具状态 */
  dependencies: Dependencies;
  /** 是否正在检查 */
  checking: boolean;
  /** 错误信息 */
  error: string | null;
  /** 手动刷新依赖状态 */
  refresh: () => Promise<void>;
}

/**
 * 使用依赖状态 Hook
 * @param autoCheck 是否自动检查（默认 true）
 * @returns 依赖状态和操作方法
 */
export function useDependencyStatus(
  autoCheck: boolean = true,
): UseDependencyStatusReturn {
  const [dependencies, setDependencies] = useState<Dependencies>({});
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** 检查依赖状态 */
  const checkDependencies = useCallback(async () => {
    // 检测是否在 Tauri 环境中
    let invoke: typeof import("@tauri-apps/api/core").invoke;
    try {
      const tauriApi = await import("@tauri-apps/api/core");
      invoke = tauriApi.invoke;
    } catch {
      setError("Tauri 环境不可用");
      return;
    }

    setChecking(true);
    setError(null);

    try {
      const result = await invoke<{
        adb?: {
          name: string;
          display_name: string;
          status: string;
          version?: string;
          error?: string;
          path?: string;
        };
        hdc?: {
          name: string;
          display_name: string;
          status: string;
          version?: string;
          error?: string;
          path?: string;
        };
        idevice?: {
          name: string;
          display_name: string;
          status: string;
          version?: string;
          error?: string;
          path?: string;
        };
      }>("check_dependencies");

      // 转换为标准类型
      const deps: Dependencies = {};

      if (result.adb) {
        deps.adb = {
          name: result.adb.name,
          displayName: result.adb.display_name,
          status: result.adb.status as DependencyStatus,
          version: result.adb.version,
          error: result.adb.error,
          path: result.adb.path,
        };
      }

      if (result.hdc) {
        deps.hdc = {
          name: result.hdc.name,
          displayName: result.hdc.display_name,
          status: result.hdc.status as DependencyStatus,
          version: result.hdc.version,
          error: result.hdc.error,
          path: result.hdc.path,
        };
      }

      if (result.idevice) {
        deps.idevice = {
          name: result.idevice.name,
          displayName: result.idevice.display_name,
          status: result.idevice.status as DependencyStatus,
          version: result.idevice.version,
          error: result.idevice.error,
          path: result.idevice.path,
        };
      }

      setDependencies(deps);
    } catch (e) {
      setError(e instanceof Error ? e.message : "检查依赖状态失败");
    } finally {
      setChecking(false);
    }
  }, []);

  // 自动检查
  useEffect(() => {
    if (autoCheck) {
      void checkDependencies();
    }
  }, [autoCheck, checkDependencies]);

  return {
    dependencies,
    checking,
    error,
    refresh: checkDependencies,
  };
}
