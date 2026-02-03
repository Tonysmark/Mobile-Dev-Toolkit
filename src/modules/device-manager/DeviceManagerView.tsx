import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@iconify/react";
import type { ModuleUIDescriptor } from "../../core";
import { useDeviceContext } from "../../ui/device";

type DeviceManagerViewProps = {
  descriptor: ModuleUIDescriptor;
};

export const viewId = "device-manager";

export function DeviceManagerView({ descriptor }: DeviceManagerViewProps) {
  const {
    selectedDevice,
    loading,
    error,
    refreshDevices,
    isTauri,
    deviceAdapter,
  } = useDeviceContext();

  const [mirrorActive, setMirrorActive] = useState(false);
  const [mirrorUrl, setMirrorUrl] = useState<string | null>(null);
  const [mirrorError, setMirrorError] = useState<string | null>(null);
  const [mirrorStarting, setMirrorStarting] = useState(false);
  const [screenshoting, setScreenshoting] = useState(false);
  const [lastScreenshot, setLastScreenshot] = useState<string | null>(null);
  const [screenshotError, setScreenshotError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const decoderRef = useRef<VideoDecoder | null>(null);
  const bufferRef = useRef<Uint8Array>(new Uint8Array(0));
  const spsRef = useRef<Uint8Array | null>(null);
  const ppsRef = useRef<Uint8Array | null>(null);
  const timestampRef = useRef<number>(0);
  const activeDeviceIdRef = useRef<string | null>(null);

  const canMirror = deviceAdapter?.supportsFeature("mirror-stream") ?? false;
  const canScreenshot = deviceAdapter?.supportsFeature("screenshot") ?? false;

  const handleRefreshAll = async () => {
    await refreshDevices();
  };

  const toHex = useCallback((value: number) => {
    return value.toString(16).padStart(2, "0");
  }, []);

  const buildAvcc = useCallback((sps: Uint8Array, pps: Uint8Array) => {
    const size = 7 + 2 + sps.length + 1 + 2 + pps.length;
    const avcc = new Uint8Array(size);
    avcc[0] = 0x01;
    avcc[1] = sps[1] ?? 0x42;
    avcc[2] = sps[2] ?? 0x00;
    avcc[3] = sps[3] ?? 0x1e;
    avcc[4] = 0xff;
    avcc[5] = 0xe1;
    avcc[6] = (sps.length >> 8) & 0xff;
    avcc[7] = sps.length & 0xff;
    avcc.set(sps, 8);
    const ppsOffset = 8 + sps.length;
    avcc[ppsOffset] = 0x01;
    avcc[ppsOffset + 1] = (pps.length >> 8) & 0xff;
    avcc[ppsOffset + 2] = pps.length & 0xff;
    avcc.set(pps, ppsOffset + 3);
    return avcc;
  }, []);

  const codecFromSps = useCallback(
    (sps: Uint8Array) => {
      if (sps.length < 4) {
        return "avc1.42e01e";
      }
      return `avc1.${toHex(sps[1])}${toHex(sps[2])}${toHex(sps[3])}`;
    },
    [toHex],
  );

  const extractNalUnits = useCallback((data: Uint8Array) => {
    const nalus: Uint8Array[] = [];
    let offset = 0;
    const findStartCode = (start: number) => {
      for (let i = start; i + 3 < data.length; i += 1) {
        if (data[i] === 0x00 && data[i + 1] === 0x00) {
          if (data[i + 2] === 0x01) {
            return { index: i, length: 3 };
          }
          if (data[i + 2] === 0x00 && data[i + 3] === 0x01) {
            return { index: i, length: 4 };
          }
        }
      }
      return null;
    };

    let start = findStartCode(offset);
    if (!start) {
      return { nalus, remaining: data };
    }
    while (start) {
      const next = findStartCode(start.index + start.length);
      if (!next) {
        return { nalus, remaining: data.slice(start.index) };
      }
      const nalu = data.slice(start.index + start.length, next.index);
      if (nalu.length > 0) {
        nalus.push(nalu);
      }
      start = next;
    }
    return { nalus, remaining: new Uint8Array(0) };
  }, []);

  const buildSample = useCallback((nalus: Uint8Array[]) => {
    const total = nalus.reduce((sum, nalu) => sum + 4 + nalu.length, 0);
    const sample = new Uint8Array(total);
    let offset = 0;
    nalus.forEach((nalu) => {
      const length = nalu.length;
      sample[offset] = (length >> 24) & 0xff;
      sample[offset + 1] = (length >> 16) & 0xff;
      sample[offset + 2] = (length >> 8) & 0xff;
      sample[offset + 3] = length & 0xff;
      sample.set(nalu, offset + 4);
      offset += 4 + length;
    });
    return sample;
  }, []);

  const ensureDecoder = useCallback(
    (sps: Uint8Array, pps: Uint8Array) => {
      if (decoderRef.current) {
        return;
      }
      const codec = codecFromSps(sps);
      const description = buildAvcc(sps, pps);
      decoderRef.current = new VideoDecoder({
        output: (frame) => {
          const canvas = canvasRef.current;
          if (!canvas) {
            frame.close();
            return;
          }
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            frame.close();
            return;
          }
          canvas.width = frame.displayWidth;
          canvas.height = frame.displayHeight;
          ctx.drawImage(frame, 0, 0, canvas.width, canvas.height);
          frame.close();
        },
        error: (e) => {
          console.error("镜像解码失败:", e);
          setMirrorError("镜像解码失败");
        },
      });
      decoderRef.current.configure({
        codec,
        description,
      });
    },
    [buildAvcc, codecFromSps],
  );

  const handleStreamData = useCallback(
    (chunk: Uint8Array) => {
      const merged = new Uint8Array(bufferRef.current.length + chunk.length);
      merged.set(bufferRef.current, 0);
      merged.set(chunk, bufferRef.current.length);
      const { nalus, remaining } = extractNalUnits(merged);
      bufferRef.current = remaining;
      nalus.forEach((nalu) => {
        const type = nalu[0] & 0x1f;
        if (type === 7) {
          spsRef.current = nalu;
          return;
        }
        if (type === 8) {
          ppsRef.current = nalu;
          return;
        }
        if (!spsRef.current || !ppsRef.current) {
          return;
        }
        ensureDecoder(spsRef.current, ppsRef.current);
        if (!decoderRef.current) {
          return;
        }
        const isKey = type === 5;
        const nalusToSend = isKey
          ? [spsRef.current, ppsRef.current, nalu]
          : [nalu];
        const data = buildSample(nalusToSend);
        const chunkType = isKey ? "key" : "delta";
        const encoded = new EncodedVideoChunk({
          type: chunkType,
          timestamp: timestampRef.current,
          data,
        });
        timestampRef.current += 33_333;
        decoderRef.current.decode(encoded);
      });
    },
    [buildSample, ensureDecoder, extractNalUnits],
  );

  const stopMirror = useCallback(async () => {
    const activeId = activeDeviceIdRef.current;
    activeDeviceIdRef.current = null;
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (decoderRef.current) {
      decoderRef.current.close();
      decoderRef.current = null;
    }
    bufferRef.current = new Uint8Array(0);
    spsRef.current = null;
    ppsRef.current = null;
    timestampRef.current = 0;
    setMirrorActive(false);
    setMirrorUrl(null);
    if (activeId && deviceAdapter?.supportsFeature("mirror-stream")) {
      try {
        await deviceAdapter.stopMirrorStream(activeId);
      } catch (e) {
        console.warn("停止镜像失败:", e);
      }
    }
  }, [deviceAdapter]);

  const startMirror = useCallback(async () => {
    if (!selectedDevice) {
      setMirrorError("请先选择设备");
      return;
    }
    if (!deviceAdapter || !deviceAdapter.supportsFeature("mirror-stream")) {
      setMirrorError("当前平台暂不支持实时镜像");
      return;
    }
    if (typeof VideoDecoder === "undefined") {
      setMirrorError("当前环境不支持视频解码");
      return;
    }
    setMirrorStarting(true);
    setMirrorError(null);
    try {
      const stream = await deviceAdapter.startMirrorStream(selectedDevice.id);
      activeDeviceIdRef.current = selectedDevice.id;
      setMirrorUrl(stream.url);
      setMirrorActive(true);
    } catch (e) {
      setMirrorError(e instanceof Error ? e.message : "启动镜像失败");
    } finally {
      setMirrorStarting(false);
    }
  }, [deviceAdapter, selectedDevice]);

  const handleScreenshot = useCallback(async () => {
    if (!selectedDevice) {
      setScreenshotError("请先选择设备");
      return;
    }
    if (!deviceAdapter || !deviceAdapter.supportsFeature("screenshot")) {
      setScreenshotError("当前平台暂不支持截图");
      return;
    }
    setScreenshoting(true);
    setScreenshotError(null);
    setLastScreenshot(null);
    try {
      const result = await deviceAdapter.screenshot(selectedDevice.id, null);
      setLastScreenshot(result);
    } catch (e) {
      setScreenshotError(e instanceof Error ? e.message : "截图失败");
    } finally {
      setScreenshoting(false);
    }
  }, [deviceAdapter, selectedDevice]);

  useEffect(() => {
    if (!mirrorUrl) {
      return;
    }
    console.debug("[mirror] connecting", mirrorUrl);
    const ws = new WebSocket(mirrorUrl);
    ws.binaryType = "arraybuffer";
    ws.onopen = () => {
      console.debug("[mirror] connected", mirrorUrl);
    };
    ws.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer) {
        handleStreamData(new Uint8Array(event.data));
      }
    };
    ws.onerror = (event) => {
      console.error("[mirror] connection error", mirrorUrl, event);
      setMirrorError("镜像连接失败");
    };
    ws.onclose = () => {
      console.debug("[mirror] connection closed", mirrorUrl);
      setMirrorActive(false);
    };
    wsRef.current = ws;
    return () => {
      console.debug("[mirror] closing connection", mirrorUrl);
      ws.close();
    };
  }, [handleStreamData, mirrorUrl]);

  useEffect(() => {
    if (!selectedDevice?.id && mirrorActive) {
      void stopMirror();
    }
  }, [mirrorActive, selectedDevice?.id, stopMirror]);

  useEffect(() => {
    return () => {
      void stopMirror();
    };
  }, [stopMirror]);

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
    <div className="flex h-full flex-col gap-6 p-6">
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
          disabled={loading}
          className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
        >
          <Icon
            icon={loading ? "mdi:loading" : "mdi:refresh"}
            className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
          />
          刷新
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
          <div className="flex items-center gap-2 text-red-800">
            <Icon icon="mdi:alert-circle" className="h-5 w-5" />
            <span className="text-sm font-medium">{error}</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
        {/* 中心镜像区 */}
        <div className="flex items-center justify-center">
          <div className="relative w-full max-w-[360px] rounded-[2.5rem] border-[10px] border-gray-900 bg-gray-800 shadow-xl">
            <div className="absolute left-1/2 top-3 h-4 w-20 -translate-x-1/2 rounded-full bg-gray-900" />
            <div className="aspect-[9/19] rounded-[2rem] bg-black p-3">
              <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-[1.5rem] bg-black">
                {mirrorActive && selectedDevice ? (
                  <canvas ref={canvasRef} className="h-full w-full object-contain" />
                ) : (
                  <div className="text-center text-sm text-gray-400">
                    {selectedDevice ? "镜像未启动" : "请在顶部选择设备"}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 设备信息与操作 */}
        <div className="flex flex-col gap-4">
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h3 className="mb-3 text-sm font-semibold text-gray-900">设备信息</h3>
            {selectedDevice ? (
              <div className="space-y-2 text-sm text-gray-700">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">设备ID</span>
                  <span className="font-mono">{selectedDevice.id}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">平台</span>
                  <span>{selectedDevice.platform}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">状态</span>
                  <StatusBadge status={selectedDevice.status} />
                </div>
                {selectedDevice.name && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">设备名称</span>
                    <span>{selectedDevice.name}</span>
                  </div>
                )}
                {selectedDevice.model && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">型号</span>
                    <span>{selectedDevice.model}</span>
                  </div>
                )}
                {selectedDevice.version && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">系统版本</span>
                    <span>{selectedDevice.version}</span>
                  </div>
                )}
                {(selectedDevice.batteryLevel !== undefined ||
                  selectedDevice.batteryStatus) && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">电量</span>
                    <span>
                      {selectedDevice.batteryLevel ?? "--"}%
                      {selectedDevice.batteryStatus
                        ? ` (${selectedDevice.batteryStatus})`
                        : ""}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm text-gray-500">未选择设备</div>
            )}
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h3 className="mb-3 text-sm font-semibold text-gray-900">操作</h3>
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={handleScreenshot}
                disabled={!selectedDevice || !canScreenshot || screenshoting}
                className="flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
              >
                <Icon
                  icon={screenshoting ? "mdi:loading" : "mdi:camera"}
                  className={`h-4 w-4 ${screenshoting ? "animate-spin" : ""}`}
                />
                截图
              </button>

              <button
                type="button"
                onClick={mirrorActive ? stopMirror : startMirror}
                disabled={!selectedDevice || !canMirror || mirrorStarting}
                className="flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-3 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
              >
                <Icon
                  icon={mirrorActive ? "mdi:stop-circle" : "mdi:cast-connected"}
                  className="h-4 w-4"
                />
                {mirrorActive ? "停止镜像" : "开始镜像"}
              </button>
            </div>

            {mirrorError && (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                {mirrorError}
              </div>
            )}
            {screenshotError && (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                {screenshotError}
              </div>
            )}
            {lastScreenshot && (
              <div className="mt-3 rounded-lg border border-green-200 bg-green-50 p-3 text-xs text-green-700">
                已保存到: <span className="font-mono">{lastScreenshot}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export const View = DeviceManagerView;

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
