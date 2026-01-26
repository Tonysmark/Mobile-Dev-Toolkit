/**
 * iOS 设备适配器
 * 封装 idevice 系列命令
 */
import type { Device } from "../device/types";
import type { DeviceAdapter, DeviceFeature } from "./deviceAdapter";

const iosFeatures: DeviceFeature[] = [
  "list-devices",
  "install-app",
  "uninstall-app",
  "list-packages",
];

let invoke: typeof import("@tauri-apps/api/core").invoke | null = null;

async function getInvoke() {
  if (invoke) {
    return invoke;
  }
  try {
    const tauriApi = await import("@tauri-apps/api/core");
    invoke = tauriApi.invoke;
    return invoke;
  } catch {
    return null;
  }
}

function ensureInvoke(
  fn: typeof import("@tauri-apps/api/core").invoke | null,
): asserts fn is typeof import("@tauri-apps/api/core").invoke {
  if (!fn) {
    throw new Error("Tauri 环境不可用");
  }
}

type CommandOutput = {
  success: boolean;
  stdout: string;
  stderr: string;
  exit_code: number | null;
};

async function runCommand(program: string, args: string[]) {
  const invokeFn = await getInvoke();
  ensureInvoke(invokeFn);
  const output = await invokeFn<CommandOutput>("execute_command", { program, args });
  if (!output.success) {
    throw new Error(output.stderr || "命令执行失败");
  }
  return output.stdout;
}

function toDeviceList(stdout: string): Device[] {
  return stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((id) => ({
      id,
      status: "device",
      platform: "ios",
    }));
}

function parseInstalledApps(stdout: string): string[] {
  return stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && line.includes("."))
    .map((line) => line.split(/\s+/)[0])
    .filter(Boolean);
}

export class IosDeviceAdapter implements DeviceAdapter {
  metadata: DeviceAdapter["metadata"] = {
    id: "device.ios",
    platform: "ios",
    version: "1.0.0",
  };

  supports(capability: string): boolean {
    return capability === "device-operations";
  }

  supportsFeature(feature: DeviceFeature): boolean {
    return iosFeatures.includes(feature);
  }

  async listDevices(): Promise<Device[]> {
    const stdout = await runCommand("idevice_id", ["-l"]);
    return toDeviceList(stdout);
  }

  async installApp(deviceId: string, appPath: string): Promise<string> {
    const stdout = await runCommand("ideviceinstaller", ["-u", deviceId, "-i", appPath]);
    return stdout || "安装完成";
  }

  async uninstallApp(deviceId: string, packageName: string): Promise<string> {
    const stdout = await runCommand("ideviceinstaller", ["-u", deviceId, "-U", packageName]);
    return stdout || "卸载完成";
  }

  async listPackages(deviceId: string): Promise<string[]> {
    const stdout = await runCommand("ideviceinstaller", ["-u", deviceId, "-l"]);
    return parseInstalledApps(stdout);
  }

  async screenshot(): Promise<string> {
    throw new Error("当前平台暂不支持截图功能");
  }

  async startScreenRecord(): Promise<string> {
    throw new Error("当前平台暂不支持录屏功能");
  }

  async stopScreenRecord(): Promise<string> {
    throw new Error("当前平台暂不支持录屏功能");
  }

  async pushFile(): Promise<string> {
    throw new Error("当前平台暂不支持文件导入");
  }

  async pullFile(): Promise<string> {
    throw new Error("当前平台暂不支持文件导出");
  }

  async pushCertificate(): Promise<string> {
    throw new Error("当前平台暂不支持证书导入");
  }

  async openCertificateInstaller(): Promise<string> {
    throw new Error("当前平台暂不支持证书安装向导");
  }
}
