import { useState, useCallback, useEffect } from "react";
import { Icon } from "@iconify/react";
import type { ModuleUIDescriptor } from "../../core";
import { useDeviceContext } from "../../ui/device";

type ScreenshotViewProps = {
  descriptor: ModuleUIDescriptor;
};

export const viewId = "screenshot";

export function ScreenshotView({ descriptor }: ScreenshotViewProps) {
  const { selectedDevice, isTauri, deviceAdapter } = useDeviceContext();
  const [capturing, setCapturing] = useState(false);
  const [lastScreenshot, setLastScreenshot] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savePath, setSavePath] = useState<string>("");
  const canScreenshot = deviceAdapter?.supportsFeature("screenshot") ?? false;

  useEffect(() => {
    setLastScreenshot(null);
    setError(null);
  }, [selectedDevice?.id]);

  useEffect(() => {
    if (savePath) {
      setError(null);
    }
  }, [savePath]);

  /** 执行截图 */
  const handleScreenshot = useCallback(async () => {
    if (!isTauri || !selectedDevice) {
      setError("请先选择设备");
      return;
    }

    if (!deviceAdapter || !deviceAdapter.supportsFeature("screenshot")) {
      setError("当前平台暂不支持截图功能");
      return;
    }

    setCapturing(true);
    setError(null);
    setLastScreenshot(null);

    try {
      const outputPath = savePath.trim() || null;
      const result = await deviceAdapter.screenshot(selectedDevice.id, outputPath);

      setLastScreenshot(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "截图失败");
    } finally {
      setCapturing(false);
    }
  }, [deviceAdapter, isTauri, selectedDevice, savePath]);

  /** 选择保存路径 */
  const handleSelectPath = useCallback(async () => {
    if (!isTauri) {
      setError("Tauri 环境不可用");
      return;
    }

    try {
      // 尝试使用 Tauri dialog API
      try {
        const dialog = await import("@tauri-apps/plugin-dialog");
        const selected = await dialog.save({
          filters: [{ name: "PNG", extensions: ["png"] }],
          defaultPath: `screenshot_${Date.now()}.png`,
        });

        if (selected && typeof selected === "string") {
          setSavePath(selected);
        }
      } catch {
        // 如果 dialog 插件不可用，提示用户手动输入
        setError("请确保已安装 @tauri-apps/plugin-dialog 插件，或手动输入保存路径");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "选择路径失败");
    }
  }, [isTauri]);

  /** 打开截图文件 */
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
          <Icon
            icon="mdi:cellphone-off"
            className="mx-auto mb-4 h-16 w-16 text-gray-400"
          />
          <h3 className="mb-2 text-lg font-semibold text-gray-900">
            Tauri 环境不可用
          </h3>
          <p className="text-sm text-gray-600">
            截图功能需要在 Tauri 环境中运行
          </p>
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
          <h3 className="mb-2 text-lg font-semibold text-gray-900">
            未选择设备
          </h3>
          <p className="text-sm text-gray-600">
            请先在顶部选择要操作的设备
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col space-y-6 p-6">
      {/* 标题 */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900">
          {descriptor.title || "截图"}
        </h2>
        {descriptor.description && (
          <p className="mt-1 text-sm text-gray-600">
            {descriptor.description}
          </p>
        )}
        <p className="mt-2 text-xs text-gray-500">
          当前设备: <span className="font-mono">{selectedDevice.id}</span>
        </p>
      </div>

      {/* 截图操作区域 */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        {!canScreenshot && (
          <div className="mb-4 rounded-lg border border-yellow-200 bg-yellow-50 p-3">
            <div className="flex items-center gap-2 text-yellow-800">
              <Icon icon="mdi:alert" className="h-5 w-5" />
              <span className="text-sm font-medium">
                当前平台暂不支持截图功能
              </span>
            </div>
          </div>
        )}
        <div className="mb-4">
          <label className="mb-2 block text-sm font-medium text-gray-700">
            保存路径（可选，留空则使用默认路径）
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

        <button
          type="button"
          onClick={handleScreenshot}
          disabled={capturing || !canScreenshot}
          className="w-full rounded-lg bg-primary-600 px-6 py-4 text-base font-semibold text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
        >
          {capturing ? (
            <>
              <Icon icon="mdi:loading" className="mr-2 inline h-5 w-5 animate-spin" />
              截图中...
            </>
          ) : (
            <>
              <Icon icon="mdi:camera" className="mr-2 inline h-5 w-5" />
              一键截图
            </>
          )}
        </button>

        {/* 错误提示 */}
        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3">
            <div className="flex items-center gap-2 text-red-800">
              <Icon icon="mdi:alert-circle" className="h-5 w-5" />
              <span className="text-sm font-medium">{error}</span>
            </div>
          </div>
        )}

        {/* 成功提示 */}
        {lastScreenshot && (
          <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-green-800">
                <Icon icon="mdi:check-circle" className="h-5 w-5" />
                <div>
                  <p className="text-sm font-medium">截图成功！</p>
                  <p className="mt-1 text-xs text-green-700">
                    已保存到: <span className="font-mono">{lastScreenshot}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleOpenFile(lastScreenshot)}
                className="flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-green-700"
              >
                <Icon icon="mdi:open-in-new" className="h-4 w-4" />
                打开文件
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 使用说明 */}
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <h3 className="mb-2 text-sm font-semibold text-gray-900">使用说明</h3>
        <ul className="space-y-1 text-xs text-gray-600">
          <li className="flex items-start gap-2">
            <Icon icon="mdi:check-circle" className="mt-0.5 h-4 w-4 text-gray-400" />
            <span>点击"一键截图"按钮即可快速截图</span>
          </li>
          <li className="flex items-start gap-2">
            <Icon icon="mdi:check-circle" className="mt-0.5 h-4 w-4 text-gray-400" />
            <span>如果不指定保存路径，截图将保存到当前工作目录</span>
          </li>
          <li className="flex items-start gap-2">
            <Icon icon="mdi:check-circle" className="mt-0.5 h-4 w-4 text-gray-400" />
            <span>截图文件格式为 PNG</span>
          </li>
        </ul>
      </div>
    </div>
  );
}

export const View = ScreenshotView;
