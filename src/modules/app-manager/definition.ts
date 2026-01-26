/**
 * 应用管理模块定义
 */
import type { ModuleDefinition } from "../../core";

export const appManagerModule: ModuleDefinition = {
  manifest: {
    id: "device.app.manager",
    name: "应用管理",
    category: "设备能力",
    icon: "mdi:application",
    version: "1.0.0",
    activationMode: "exclusive",
    ui: {
      kind: "workspace",
      viewId: "app-manager",
      title: "应用管理",
      description: "安装、卸载和管理设备上的应用",
    },
  },
  factory: (context) => ({
    manifest: appManagerModule.manifest,
    lifecycle: {
      onInit: async () => {
        // 模块初始化逻辑（可选）
      },
    },
  }),
};
