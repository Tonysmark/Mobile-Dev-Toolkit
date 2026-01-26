/**
 * 文件管理模块定义
 */
import type { ModuleDefinition } from "../../core";

export const fileExplorerModule: ModuleDefinition = {
  manifest: {
    id: "device.file.explorer",
    name: "文件管理",
    category: "设备能力",
    icon: "mdi:file-tree",
    version: "1.0.0",
    activationMode: "exclusive",
    ui: {
      kind: "workspace",
      viewId: "file-explorer",
      title: "文件管理",
      description: "导入/导出文件，并提供常用目录快捷入口",
    },
  },
  factory: () => ({
    manifest: fileExplorerModule.manifest,
    lifecycle: {
      onInit: async () => {
        // 模块初始化逻辑（可选）
      },
    },
  }),
};
