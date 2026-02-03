/**
 * 设备上下文
 * 提供全局设备状态管理，让所有模块可以消费当前选中的设备
 */
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
  useMemo,
  useRef,
} from "react";
import type { Device, DevicePlatform } from "../../core/device/types";
import type { CoreKernel } from "../../core/kernel";
import type { DeviceAdapter, DeviceInfo } from "../../core/adapters/deviceAdapter";
import { isDeviceAdapter } from "../../core/adapters/deviceAdapter";

function deviceInfoChanged(device: Device, info: DeviceInfo) {
  return Object.entries(info).some(([key, value]) => {
    if (value === undefined) {
      return false;
    }
    return device[key as keyof Device] !== value;
  });
}

/** 设备上下文值 */
export interface DeviceContextValue {
  /** 设备列表 */
  devices: Device[];
  /** 当前选中的设备 */
  selectedDevice: Device | null;
  /** 当前设备适配器 */
  deviceAdapter: DeviceAdapter | null;
  /** 当前可用平台 */
  availablePlatforms: DevicePlatform[];
  /** 是否正在加载 */
  loading: boolean;
  /** 错误信息 */
  error: string | null;
  /** 选择设备 */
  selectDevice: (id: string | null) => void;
  /** 刷新设备列表 */
  refreshDevices: () => Promise<void>;
  /** 是否在 Tauri 环境中 */
  isTauri: boolean;
}

/** 设备上下文 */
const DeviceContext = createContext<DeviceContextValue | null>(null);

/** 设备提供者属性 */
export interface DeviceProviderProps {
  children: ReactNode;
  /** 内核实例，用于获取适配器 */
  kernel?: CoreKernel;
  /** 自动刷新间隔（毫秒），0 表示不自动刷新 */
  autoRefreshInterval?: number;
}

/**
 * 设备提供者组件
 * 管理设备状态并提供给子组件
 */
export function DeviceProvider({
  children,
  kernel,
  autoRefreshInterval = 5000,
}: DeviceProviderProps) {
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isTauri, setIsTauri] = useState(false);
  const deviceInfoCacheRef = useRef(
    new Map<string, { ts: number; info: DeviceInfo }>(),
  );
  const deviceInfoInFlightRef = useRef(new Set<string>());
  const missingCountRef = useRef(new Map<string, number>());

  const deviceInfoTTL = 10000;
  const missingThreshold = 2;

  const deviceAdapters = useMemo(() => {
    if (!kernel) {
      return [] as DeviceAdapter[];
    }
    return kernel
      .getAdapterRegistry()
      .findAllByCapability("device-operations")
      .filter(isDeviceAdapter);
  }, [kernel]);

  const availablePlatforms = useMemo(
    () => deviceAdapters.map((adapter) => adapter.metadata.platform),
    [deviceAdapters],
  );

  // 检测 Tauri 环境
  useEffect(() => {
    import("@tauri-apps/api/core")
      .then(() => setIsTauri(true))
      .catch(() => setIsTauri(false));
  }, []);

  /** 刷新设备列表 */
  const refreshDevices = useCallback(async () => {
    if (!isTauri) {
      setError("Tauri 环境不可用");
      return;
    }

    if (deviceAdapters.length === 0) {
      setError("未检测到可用设备平台");
      setDevices([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const results = await Promise.allSettled(
        deviceAdapters.map((adapter) => adapter.listDevices()),
      );

      const convertedDevices = results
        .filter((result): result is PromiseFulfilledResult<Device[]> => result.status === "fulfilled")
        .flatMap((result) => result.value);

      const failures = results.filter((result) => result.status === "rejected");

      if (failures.length === results.length) {
        setError("所有平台设备列表获取失败");
        return;
      }

      if (failures.length > 0) {
        setError("部分平台设备列表获取失败，请检查依赖状态");
      }

      setDevices((prev) => {
        const prevMap = new Map(prev.map((device) => [device.id, device]));
        const mergedDevices = convertedDevices.map((device) => ({
          ...prevMap.get(device.id),
          ...device,
        }));
        const nextIds = new Set(mergedDevices.map((device) => device.id));
        const retained = prev.filter((device) => {
          if (nextIds.has(device.id)) {
            missingCountRef.current.set(device.id, 0);
            return false;
          }
          const count = (missingCountRef.current.get(device.id) ?? 0) + 1;
          missingCountRef.current.set(device.id, count);
          return count < missingThreshold;
        });
        const nextDevices = [...mergedDevices, ...retained];
        if (
          selectedDeviceId &&
          !nextDevices.some((device) => device.id === selectedDeviceId)
        ) {
          setSelectedDeviceId(null);
        }
        return nextDevices;
      });

    } catch (e) {
      setError(
        e instanceof Error ? e.message : "获取设备列表失败",
      );
    } finally {
      setLoading(false);
    }
  }, [deviceAdapters, isTauri, selectedDeviceId]);

  /** 选择设备 */
  const selectDevice = useCallback((id: string | null) => {
    setSelectedDeviceId(id);
  }, []);

  // 初始化时刷新设备列表
  useEffect(() => {
    if (isTauri) {
      void refreshDevices();
    }
  }, [isTauri, refreshDevices]);

  // 自动刷新设备列表
  useEffect(() => {
    if (!isTauri || autoRefreshInterval <= 0) {
      return;
    }

    const interval = setInterval(() => {
      void refreshDevices();
    }, autoRefreshInterval);

    return () => clearInterval(interval);
  }, [isTauri, autoRefreshInterval, refreshDevices]);

  // 获取当前选中的设备对象
  const selectedDevice = devices.find((d) => d.id === selectedDeviceId) ?? null;
  const deviceAdapter = selectedDevice
    ? deviceAdapters.find((adapter) => adapter.metadata.platform === selectedDevice.platform) ?? null
    : null;

  useEffect(() => {
    let active = true;
    const fetchInfo = async () => {
      if (!selectedDevice || !deviceAdapter) {
        return;
      }
      if (!deviceAdapter.supportsFeature("device-info")) {
        return;
      }
      const deviceId = selectedDevice.id;
      const now = Date.now();
      const cached = deviceInfoCacheRef.current.get(deviceId);
      if (cached && now - cached.ts < deviceInfoTTL) {
        return;
      }
      if (deviceInfoInFlightRef.current.has(deviceId)) {
        return;
      }
      deviceInfoInFlightRef.current.add(deviceId);
      try {
        const info = await deviceAdapter.getDeviceInfo(deviceId);
        deviceInfoCacheRef.current.set(deviceId, { ts: now, info });
        if (!active) return;
        setDevices((prev) =>
          prev.map((device) =>
            device.id === deviceId && deviceInfoChanged(device, info)
              ? { ...device, ...info }
              : device,
          ),
        );
      } catch (e) {
        console.warn("获取设备信息失败:", e);
      } finally {
        deviceInfoInFlightRef.current.delete(deviceId);
      }
    };
    void fetchInfo();
    return () => {
      active = false;
    };
  }, [deviceAdapter, selectedDevice]);

  const value: DeviceContextValue = {
    devices,
    selectedDevice,
    deviceAdapter,
    availablePlatforms,
    loading,
    error,
    selectDevice,
    refreshDevices,
    isTauri,
  };

  return <DeviceContext.Provider value={value}>{children}</DeviceContext.Provider>;
}

/**
 * 使用设备上下文
 * @throws 如果不在 DeviceProvider 内使用会抛出错误
 */
export function useDeviceContext(): DeviceContextValue {
  const context = useContext(DeviceContext);
  if (!context) {
    throw new Error("useDeviceContext 必须在 DeviceProvider 内使用");
  }
  return context;
}
