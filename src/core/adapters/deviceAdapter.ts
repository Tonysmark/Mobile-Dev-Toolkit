/**
 * 设备适配器类型定义
 * 提供跨平台设备能力封装接口
 */
import type { Adapter } from "./types";
import type { Device, DevicePlatform } from "../device/types";

export type DeviceFeature =
  | "list-devices"
  | "device-info"
  | "install-app"
  | "uninstall-app"
  | "list-packages"
  | "screenshot"
  | "screenrecord"
  | "mirror-stream"
  | "push-file"
  | "pull-file"
  | "push-certificate"
  | "open-certificate-installer";

export type DeviceInfo = Partial<Pick<
  Device,
  "model" | "brand" | "name" | "version" | "batteryLevel" | "batteryStatus"
>>;

export type MirrorStreamInfo = {
  url: string;
};

export interface DeviceAdapter extends Adapter {
  metadata: Adapter["metadata"] & { platform: DevicePlatform };
  listDevices: () => Promise<Device[]>;
  supportsFeature: (feature: DeviceFeature) => boolean;
  getDeviceInfo: (deviceId: string) => Promise<DeviceInfo>;
  startMirrorStream: (deviceId: string) => Promise<MirrorStreamInfo>;
  stopMirrorStream: (deviceId: string) => Promise<void>;
  installApp: (deviceId: string, appPath: string) => Promise<string>;
  uninstallApp: (deviceId: string, packageName: string) => Promise<string>;
  listPackages: (deviceId: string) => Promise<string[]>;
  screenshot: (deviceId: string, outputPath?: string | null) => Promise<string>;
  startScreenRecord: (deviceId: string) => Promise<string>;
  stopScreenRecord: (deviceId: string, outputPath?: string | null) => Promise<string>;
  pushFile: (deviceId: string, localPath: string, remotePath: string) => Promise<string>;
  pullFile: (deviceId: string, remotePath: string, localPath: string) => Promise<string>;
  pushCertificate: (deviceId: string, certPath: string, remoteDir?: string | null) => Promise<string>;
  openCertificateInstaller: (deviceId: string, remotePath: string) => Promise<string>;
}

export function isDeviceAdapter(adapter: Adapter): adapter is DeviceAdapter {
  return adapter.supports("device-operations");
}
