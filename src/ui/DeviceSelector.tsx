import { Icon } from "@iconify/react";
import { useDeviceContext } from "./device";

export function DeviceSelector() {
  const {
    devices,
    selectedDevice,
    loading,
    error,
    selectDevice,
    refreshDevices,
    isTauri,
  } = useDeviceContext();

  const handleDeviceChange = (deviceId: string | null) => {
    selectDevice(deviceId);
  };

  if (!isTauri) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500">
        <Icon icon="mdi:cellphone-off" className="h-4 w-4" />
        <span>Tauri 环境不可用</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <select
          value={selectedDevice?.id || ""}
          onChange={(e) =>
            handleDeviceChange(e.target.value || null)
          }
          disabled={loading}
          className="appearance-none rounded-lg border border-gray-300 bg-white px-3 py-1.5 pr-8 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200 disabled:bg-gray-50"
        >
          <option value="">未选择设备</option>
          {devices.map((device) => (
            <option key={device.id} value={device.id}>
              {device.id} ({device.status})
            </option>
          ))}
        </select>
        <Icon
          icon="mdi:chevron-down"
          className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
        />
      </div>

      <button
        type="button"
        onClick={refreshDevices}
        disabled={loading}
        className="flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
        title="刷新设备列表"
      >
        <Icon
          icon={loading ? "mdi:loading" : "mdi:refresh"}
          className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
        />
      </button>

      {error && (
        <div className="flex items-center gap-1 text-xs text-red-600">
          <Icon icon="mdi:alert-circle" className="h-4 w-4" />
          <span>{error}</span>
        </div>
      )}

      {selectedDevice && (
        <div className="flex items-center gap-1 text-xs text-gray-600">
          <Icon icon="mdi:check-circle" className="h-4 w-4 text-green-600" />
          <span>已连接</span>
        </div>
      )}
    </div>
  );
}
