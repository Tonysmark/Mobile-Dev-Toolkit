import { useCallback, useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import type { ModuleUIDescriptor } from "../../core";
import { useDeviceContext } from "../../ui/device";

type FileExplorerViewProps = {
  descriptor: ModuleUIDescriptor;
};

export const viewId = "file-explorer";

const quickDirs = [
  { label: "下载", path: "/sdcard/Download" },
  { label: "相机", path: "/sdcard/DCIM" },
  { label: "图片", path: "/sdcard/Pictures" },
  { label: "视频", path: "/sdcard/Movies" },
  { label: "文档", path: "/sdcard/Documents" },
];

function getFileName(path: string) {
  const normalized = path.replace(/\\/g, "/");
  const parts = normalized.split("/");
  return parts[parts.length - 1] || "file";
}

function joinPath(base: string, fileName: string) {
  return `${base.replace(/\/+$/, "")}/${fileName}`;
}

export function FileExplorerView({ descriptor }: FileExplorerViewProps) {
  const { selectedDevice, isTauri, deviceAdapter } = useDeviceContext();
  const [deviceDir, setDeviceDir] = useState("/sdcard/Download");
  const [deviceFilePath, setDeviceFilePath] = useState("");
  const [localFilePath, setLocalFilePath] = useState("");
  const [localDirPath, setLocalDirPath] = useState("");
  const [transfering, setTransfering] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canImport = deviceAdapter?.supportsFeature("push-file") ?? false;
  const canExport = deviceAdapter?.supportsFeature("pull-file") ?? false;

  const resolvedImportPath = useMemo(() => {
    if (!localFilePath) return "";
    return joinPath(deviceDir, getFileName(localFilePath));
  }, [deviceDir, localFilePath]);

  const resolvedExportPath = useMemo(() => {
    if (!localDirPath || !deviceFilePath) return "";
    return joinPath(localDirPath, getFileName(deviceFilePath));
  }, [localDirPath, deviceFilePath]);

  const handlePickLocalFile = useCallback(async () => {
    if (!isTauri) {
      setError("Tauri 环境不可用");
      return;
    }

    try {
      const dialog = await import("@tauri-apps/plugin-dialog");
      const selected = await dialog.open({ multiple: false });
      if (selected && typeof selected === "string") {
        setLocalFilePath(selected);
        setError(null);
        setResult(null);
      }
    } catch {
      setError("请确保已安装 @tauri-apps/plugin-dialog 插件");
    }
  }, [isTauri]);

  const handlePickLocalDir = useCallback(async () => {
    if (!isTauri) {
      setError("Tauri 环境不可用");
      return;
    }

    try {
      const dialog = await import("@tauri-apps/plugin-dialog");
      const selected = await dialog.open({ directory: true });
      if (selected && typeof selected === "string") {
        setLocalDirPath(selected);
        setError(null);
        setResult(null);
      }
    } catch {
      setError("请确保已安装 @tauri-apps/plugin-dialog 插件");
    }
  }, [isTauri]);

  const handleImport = useCallback(async () => {
    if (!isTauri || !selectedDevice) {
      setError("请先选择设备");
      return;
    }

    if (!deviceAdapter || !deviceAdapter.supportsFeature("push-file")) {
      setError("当前平台暂不支持文件导入");
      return;
    }

    if (!localFilePath) {
      setError("请先选择本地文件");
      return;
    }

    setError(null);
    setResult(null);
    setTransfering(true);

    try {
      const remotePath = resolvedImportPath || joinPath(deviceDir, getFileName(localFilePath));
      await deviceAdapter.pushFile(selectedDevice.id, localFilePath, remotePath);
      setResult(`导入成功：${remotePath}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "导入失败");
    } finally {
      setTransfering(false);
    }
  }, [deviceAdapter, deviceDir, isTauri, localFilePath, resolvedImportPath, selectedDevice]);

  const handleExport = useCallback(async () => {
    if (!isTauri || !selectedDevice) {
      setError("请先选择设备");
      return;
    }

    if (!deviceAdapter || !deviceAdapter.supportsFeature("pull-file")) {
      setError("当前平台暂不支持文件导出");
      return;
    }

    if (!deviceFilePath.trim()) {
      setError("请输入设备文件路径");
      return;
    }

    if (!localDirPath) {
      setError("请选择本地保存目录");
      return;
    }

    setError(null);
    setResult(null);
    setTransfering(true);

    try {
      const localPath = resolvedExportPath || joinPath(localDirPath, getFileName(deviceFilePath));
      await deviceAdapter.pullFile(selectedDevice.id, deviceFilePath.trim(), localPath);
      setResult(`导出成功：${localPath}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "导出失败");
    } finally {
      setTransfering(false);
    }
  }, [deviceAdapter, deviceFilePath, isTauri, localDirPath, resolvedExportPath, selectedDevice]);

  if (!isTauri) {
    return (
      <div className="flex h-full min-h-[400px] items-center justify-center">
        <div className="text-center">
          <Icon icon="mdi:cellphone-off" className="mx-auto mb-4 h-16 w-16 text-gray-400" />
          <h3 className="mb-2 text-lg font-semibold text-gray-900">Tauri 环境不可用</h3>
          <p className="text-sm text-gray-600">文件管理功能需要在 Tauri 环境中运行</p>
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
        <h2 className="text-xl font-semibold text-gray-900">
          {descriptor.title || "文件管理"}
        </h2>
        {descriptor.description && (
          <p className="mt-1 text-sm text-gray-600">{descriptor.description}</p>
        )}
        <p className="mt-2 text-xs text-gray-500">
          当前设备: <span className="font-mono">{selectedDevice.id}</span>
        </p>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <h3 className="mb-3 text-sm font-semibold text-gray-900">常用目录</h3>
        <div className="flex flex-wrap gap-2">
          {quickDirs.map((dir) => (
            <button
              key={dir.path}
              type="button"
              onClick={() => {
                setDeviceDir(dir.path);
                setError(null);
                setResult(null);
              }}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                deviceDir === dir.path
                  ? "border-primary-500 bg-primary-50 text-primary-700"
                  : "border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {dir.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <h3 className="mb-3 text-sm font-semibold text-gray-900">导入文件到设备</h3>
        {!canImport && (
          <div className="mb-3 rounded-lg border border-yellow-200 bg-yellow-50 p-3">
            <div className="flex items-center gap-2 text-yellow-800">
              <Icon icon="mdi:alert" className="h-5 w-5" />
              <span className="text-sm font-medium">
                当前平台暂不支持文件导入
              </span>
            </div>
          </div>
        )}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={localFilePath}
              onChange={(e) => {
                setLocalFilePath(e.target.value);
                setError(null);
                setResult(null);
              }}
              placeholder="选择本地文件"
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
            />
            <button
              type="button"
              onClick={handlePickLocalFile}
              disabled={!canImport}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              选择文件
            </button>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={deviceDir}
              onChange={(e) => {
                setDeviceDir(e.target.value);
                setError(null);
                setResult(null);
              }}
              placeholder="设备目录（例如 /sdcard/Download）"
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
            />
            <span className="text-xs text-gray-500">
              目标: {resolvedImportPath || "未选择"}
            </span>
          </div>
          <button
            type="button"
            onClick={handleImport}
            disabled={transfering || !canImport}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
          >
            {transfering ? "导入中..." : "导入到设备"}
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <h3 className="mb-3 text-sm font-semibold text-gray-900">从设备导出文件</h3>
        {!canExport && (
          <div className="mb-3 rounded-lg border border-yellow-200 bg-yellow-50 p-3">
            <div className="flex items-center gap-2 text-yellow-800">
              <Icon icon="mdi:alert" className="h-5 w-5" />
              <span className="text-sm font-medium">
                当前平台暂不支持文件导出
              </span>
            </div>
          </div>
        )}
        <div className="space-y-3">
          <input
            type="text"
            value={deviceFilePath}
            onChange={(e) => {
              setDeviceFilePath(e.target.value);
              setError(null);
              setResult(null);
            }}
            placeholder="设备文件路径（例如 /sdcard/Download/demo.txt）"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
          />
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={localDirPath}
              onChange={(e) => {
                setLocalDirPath(e.target.value);
                setError(null);
                setResult(null);
              }}
              placeholder="选择本地保存目录"
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
            />
            <button
              type="button"
              onClick={handlePickLocalDir}
              disabled={!canExport}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              选择目录
            </button>
          </div>
          <p className="text-xs text-gray-500">
            目标: {resolvedExportPath || "未选择"}
          </p>
          <button
            type="button"
            onClick={handleExport}
            disabled={transfering || !canExport}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
          >
            {transfering ? "导出中..." : "导出到本地"}
          </button>
        </div>
      </div>

      {(error || result) && (
        <div
          className={`rounded-lg border p-3 ${
            error ? "border-red-200 bg-red-50" : "border-green-200 bg-green-50"
          }`}
        >
          <div
            className={`flex items-center gap-2 ${
              error ? "text-red-800" : "text-green-800"
            }`}
          >
            <Icon icon={error ? "mdi:alert-circle" : "mdi:check-circle"} className="h-5 w-5" />
            <span className="text-sm font-medium">{error || result}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export const View = FileExplorerView;
