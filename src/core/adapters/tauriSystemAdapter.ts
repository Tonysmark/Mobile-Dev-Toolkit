/**
 * Tauri 系统适配器
 * 通过 Tauri IPC 调用 Rust 后端执行系统命令
 */
import type { SystemCommandAdapter } from "./types";
import type { SystemRequest, SystemResponse } from "../system/types";

// 动态导入 Tauri API，避免在非 Tauri 环境中报错
let invoke: typeof import("@tauri-apps/api/core").invoke | null = null;

async function getInvoke() {
  if (invoke) {
    return invoke;
  }

  try {
    const tauriApi = await import("@tauri-apps/api/core");
    invoke = tauriApi.invoke;
    return invoke;
  } catch (e) {
    console.warn("Tauri API 不可用，系统命令功能将无法使用");
    return null;
  }
}

export class TauriSystemAdapter implements SystemCommandAdapter {
  metadata = {
    id: "system.tauri",
    platform: "desktop",
    version: "1.0.0",
  };

  supports(capability: string): boolean {
    return capability === "system-command";
  }

  async execute(request: SystemRequest): Promise<SystemResponse> {
    const invokeFn = await getInvoke();
    if (!invokeFn) {
      return {
        ok: false,
        error: "Tauri 环境不可用",
      };
    }

    try {
      // 根据请求类型调用不同的 Tauri 命令
      if (request.kind === "execute-command") {
        const { program, args } = request.payload as {
          program: string;
          args: string[];
        };

        const result = await invokeFn<{
          success: boolean;
          stdout: string;
          stderr: string;
          exit_code: number | null;
        }>("execute_command", {
          program,
          args,
        });

        return {
          ok: result.success,
          data: {
            stdout: result.stdout,
            stderr: result.stderr,
            exitCode: result.exit_code,
          },
          error: result.success ? undefined : result.stderr,
        };
      }

      return {
        ok: false,
        error: `不支持的请求类型: ${request.kind}`,
      };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
