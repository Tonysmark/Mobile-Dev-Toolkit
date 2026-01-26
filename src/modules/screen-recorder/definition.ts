/**
 * 录屏模块定义
 */
import type { ModuleDefinition } from "../../core";

export const screenRecorderModule: ModuleDefinition = {
  manifest: {
    id: "device.screen.recorder",
    name: "录屏",
    category: "设备能力",
    icon: "mdi:record-rec",
    version: "1.0.0",
    activationMode: "exclusive",
    ui: {
      kind: "workspace",
      viewId: "screen-recorder",
      title: "录屏",
      description: "开始/停止录制并查看录制时长",
    },
  },
  factory: () => ({
    manifest: screenRecorderModule.manifest,
    lifecycle: {
      onInit: async () => {
        // 模块初始化逻辑（可选）
      },
    },
  }),
};
