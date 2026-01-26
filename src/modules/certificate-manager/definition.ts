/**
 * 证书管理模块定义
 */
import type { ModuleDefinition } from "../../core";

export const certificateManagerModule: ModuleDefinition = {
  manifest: {
    id: "device.certificate.manager",
    name: "证书管理",
    category: "设备能力",
    icon: "mdi:certificate",
    version: "1.0.0",
    activationMode: "exclusive",
    ui: {
      kind: "workspace",
      viewId: "certificate-manager",
      title: "证书管理",
      description: "导入 Charles 证书并启动安装向导",
    },
  },
  factory: () => ({
    manifest: certificateManagerModule.manifest,
    lifecycle: {
      onInit: async () => {
        // 模块初始化逻辑（可选）
      },
    },
  }),
};
