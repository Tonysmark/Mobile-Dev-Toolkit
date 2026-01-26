import { Icon } from "@iconify/react";
import type { CoreKernel, ModuleManifest } from "../core";
import { DeviceSelector } from "./DeviceSelector";
import { ModuleNavigation } from "./ModuleNavigation";
import { ModuleWorkspace } from "./ModuleWorkspace";
import { useModuleManagerSnapshot } from "./useModuleManagerSnapshot";

type KernelUIProps = {
  kernel: CoreKernel;
};

function toManifestList(manifests: ModuleManifest[]): ModuleManifest[] {
  return manifests.slice().sort((a, b) => a.name.localeCompare(b.name));
}

export function KernelUI({ kernel }: KernelUIProps) {
  const registry = kernel.getModuleRegistry();
  const manager = kernel.getModuleManager();

  // 仅使用模块清单构建导航列表，避免接触模块实例
  const manifests = toManifestList(
    registry.list().map((definition) => definition.manifest),
  );

  const { activeExclusiveModuleId, activeModuleIds } =
    useModuleManagerSnapshot(kernel);

  const activeManifest =
    manifests.find((manifest) => manifest.id === activeExclusiveModuleId) ??
    null;
  const workspaceDescriptor =
    activeManifest?.ui?.kind === "workspace" ? activeManifest.ui : null;
  const utilityDescriptors = manifests
    .filter((manifest) => manifest.ui?.kind === "utility")
    .filter((manifest) => activeModuleIds.includes(manifest.id))
    .map((manifest) => ({
      moduleId: manifest.id,
      descriptor: manifest.ui!,
    }));

  return (
    <div className="flex h-screen flex-col bg-gray-50 font-sans">
      {/* 顶部工具栏 */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-2">
        <div className="flex items-center gap-2">
          <Icon icon="mdi:cellphone-link" className="h-5 w-5 text-gray-600" />
          <h1 className="text-base font-semibold text-gray-900">
            Mobile Dev Toolkit
          </h1>
        </div>
        <DeviceSelector />
      </div>

      {/* 主内容区 */}
      <div className="flex flex-1 overflow-hidden">
        <ModuleNavigation
          manifests={manifests}
          activeModuleId={activeExclusiveModuleId}
          onActivate={(moduleId) => {
            // UI 只通过 ModuleManager 公共 API 请求激活，不控制规则
            void manager?.activate(moduleId);
          }}
        />
        <ModuleWorkspace
          activeModuleId={activeExclusiveModuleId}
          workspaceDescriptor={workspaceDescriptor}
          utilityDescriptors={utilityDescriptors}
        />
      </div>
    </div>
  );
}
