import { useState, useCallback, useEffect } from "react";
import { Icon } from "@iconify/react";
import type { ModuleUIDescriptor } from "../../core";
import { useDeviceContext } from "../../ui/device";

type AppManagerViewProps = {
  descriptor: ModuleUIDescriptor;
};

type InstallResult = {
  success: boolean;
  message: string;
};

export const viewId = "app-manager";

export function AppManagerView({ descriptor }: AppManagerViewProps) {
  const { selectedDevice, isTauri, deviceAdapter } = useDeviceContext();
  const [installing, setInstalling] = useState(false);
  const [uninstalling, setUninstalling] = useState(false);
  const [loadingPackages, setLoadingPackages] = useState(false);
  const [packages, setPackages] = useState<string[]>([]);
  const [installResult, setInstallResult] = useState<InstallResult | null>(null);
  const [uninstallResult, setUninstallResult] = useState<string | null>(null);
  const [packageToUninstall, setPackageToUninstall] = useState("");
  const [dragActive, setDragActive] = useState(false);

  const canInstall = deviceAdapter?.supportsFeature("install-app") ?? false;
  const canUninstall = deviceAdapter?.supportsFeature("uninstall-app") ?? false;
  const canListPackages = deviceAdapter?.supportsFeature("list-packages") ?? false;

  /** 加载已安装的包列表 */
  const loadPackages = useCallback(async () => {
    if (!isTauri || !selectedDevice) {
      return;
    }

    if (!deviceAdapter || !canListPackages) {
      setPackages([]);
      return;
    }

    setLoadingPackages(true);

    try {
      const result = await deviceAdapter.listPackages(selectedDevice.id);
      setPackages(result.sort());
    } catch (e) {
      console.error("加载包列表失败:", e);
    } finally {
      setLoadingPackages(false);
    }
  }, [canListPackages, deviceAdapter, isTauri, selectedDevice]);

  /** 安装APK */
  const handleInstall = useCallback(
    async (filePath: string) => {
      if (!isTauri || !selectedDevice) {
        setInstallResult({
          success: false,
          message: "请先选择设备",
        });
        return;
      }

      if (!deviceAdapter || !canInstall) {
        setInstallResult({
          success: false,
          message: "当前平台暂不支持应用安装",
        });
        return;
      }

      setInstalling(true);
      setInstallResult(null);

      try {
        const result = await deviceAdapter.installApp(selectedDevice.id, filePath);

        setInstallResult({
          success: true,
          message: result,
        });
        if (canListPackages) {
          await loadPackages();
        }
      } catch (e) {
        setInstallResult({
          success: false,
          message: e instanceof Error ? e.message : "安装失败",
        });
      } finally {
        setInstalling(false);
      }
    },
    [canInstall, canListPackages, deviceAdapter, isTauri, loadPackages, selectedDevice],
  );

  /** 处理文件选择 */
  const handleFileSelect = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;

      const file = files[0];
      if (!file.name.endsWith(".apk")) {
        setInstallResult({
          success: false,
          message: "请选择 .apk 文件",
        });
        return;
      }

      if (!isTauri) {
        setInstallResult({
          success: false,
          message: "Tauri 环境不可用",
        });
        return;
      }

      // 使用 Tauri dialog 选择文件
      try {
        const { open } = await import("@tauri-apps/plugin-dialog");
        const selected = await open({
          filters: [{ name: "APK", extensions: ["apk"] }],
          multiple: false,
        });

        if (selected && typeof selected === "string") {
          await handleInstall(selected);
        }
      } catch (e) {
        // 如果 dialog 不可用，尝试使用文件输入
        setInstallResult({
          success: false,
          message: "请使用文件选择按钮选择 APK 文件",
        });
      }
    },
    [isTauri, handleInstall],
  );

  /** 使用文件选择对话框 */
  const handleSelectFile = useCallback(async () => {
    if (!isTauri) {
      setInstallResult({
        success: false,
        message: "Tauri 环境不可用",
      });
      return;
    }

    try {
      // 尝试使用 Tauri dialog API
      let filePath: string | null = null;
      
      try {
        const dialog = await import("@tauri-apps/plugin-dialog");
        const selected = await dialog.open({
          filters: [{ name: "APK", extensions: ["apk"] }],
          multiple: false,
        });
        if (selected && typeof selected === "string") {
          filePath = selected;
        }
      } catch {
        // 如果 dialog 插件不可用，提示用户手动输入路径
        // 或者使用其他方式
        setInstallResult({
          success: false,
          message: "请确保已安装 @tauri-apps/plugin-dialog 插件，或使用命令行安装APK",
        });
        return;
      }

      if (filePath) {
        await handleInstall(filePath);
      }
    } catch (e) {
      setInstallResult({
        success: false,
        message: e instanceof Error ? e.message : "选择文件失败",
      });
    }
  }, [isTauri, handleInstall]);

  /** 处理拖拽 */
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        if (file.name.endsWith(".apk")) {
          const filePath = (file as File & { path?: string }).path;
          if (filePath) {
            await handleInstall(filePath);
          } else {
            setInstallResult({
              success: false,
              message: "当前环境无法读取拖拽文件路径，请使用选择文件按钮",
            });
          }
        } else {
          setInstallResult({
            success: false,
            message: "请选择 .apk 文件",
          });
        }
      }
    },
    [handleInstall],
  );

  /** 卸载应用 */
  const handleUninstall = useCallback(async () => {
    if (!isTauri || !selectedDevice || !packageToUninstall.trim()) {
      setUninstallResult("请先选择设备和输入包名");
      return;
    }

    if (!deviceAdapter || !canUninstall) {
      setUninstallResult("当前平台暂不支持应用卸载");
      return;
    }

    setUninstalling(true);
    setUninstallResult(null);

    try {
      const result = await deviceAdapter.uninstallApp(
        selectedDevice.id,
        packageToUninstall.trim(),
      );

      setUninstallResult(`卸载成功: ${result}`);
      setPackageToUninstall("");
      // 刷新包列表
      if (packages.length > 0) {
        await loadPackages();
      }
    } catch (e) {
      setUninstallResult(
        `卸载失败: ${e instanceof Error ? e.message : "未知错误"}`,
      );
    } finally {
      setUninstalling(false);
    }
  }, [canUninstall, deviceAdapter, isTauri, selectedDevice, packageToUninstall, packages.length]);

  useEffect(() => {
    if (canListPackages && selectedDevice && isTauri) {
      void loadPackages();
    }
  }, [canListPackages, isTauri, loadPackages, selectedDevice]);

  useEffect(() => {
    setPackages([]);
    setPackageToUninstall("");
    setInstallResult(null);
    setUninstallResult(null);
  }, [selectedDevice?.id]);

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
            应用管理功能需要在 Tauri 环境中运行
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
          {descriptor.title || "应用管理"}
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

      {/* 安装APK区域 */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold text-gray-900">安装应用</h3>

        {/* 拖拽上传区域 */}
        <div
          className={`mb-4 rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
            dragActive
              ? "border-primary-500 bg-primary-50"
              : "border-gray-300 bg-gray-50"
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <Icon
            icon="mdi:cloud-upload"
            className="mx-auto mb-3 h-12 w-12 text-gray-400"
          />
          <p className="mb-2 text-sm font-medium text-gray-700">
            拖拽 APK 文件到此处
          </p>
          <p className="mb-4 text-xs text-gray-500">或</p>
          <button
            type="button"
            onClick={handleSelectFile}
            disabled={installing || !canInstall}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
          >
            {installing ? (
              <>
                <Icon icon="mdi:loading" className="mr-2 inline h-4 w-4 animate-spin" />
                安装中...
              </>
            ) : (
              <>
                <Icon icon="mdi:file-upload" className="mr-2 inline h-4 w-4" />
                选择 APK 文件
              </>
            )}
          </button>
        </div>

        {/* 安装结果 */}
        {installResult && (
          <div
            className={`rounded-lg border p-3 ${
              installResult.success
                ? "border-green-200 bg-green-50"
                : "border-red-200 bg-red-50"
            }`}
          >
            <div
              className={`flex items-center gap-2 ${
                installResult.success ? "text-green-800" : "text-red-800"
              }`}
            >
              <Icon
                icon={
                  installResult.success
                    ? "mdi:check-circle"
                    : "mdi:alert-circle"
                }
                className="h-5 w-5"
              />
              <span className="text-sm font-medium">{installResult.message}</span>
            </div>
          </div>
        )}
      </div>

      {/* 卸载应用区域 */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold text-gray-900">卸载应用</h3>

        <div className="flex gap-2">
          <input
            type="text"
            value={packageToUninstall}
            onChange={(e) => {
              setPackageToUninstall(e.target.value);
              setUninstallResult(null);
            }}
            placeholder="输入应用包名（如：com.example.app）"
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
          />
          <button
            type="button"
            onClick={handleUninstall}
            disabled={uninstalling || !packageToUninstall.trim() || !canUninstall}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
          >
            {uninstalling ? (
              <>
                <Icon icon="mdi:loading" className="mr-2 inline h-4 w-4 animate-spin" />
                卸载中...
              </>
            ) : (
              <>
                <Icon icon="mdi:delete" className="mr-2 inline h-4 w-4" />
                卸载
              </>
            )}
          </button>
        </div>

        {/* 卸载结果 */}
        {uninstallResult && (
          <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
            <p className="text-sm text-gray-700">{uninstallResult}</p>
          </div>
        )}

        {/* 已安装应用列表 */}
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-xs font-medium text-gray-700">已安装应用</h4>
            <button
              type="button"
              onClick={loadPackages}
              disabled={loadingPackages}
              className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900 disabled:opacity-50"
            >
              <Icon
                icon={loadingPackages ? "mdi:loading" : "mdi:refresh"}
                className={`h-3 w-3 ${loadingPackages ? "animate-spin" : ""}`}
              />
              刷新列表
            </button>
          </div>

          {!canListPackages ? (
            <p className="py-4 text-center text-xs text-gray-500">
              当前平台暂不支持应用列表
            </p>
          ) : loadingPackages ? (
            <div className="flex items-center justify-center py-4">
              <Icon
                icon="mdi:loading"
                className="h-5 w-5 animate-spin text-gray-400"
              />
            </div>
          ) : packages.length > 0 ? (
            <div className="max-h-64 space-y-1 overflow-y-auto rounded border border-gray-200 bg-gray-50 p-2">
              {packages.map((pkg) => (
                <button
                  key={pkg}
                  type="button"
                  onClick={() => setPackageToUninstall(pkg)}
                  className="block w-full rounded px-2 py-1 text-left text-xs font-mono text-gray-700 hover:bg-gray-200"
                >
                  {pkg}
                </button>
              ))}
            </div>
          ) : (
            <p className="py-4 text-center text-xs text-gray-500">
              点击"刷新列表"加载已安装的应用
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export const View = AppManagerView;
