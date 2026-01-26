/**
 * JSON 格式化模块定义
 */
import type { ModuleDefinition, ModuleContext } from "../../core";

export const jsonFormatterModule: ModuleDefinition = {
  manifest: {
    id: "tool.json.formatter",
    name: "JSON 格式化",
    category: "通用工具",
    icon: "mdi:code-json",
    version: "1.0.0",
    activationMode: "exclusive",
    ui: {
      kind: "workspace",
      viewId: "json-formatter",
      title: "JSON 格式化工具",
      description: "格式化、验证和美化 JSON 数据",
    },
  },
  factory: (context: ModuleContext) => ({
    manifest: jsonFormatterModule.manifest,
    lifecycle: {
      onInit: async () => {
        // 模块初始化逻辑（可选）
      },
    },
  }),
};
