import { Icon } from "@iconify/react";
import type { ModuleUIDescriptor } from "../../core";
import { useDeviceContext, useDependencyStatus } from "../../ui/device";

type DeviceManagerViewProps = {
  descriptor: ModuleUIDescriptor;
};

export const viewId = "device-manager";

export function DeviceManagerView({ descriptor }: DeviceManagerViewProps) {
  const {
    devices,
    selectedDevice,
    loading,
    error,
    refreshDevices,
    isTauri,
    availablePlatforms,
  } = useDeviceContext();

  const { dependencies, checking, refresh: refreshDependencies } =
    useDependencyStatus(false);

  const handleRefreshAll = async () => {
    await Promise.all([refreshDevices(), refreshDependencies()]);
  };

  if (!isTauri) {
    return (
      <div className="flex h-full min-h-[400px] items-center justify-center">
        <div className="text-center">
          <Icon
            icon="mdi:cellphone-off"
            className="mx-auto mb-4 h-16 w-16 text-gray-400"
          />
          <h3 className="mb-2 text-lg font-semibold text-gray-900">
            Tauri 环境不可用
          </h3>
          <p className="text-sm text-gray-600">
            设备管理功能需要在 Tauri 环境中运行
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col space-y-6 p-6">
      {/* 标题和操作栏 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            {descriptor.title || "设备管理"}
          </h2>
          {descriptor.description && (
            <p className="mt-1 text-sm text-gray-600">
              {descriptor.description}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={handleRefreshAll}
          disabled={loading || checking}
          className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
        >
          <Icon
            icon={loading || checking ? "mdi:loading" : "mdi:refresh"}
            className={`h-4 w-4 ${loading || checking ? "animate-spin" : ""}`}
          />
          刷新
        </button>
      </div>

      {/* 依赖工具状态 */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold text-gray-900">
          依赖工具状态
        </h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {dependencies.adb && (
            <DependencyCard dependency={dependencies.adb} />
          )}
          {dependencies.hdc && (
            <DependencyCard dependency={dependencies.hdc} />
          )}
          {dependencies.idevice && (
            <DependencyCard dependency={dependencies.idevice} />
          )}
          {!dependencies.adb &&
            !dependencies.hdc &&
            !dependencies.idevice && (
              <div className="col-span-full text-center text-sm text-gray-500">
                未检测到依赖工具
              </div>
            )}
        </div>
      </div>

      {/* 可用平台 */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold text-gray-900">可用平台</h3>
        {availablePlatforms.length === 0 ? (
          <div className="text-sm text-gray-500">未检测到可用平台</div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {availablePlatforms.map((platform) => (
              <span
                key={platform}
                className="rounded-full border border-primary-200 bg-primary-50 px-3 py-1 text-xs font-medium text-primary-700"
              >
                {platform === "android"
                  ? "Android"
                  : platform === "ios"
                    ? "iOS"
                    : platform === "harmonyos"
                      ? "HarmonyOS"
                      : platform}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 设备列表 */}
      <div className="flex-1 rounded-lg border border-gray-200 bg-white p-4">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">
            已连接设备 ({devices.length})
          </h3>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3">
            <div className="flex items-center gap-2 text-red-800">
              <Icon icon="mdi:alert-circle" className="h-5 w-5" />
              <span className="text-sm font-medium">{error}</span>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Icon
              icon="mdi:loading"
              className="h-8 w-8 animate-spin text-gray-400"
            />
            <span className="ml-2 text-sm text-gray-600">正在加载设备...</span>
          </div>
        ) : devices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Icon
              icon="mdi:cellphone-link-off"
              className="mb-4 h-12 w-12 text-gray-400"
            />
            <p className="text-sm font-medium text-gray-900">未检测到设备</p>
            <p className="mt-1 text-xs text-gray-500">
              请确保设备已连接并启用 USB 调试
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {devices.map((device) => (
              <DeviceCard
                key={device.id}
                device={device}
                isSelected={selectedDevice?.id === device.id}
              />
            ))}
          </div>
        )}
      </div>

      {/* 当前选中设备详情 */}
      {selectedDevice && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold text-gray-900">
            当前选中设备
          </h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">设备ID:</span>
              <span className="ml-2 font-mono text-gray-900">
                {selectedDevice.id}
              </span>
            </div>
            <div>
              <span className="text-gray-500">状态:</span>
              <span className="ml-2 text-gray-900">
                <StatusBadge status={selectedDevice.status} />
              </span>
            </div>
            {selectedDevice.model && (
              <div>
                <span className="text-gray-500">型号:</span>
                <span className="ml-2 text-gray-900">{selectedDevice.model}</span>
              </div>
            )}
            <div>
              <span className="text-gray-500">平台:</span>
              <span className="ml-2 text-gray-900">{selectedDevice.platform}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export const View = DeviceManagerView;

/** 设备卡片组件 */
function DeviceCard({
  device,
  isSelected,
}: {
  device: import("../../core").Device;
  isSelected: boolean;
}) {
  const { selectDevice } = useDeviceContext();

  return (
    <div
      className={`cursor-pointer rounded-lg border p-4 transition-colors ${
        isSelected
          ? "border-primary-500 bg-primary-50"
          : "border-gray-200 bg-gray-50 hover:border-gray-300 hover:bg-gray-100"
      }`}
      onClick={() => selectDevice(device.id)}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Icon
            icon="mdi:cellphone"
            className={`h-6 w-6 ${
              isSelected ? "text-primary-600" : "text-gray-400"
            }`}
          />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-medium text-gray-900">
                {device.id}
              </span>
              {isSelected && (
                <Icon
                  icon="mdi:check-circle"
                  className="h-4 w-4 text-primary-600"
                />
              )}
            </div>
            <div className="mt-1 flex items-center gap-2 text-xs text-gray-600">
              <StatusBadge status={device.status} />
              {device.model && (
                <>
                  <span>•</span>
                  <span>{device.model}</span>
                </>
              )}
            </div>
          </div>
        </div>
        <Icon
          icon="mdi:chevron-right"
          className="h-5 w-5 text-gray-400"
        />
      </div>
    </div>
  );
}

/** 状态徽章组件 */
function StatusBadge({
  status,
}: {
  status: import("../../core").DeviceStatus;
}) {
  const statusConfig = {
    device: {
      icon: "mdi:check-circle",
      color: "text-green-600",
      bg: "bg-green-50",
      label: "已连接",
    },
    offline: {
      icon: "mdi:cellphone-off",
      color: "text-gray-600",
      bg: "bg-gray-50",
      label: "离线",
    },
    unauthorized: {
      icon: "mdi:alert-circle",
      color: "text-yellow-600",
      bg: "bg-yellow-50",
      label: "未授权",
    },
    "no-permissions": {
      icon: "mdi:lock",
      color: "text-red-600",
      bg: "bg-red-50",
      label: "无权限",
    },
  };

  const config = statusConfig[status] || statusConfig.offline;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${config.bg} ${config.color}`}
    >
      <Icon icon={config.icon} className="h-3 w-3" />
      {config.label}
    </span>
  );
}

/** 依赖工具卡片组件 */
function DependencyCard({
  dependency,
}: {
  dependency: import("../../core").Dependency;
}) {
  const statusConfig = {
    available: {
      icon: "mdi:check-circle",
      color: "text-green-600",
      bg: "bg-green-50",
    },
    unavailable: {
      icon: "mdi:close-circle",
      color: "text-red-600",
      bg: "bg-red-50",
    },
    checking: {
      icon: "mdi:loading",
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    unknown: {
      icon: "mdi:help-circle",
      color: "text-gray-600",
      bg: "bg-gray-50",
    },
  };

  const config = statusConfig[dependency.status] || statusConfig.unknown;

  return (
    <div className={`rounded-lg border p-3 ${config.bg} border-gray-200`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon
            icon={config.icon}
            className={`h-5 w-5 ${config.color} ${
              dependency.status === "checking" ? "animate-spin" : ""
            }`}
          />
          <div>
            <div className="text-sm font-medium text-gray-900">
              {dependency.displayName}
            </div>
            {dependency.version && (
              <div className="text-xs text-gray-600">
                版本: {dependency.version}
              </div>
            )}
          </div>
        </div>
      </div>
      {dependency.error && (
        <div className="mt-2 text-xs text-red-600">{dependency.error}</div>
      )}
      {dependency.path && (
        <div className="mt-1 text-xs text-gray-500">
          路径: {dependency.path}
        </div>
      )}
    </div>
  );
}
