/**
 * 设备管理模块定义（空壳）
 * 等待 Tauri 后端就绪后实现完整功能
 */
import type { ModuleDefinition } from "../../core";

export const deviceManagerModule: ModuleDefinition = {
  manifest: {
    id: "device.core.manager",
    name: "设备管理",
    category: "设备能力",
    icon: "mdi:cellphone-link",
    version: "1.0.0",
    activationMode: "exclusive",
    ui: {
      kind: "workspace",
      viewId: "device-manager",
      title: "设备管理",
      description: "管理连接的移动设备",
    },
  },
  factory: (context) => ({
    manifest: deviceManagerModule.manifest,
    lifecycle: {
      onInit: async () => {
        // 模块初始化逻辑（可选）
      },
    },
  }),
};
