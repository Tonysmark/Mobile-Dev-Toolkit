import { useCallback, useEffect, useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import type { ModuleUIDescriptor } from "../../core";
import { useDeviceContext } from "../../ui/device";

type ScreenRecorderViewProps = {
  descriptor: ModuleUIDescriptor;
};

export const viewId = "screen-recorder";

function formatDuration(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function ScreenRecorderView({ descriptor }: ScreenRecorderViewProps) {
  const { selectedDevice, isTauri, deviceAdapter } = useDeviceContext();
  const [recording, setRecording] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [savePath, setSavePath] = useState("");
  const [lastOutput, setLastOutput] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canRecord = deviceAdapter?.supportsFeature("screenrecord") ?? false;

  useEffect(() => {
    setLastOutput(null);
    setError(null);
    if (recording) {
      setRecording(false);
      setStartTime(null);
      setElapsed(0);
    }
  }, [selectedDevice?.id]);

  useEffect(() => {
    if (savePath) {
      setError(null);
    }
  }, [savePath]);

  useEffect(() => {
    if (!recording || !startTime) {
      return;
    }

    const timer = window.setInterval(() => {
      const delta = Math.floor((Date.now() - startTime) / 1000);
      setElapsed(delta);
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [recording, startTime]);

  const durationText = useMemo(() => formatDuration(elapsed), [elapsed]);

  const handleSelectPath = useCallback(async () => {
    if (!isTauri) {
      setError("Tauri 环境不可用");
      return;
    }

    try {
      const dialog = await import("@tauri-apps/plugin-dialog");
      const selected = await dialog.save({
        filters: [{ name: "MP4", extensions: ["mp4"] }],
        defaultPath: `screenrecord_${Date.now()}.mp4`,
      });

      if (selected && typeof selected === "string") {
        setSavePath(selected);
      }
    } catch {
      setError("请确保已安装 @tauri-apps/plugin-dialog 插件，或手动输入保存路径");
    }
  }, [isTauri]);

  const handleStart = useCallback(async () => {
    if (!isTauri || !selectedDevice) {
      setError("请先选择设备");
      return;
    }

    if (!deviceAdapter || !deviceAdapter.supportsFeature("screenrecord")) {
      setError("当前平台暂不支持录屏功能");
      return;
    }

    setError(null);
    setLastOutput(null);

    try {
      await deviceAdapter.startScreenRecord(selectedDevice.id);
      setRecording(true);
      setStartTime(Date.now());
      setElapsed(0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "启动录屏失败");
    }
  }, [deviceAdapter, isTauri, selectedDevice]);

  const handleStop = useCallback(async () => {
    if (!isTauri || !selectedDevice) {
      setError("请先选择设备");
      return;
    }

    if (!deviceAdapter || !deviceAdapter.supportsFeature("screenrecord")) {
      setError("当前平台暂不支持录屏功能");
      return;
    }

    setError(null);

    try {
      const outputPath = savePath.trim() || null;
      const result = await deviceAdapter.stopScreenRecord(selectedDevice.id, outputPath);

      setLastOutput(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "停止录屏失败");
    } finally {
      setRecording(false);
      setStartTime(null);
    }
  }, [deviceAdapter, isTauri, selectedDevice, savePath]);

  const handleOpenFile = useCallback(async (filePath: string) => {
    if (!isTauri) return;

    try {
      const { open } = await import("@tauri-apps/plugin-shell");
      await open(filePath);
    } catch (e) {
      console.error("打开文件失败:", e);
    }
  }, [isTauri]);

  if (!isTauri) {
    return (
      <div className="flex h-full min-h-[400px] items-center justify-center">
        <div className="text-center">
          <Icon icon="mdi:cellphone-off" className="mx-auto mb-4 h-16 w-16 text-gray-400" />
          <h3 className="mb-2 text-lg font-semibold text-gray-900">Tauri 环境不可用</h3>
          <p className="text-sm text-gray-600">录屏功能需要在 Tauri 环境中运行</p>
        </div>
      </div>
    );
  }

  if (!selectedDevice) {
    return (
      <div className="flex h-full min-h-[400px] items-center justify-center">
        <div className="text-center">
          <Icon
            icon="mdi:cellphone-link-off"
            className="mx-auto mb-4 h-16 w-16 text-gray-400"
          />
          <h3 className="mb-2 text-lg font-semibold text-gray-900">未选择设备</h3>
          <p className="text-sm text-gray-600">请先在顶部选择要操作的设备</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col space-y-6 p-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">{descriptor.title || "录屏"}</h2>
        {descriptor.description && (
          <p className="mt-1 text-sm text-gray-600">{descriptor.description}</p>
        )}
        <p className="mt-2 text-xs text-gray-500">
          当前设备: <span className="font-mono">{selectedDevice.id}</span>
        </p>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6">
        {!canRecord && (
          <div className="mb-4 rounded-lg border border-yellow-200 bg-yellow-50 p-3">
            <div className="flex items-center gap-2 text-yellow-800">
              <Icon icon="mdi:alert" className="h-5 w-5" />
              <span className="text-sm font-medium">
                当前平台暂不支持录屏功能
              </span>
            </div>
          </div>
        )}
        <div className="mb-4">
          <label className="mb-2 block text-sm font-medium text-gray-700">
            保存路径（可选，留空则自动生成）
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={savePath}
              onChange={(e) => setSavePath(e.target.value)}
              placeholder="留空则保存到当前目录，文件名自动生成"
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
            />
            <button
              type="button"
              onClick={handleSelectPath}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              <Icon icon="mdi:folder-open" className="mr-2 inline h-4 w-4" />
              选择路径
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={handleStart}
            disabled={recording || !canRecord}
            className="flex-1 rounded-lg bg-primary-600 px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
          >
            <Icon icon="mdi:record-rec" className="mr-2 inline h-5 w-5" />
            开始录制
          </button>
          <button
            type="button"
            onClick={handleStop}
            disabled={!recording || !canRecord}
            className="flex-1 rounded-lg bg-red-600 px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-50"
          >
            <Icon icon="mdi:stop-circle" className="mr-2 inline h-5 w-5" />
            停止录制
          </button>
        </div>

        <div className="mt-4 rounded-lg border border-gray-100 bg-gray-50 p-4">
          <div className="flex items-center justify-between text-sm text-gray-700">
            <div className="flex items-center gap-2">
              <Icon
                icon={recording ? "mdi:record-circle" : "mdi:record-circle-outline"}
                className={`h-4 w-4 ${recording ? "text-red-500" : "text-gray-400"}`}
              />
              <span>{recording ? "录制中" : "未录制"}</span>
            </div>
            <span className="font-mono">{durationText}</span>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3">
            <div className="flex items-center gap-2 text-red-800">
              <Icon icon="mdi:alert-circle" className="h-5 w-5" />
              <span className="text-sm font-medium">{error}</span>
            </div>
          </div>
        )}

        {lastOutput && (
          <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-green-800">
                <Icon icon="mdi:check-circle" className="h-5 w-5" />
                <div>
                  <p className="text-sm font-medium">录屏已保存</p>
                  <p className="mt-1 text-xs text-green-700">
                    已保存到: <span className="font-mono">{lastOutput}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleOpenFile(lastOutput)}
                className="flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-green-700"
              >
                <Icon icon="mdi:open-in-new" className="h-4 w-4" />
                打开文件
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <h3 className="mb-2 text-sm font-semibold text-gray-900">使用说明</h3>
        <ul className="space-y-1 text-xs text-gray-600">
          <li className="flex items-start gap-2">
            <Icon icon="mdi:check-circle" className="mt-0.5 h-4 w-4 text-gray-400" />
            <span>点击“开始录制”后设备会弹出录屏状态提示</span>
          </li>
          <li className="flex items-start gap-2">
            <Icon icon="mdi:check-circle" className="mt-0.5 h-4 w-4 text-gray-400" />
            <span>点击“停止录制”后会自动拉取文件到本地</span>
          </li>
          <li className="flex items-start gap-2">
            <Icon icon="mdi:check-circle" className="mt-0.5 h-4 w-4 text-gray-400" />
            <span>默认保存为 MP4 文件，可自定义保存路径</span>
          </li>
        </ul>
      </div>
    </div>
  );
}

export const View = ScreenRecorderView;
