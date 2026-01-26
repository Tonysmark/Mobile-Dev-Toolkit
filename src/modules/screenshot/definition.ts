/**
 * 截图模块定义
 */
import type { ModuleDefinition } from "../../core";

export const screenshotModule: ModuleDefinition = {
  manifest: {
    id: "device.screenshot",
    name: "截图",
    category: "设备能力",
    icon: "mdi:camera",
    version: "1.0.0",
    activationMode: "exclusive",
    ui: {
      kind: "workspace",
      viewId: "screenshot",
      title: "截图",
      description: "一键截图并保存到本地",
    },
  },
  factory: (context) => ({
    manifest: screenshotModule.manifest,
    lifecycle: {
      onInit: async () => {
        // 模块初始化逻辑（可选）
      },
    },
  }),
};
