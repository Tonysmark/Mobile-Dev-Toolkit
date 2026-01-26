/**
 * Android 设备适配器
 * 封装 adb 设备操作命令
 */
import type { Device } from "../device/types";
import type { DeviceAdapter, DeviceFeature } from "./deviceAdapter";

const androidFeatures: DeviceFeature[] = [
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

export class AndroidDeviceAdapter implements DeviceAdapter {
  metadata: DeviceAdapter["metadata"] = {
    id: "device.android",
    platform: "android",
    version: "1.0.0",
  };

  supports(capability: string): boolean {
    return capability === "device-operations";
  }

  supportsFeature(feature: DeviceFeature): boolean {
    return androidFeatures.includes(feature);
  }

  async listDevices(): Promise<Device[]> {
    const invokeFn = await getInvoke();
    ensureInvoke(invokeFn);
    const result = await invokeFn<{
      devices: Array<{ id: string; status: string; model?: string }>;
    }>("adb_devices");

    return result.devices.map((device) => ({
      id: device.id,
      status: device.status as Device["status"],
      model: device.model,
      platform: "android",
    }));
  }

  async installApp(deviceId: string, appPath: string): Promise<string> {
    const invokeFn = await getInvoke();
    ensureInvoke(invokeFn);
    return invokeFn("adb_install", { deviceId, apkPath: appPath });
  }

  async uninstallApp(deviceId: string, packageName: string): Promise<string> {
    const invokeFn = await getInvoke();
    ensureInvoke(invokeFn);
    return invokeFn("adb_uninstall", { deviceId, packageName });
  }

  async listPackages(deviceId: string): Promise<string[]> {
    const invokeFn = await getInvoke();
    ensureInvoke(invokeFn);
    return invokeFn("adb_list_packages", { deviceId });
  }

  async screenshot(deviceId: string, outputPath?: string | null): Promise<string> {
    const invokeFn = await getInvoke();
    ensureInvoke(invokeFn);
    return invokeFn("adb_screenshot", { deviceId, outputPath: outputPath ?? null });
  }

  async startScreenRecord(deviceId: string): Promise<string> {
    const invokeFn = await getInvoke();
    ensureInvoke(invokeFn);
    return invokeFn("adb_start_screenrecord", { deviceId });
  }

  async stopScreenRecord(deviceId: string, outputPath?: string | null): Promise<string> {
    const invokeFn = await getInvoke();
    ensureInvoke(invokeFn);
    return invokeFn("adb_stop_screenrecord", { deviceId, outputPath: outputPath ?? null });
  }

  async pushFile(deviceId: string, localPath: string, remotePath: string): Promise<string> {
    const invokeFn = await getInvoke();
    ensureInvoke(invokeFn);
    return invokeFn("adb_push_file", { deviceId, localPath, remotePath });
  }

  async pullFile(deviceId: string, remotePath: string, localPath: string): Promise<string> {
    const invokeFn = await getInvoke();
    ensureInvoke(invokeFn);
    return invokeFn("adb_pull_file", { deviceId, remotePath, localPath });
  }

  async pushCertificate(
    deviceId: string,
    certPath: string,
    remoteDir?: string | null,
  ): Promise<string> {
    const invokeFn = await getInvoke();
    ensureInvoke(invokeFn);
    return invokeFn("adb_push_certificate", {
      deviceId,
      certPath,
      remoteDir: remoteDir ?? null,
    });
  }

  async openCertificateInstaller(deviceId: string, remotePath: string): Promise<string> {
    const invokeFn = await getInvoke();
    ensureInvoke(invokeFn);
    return invokeFn("adb_open_cert_installer", { deviceId, remotePath });
  }
}
