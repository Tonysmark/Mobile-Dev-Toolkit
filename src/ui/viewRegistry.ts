import type { ReactElement } from "react";
import type { ModuleUIDescriptor } from "../core";

export type ModuleViewRenderer = (props: {
  descriptor: ModuleUIDescriptor;
}) => ReactElement;

// UI 渲染器注册表：仅由 UI 层维护，不与模块实例或生命周期耦合
const viewRegistry: Record<string, ModuleViewRenderer> = {};

export function registerModuleView(
  viewId: string,
  renderer: ModuleViewRenderer,
): void {
  viewRegistry[viewId] = renderer;
}

export function getModuleView(viewId: string): ModuleViewRenderer | undefined {
  return viewRegistry[viewId];
}
