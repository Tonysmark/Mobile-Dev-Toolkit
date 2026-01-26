/**
 * 注册内置模块的视图组件
 * 在应用启动时调用，将模块视图注册到 UI 层的 viewRegistry
 */
import type { ModuleViewRenderer } from "../ui/viewRegistry";
import { registerModuleView } from "../ui/viewRegistry";

type ViewModule = {
  viewId?: string;
  View?: ModuleViewRenderer;
  default?: ModuleViewRenderer;
};

const viewModules = import.meta.glob("./**/*View.tsx", { eager: true }) as Record<
  string,
  ViewModule
>;

/**
 * 注册所有内置模块视图
 */
export function registerBuiltinViews(): void {
  Object.entries(viewModules).forEach(([path, module]) => {
    const viewId = module.viewId;
    const renderer = module.View ?? module.default;

    if (!viewId || !renderer) {
      console.warn(`跳过视图注册: ${path} 缺少 viewId 或 View 导出`);
      return;
    }

    registerModuleView(viewId, renderer);
  });
}
