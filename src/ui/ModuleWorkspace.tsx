import { Icon } from "@iconify/react";
import type { ModuleId, ModuleUIDescriptor } from "../core";
import { ModuleViewHost } from "./ModuleViewHost";

type UtilityDescriptor = {
  moduleId: ModuleId;
  descriptor: ModuleUIDescriptor;
};

type ModuleWorkspaceProps = {
  activeModuleId: ModuleId | null;
  workspaceDescriptor: ModuleUIDescriptor | null;
  utilityDescriptors: UtilityDescriptor[];
};

export function ModuleWorkspace({
  activeModuleId,
  workspaceDescriptor,
  utilityDescriptors,
}: ModuleWorkspaceProps) {
  return (
    <section className="flex-1 overflow-auto p-6">
      <div className="mb-6">
        <div className="mb-2 flex items-center gap-2">
          <Icon icon="mdi:view-dashboard" className="h-5 w-5 text-gray-600" />
          <h1 className="text-lg font-semibold text-gray-900">工作区</h1>
        </div>
        <div className="text-sm text-gray-500">
          当前模块：{activeModuleId ?? "未选择"}
        </div>
      </div>

      <div className="min-h-[240px] rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        {workspaceDescriptor ? (
          <ModuleViewHost descriptor={workspaceDescriptor} />
        ) : (
          <div className="flex h-full min-h-[200px] items-center justify-center text-gray-400">
            <div className="text-center">
              <Icon
                icon="mdi:file-document-outline"
                className="mx-auto mb-2 h-12 w-12"
              />
              <p>该模块未提供工作区 UI</p>
            </div>
          </div>
        )}
      </div>

      {utilityDescriptors.length > 0 ? (
        <div className="mt-8">
          <div className="mb-4 flex items-center gap-2">
            <Icon icon="mdi:tools" className="h-5 w-5 text-gray-600" />
            <h2 className="text-base font-semibold text-gray-900">工具面板</h2>
          </div>
          <div className="grid gap-4">
            {utilityDescriptors.map(({ moduleId, descriptor }) => (
              <div
                key={moduleId}
                className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
              >
                <div className="mb-2 text-xs font-mono text-gray-500">
                  {moduleId}
                </div>
                <ModuleViewHost descriptor={descriptor} />
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
