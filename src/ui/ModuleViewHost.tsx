import { Icon } from "@iconify/react";
import type { ModuleUIDescriptor } from "../core";
import { ErrorBoundary } from "./ErrorBoundary";
import { getModuleView } from "./viewRegistry";

type ModuleViewHostProps = {
  descriptor: ModuleUIDescriptor;
};

export function ModuleViewHost({ descriptor }: ModuleViewHostProps) {
  const Renderer = getModuleView(descriptor.viewId);

  if (!Renderer) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
        <div className="mb-2 flex items-center gap-2 text-amber-800">
          <Icon icon="mdi:alert-circle" className="h-5 w-5" />
          <span className="font-medium">未注册视图：{descriptor.viewId}</span>
        </div>
        {descriptor.description ? (
          <div className="text-sm text-amber-700">{descriptor.description}</div>
        ) : null}
      </div>
    );
  }

  // 使用 ErrorBoundary 包裹模块视图，防止单个模块错误导致全局崩溃
  return (
    <ErrorBoundary>
      <Renderer descriptor={descriptor} />
    </ErrorBoundary>
  );
}
