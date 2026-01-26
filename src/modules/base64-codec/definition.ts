/**
 * Base64 编解码模块定义
 */
import type { ModuleDefinition } from "../../core";

export const base64CodecModule: ModuleDefinition = {
  manifest: {
    id: "tool.base64.codec",
    name: "Base64 编解码",
    category: "通用工具",
    icon: "mdi:code-braces",
    version: "1.0.0",
    activationMode: "exclusive",
    ui: {
      kind: "workspace",
      viewId: "base64-codec",
      title: "Base64 编解码工具",
      description: "将文本编码为 Base64 或解码 Base64 文本",
    },
  },
  factory: (context) => ({
    manifest: base64CodecModule.manifest,
    lifecycle: {
      onInit: async () => {
        // 模块初始化逻辑（可选）
      },
    },
  }),
};
