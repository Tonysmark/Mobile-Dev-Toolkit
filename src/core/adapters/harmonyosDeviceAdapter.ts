/**
 * HarmonyOS 设备适配器
 * 封装 hdc 基础命令
 */
import type { Device } from "../device/types";
import type { DeviceAdapter, DeviceFeature } from "./deviceAdapter";

const harmonyFeatures: DeviceFeature[] = [
  "list-devices",
  "install-app",
  "uninstall-app",
  "list-packages",
  "screenshot",
  "screenrecord",
  "push-file",
  "pull-file",
  "push-certificate",
  "open-certificate-installer",
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

async function invokeHdc<T>(command: string, args: Record<string, unknown>): Promise<T> {
  const invokeFn = await getInvoke();
  ensureInvoke(invokeFn);
  return invokeFn<T>(command, args);
}

export class HarmonyOSDeviceAdapter implements DeviceAdapter {
  metadata: DeviceAdapter["metadata"] = {
    id: "device.harmonyos",
    platform: "harmonyos",
    version: "1.0.0",
  };

  supports(capability: string): boolean {
    return capability === "device-operations";
  }

  supportsFeature(feature: DeviceFeature): boolean {
    return harmonyFeatures.includes(feature);
  }

  async listDevices(): Promise<Device[]> {
    const result = await invokeHdc<{
      devices: Array<{ id: string; status: string; model?: string }>;
    }>("hdc_list_targets", {});
    return result.devices.map((device) => ({
      id: device.id,
      status: device.status as Device["status"],
      model: device.model,
      platform: "harmonyos",
    }));
  }

  async installApp(deviceId: string, appPath: string): Promise<string> {
    return invokeHdc<string>("hdc_install", { deviceId, appPath });
  }

  async uninstallApp(deviceId: string, packageName: string): Promise<string> {
    return invokeHdc<string>("hdc_uninstall", { deviceId, packageName });
  }

  async listPackages(deviceId: string): Promise<string[]> {
    return invokeHdc<string[]>("hdc_list_packages", { deviceId });
  }

  async screenshot(deviceId: string, outputPath?: string | null): Promise<string> {
    return invokeHdc<string>("hdc_screenshot", {
      deviceId,
      outputPath: outputPath ?? null,
    });
  }

  async startScreenRecord(deviceId: string): Promise<string> {
    return invokeHdc<string>("hdc_start_screenrecord", { deviceId });
  }

  async stopScreenRecord(deviceId: string, outputPath?: string | null): Promise<string> {
    return invokeHdc<string>("hdc_stop_screenrecord", {
      deviceId,
      outputPath: outputPath ?? null,
    });
  }

  async pushFile(deviceId: string, localPath: string, remotePath: string): Promise<string> {
    return invokeHdc<string>("hdc_push_file", { deviceId, localPath, remotePath });
  }

  async pullFile(deviceId: string, remotePath: string, localPath: string): Promise<string> {
    return invokeHdc<string>("hdc_pull_file", { deviceId, remotePath, localPath });
  }

  async pushCertificate(
    deviceId: string,
    certPath: string,
    remoteDir?: string | null,
  ): Promise<string> {
    return invokeHdc<string>("hdc_push_certificate", {
      deviceId,
      certPath,
      remoteDir: remoteDir ?? null,
    });
  }

  async openCertificateInstaller(deviceId: string, remotePath: string): Promise<string> {
    return invokeHdc<string>("hdc_open_cert_installer", { deviceId, remotePath });
  }
}
