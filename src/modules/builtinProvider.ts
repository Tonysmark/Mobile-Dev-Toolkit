/**
 * 内置模块提供者
 * 提供系统内置的通用工具模块
 */
import type { ModuleProvider } from "../core";

// 延迟导入模块定义，避免循环依赖
export const builtinModuleProvider: ModuleProvider = {
  id: "builtin",
  load: async () => {
    // 动态导入模块定义
    const [
      { jsonFormatterModule },
      { base64CodecModule },
      { deviceManagerModule },
      { appManagerModule },
      { fileExplorerModule },
      { certificateManagerModule },
    ] = await Promise.all([
      import("./json-formatter/definition"),
      import("./base64-codec/definition"),
      import("./device-manager/definition"),
      import("./app-manager/definition"),
      import("./file-explorer/definition"),
      import("./certificate-manager/definition"),
    ]);

    return [
      jsonFormatterModule,
      base64CodecModule,
      deviceManagerModule,
      appManagerModule,
      fileExplorerModule,
      certificateManagerModule,
    ];
  },
};
