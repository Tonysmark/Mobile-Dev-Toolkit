import { useCallback, useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import type { ModuleUIDescriptor } from "../../core";
import { useDeviceContext } from "../../ui/device";

type CertificateManagerViewProps = {
  descriptor: ModuleUIDescriptor;
};

export const viewId = "certificate-manager";

const defaultRemoteDir = "/sdcard/Download";

function getFileName(path: string) {
  const normalized = path.replace(/\\/g, "/");
  const parts = normalized.split("/");
  return parts[parts.length - 1] || "charles.cer";
}

export function CertificateManagerView({ descriptor }: CertificateManagerViewProps) {
  const { selectedDevice, isTauri, deviceAdapter } = useDeviceContext();
  const [certPath, setCertPath] = useState("");
  const [remoteDir, setRemoteDir] = useState(defaultRemoteDir);
  const [remotePath, setRemotePath] = useState<string | null>(null);
  const [installOpened, setInstallOpened] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canPush = deviceAdapter?.supportsFeature("push-certificate") ?? false;
  const canOpenInstaller =
    deviceAdapter?.supportsFeature("open-certificate-installer") ?? false;

  const fileName = useMemo(() => (certPath ? getFileName(certPath) : ""), [certPath]);

  const handlePickCert = useCallback(async () => {
    if (!isTauri) {
      setError("Tauri 环境不可用");
      return;
    }

    try {
      const dialog = await import("@tauri-apps/plugin-dialog");
      const selected = await dialog.open({
        multiple: false,
        filters: [{ name: "证书文件", extensions: ["cer", "crt", "pem"] }],
      });
      if (selected && typeof selected === "string") {
        setCertPath(selected);
        setRemotePath(null);
        setInstallOpened(false);
      }
    } catch {
      setError("请确保已安装 @tauri-apps/plugin-dialog 插件");
    }
  }, [isTauri]);

  const handlePushCert = useCallback(async () => {
    if (!isTauri || !selectedDevice) {
      setError("请先选择设备");
      return;
    }

    if (!deviceAdapter || !deviceAdapter.supportsFeature("push-certificate")) {
      setError("当前平台暂不支持证书导入");
      return;
    }

    if (!certPath) {
      setError("请选择证书文件");
      return;
    }

    setWorking(true);
    setError(null);

    try {
      const result = await deviceAdapter.pushCertificate(
        selectedDevice.id,
        certPath,
        remoteDir.trim() || defaultRemoteDir,
      );
      setRemotePath(result);
      setInstallOpened(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "推送证书失败");
    } finally {
      setWorking(false);
    }
  }, [certPath, deviceAdapter, isTauri, remoteDir, selectedDevice]);

  const handleOpenInstaller = useCallback(async () => {
    if (!isTauri || !selectedDevice) {
      setError("请先选择设备");
      return;
    }

    if (!deviceAdapter || !deviceAdapter.supportsFeature("open-certificate-installer")) {
      setError("当前平台暂不支持证书安装向导");
      return;
    }

    if (!remotePath) {
      setError("请先推送证书到设备");
      return;
    }

    setWorking(true);
    setError(null);

    try {
      await deviceAdapter.openCertificateInstaller(selectedDevice.id, remotePath);
      setInstallOpened(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "打开安装向导失败");
    } finally {
      setWorking(false);
    }
  }, [deviceAdapter, isTauri, remotePath, selectedDevice]);

  if (!isTauri) {
    return (
      <div className="flex h-full min-h-[400px] items-center justify-center">
        <div className="text-center">
          <Icon icon="mdi:cellphone-off" className="mx-auto mb-4 h-16 w-16 text-gray-400" />
          <h3 className="mb-2 text-lg font-semibold text-gray-900">Tauri 环境不可用</h3>
          <p className="text-sm text-gray-600">证书管理功能需要在 Tauri 环境中运行</p>
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
          {descriptor.title || "证书管理"}
        </h2>
        {descriptor.description && (
          <p className="mt-1 text-sm text-gray-600">{descriptor.description}</p>
        )}
        <p className="mt-2 text-xs text-gray-500">
          当前设备: <span className="font-mono">{selectedDevice.id}</span>
        </p>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <h3 className="mb-3 text-sm font-semibold text-gray-900">Charles 证书导入向导</h3>
        {(!canPush || !canOpenInstaller) && (
          <div className="mb-3 rounded-lg border border-yellow-200 bg-yellow-50 p-3">
            <div className="flex items-center gap-2 text-yellow-800">
              <Icon icon="mdi:alert" className="h-5 w-5" />
              <span className="text-sm font-medium">
                当前平台暂不支持完整证书导入流程
              </span>
            </div>
          </div>
        )}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={certPath}
              onChange={(e) => {
                setCertPath(e.target.value);
                setRemotePath(null);
                setInstallOpened(false);
                setError(null);
              }}
              placeholder="选择 .cer/.crt 证书文件"
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
            />
            <button
              type="button"
              onClick={handlePickCert}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              选择证书
            </button>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={remoteDir}
              onChange={(e) => {
                setRemoteDir(e.target.value);
                setError(null);
              }}
              placeholder="设备目录（默认 /sdcard/Download）"
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
            />
            <span className="text-xs text-gray-500">{fileName && `文件名: ${fileName}`}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handlePushCert}
              disabled={working || !canPush}
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
            >
              推送证书到设备
            </button>
            <button
              type="button"
              onClick={handleOpenInstaller}
              disabled={working || !remotePath || !canOpenInstaller}
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
            >
              打开安装向导
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <h4 className="mb-2 text-sm font-semibold text-gray-900">证书状态</h4>
        <ul className="space-y-2 text-xs text-gray-600">
          <li className="flex items-center gap-2">
            <Icon
              icon={certPath ? "mdi:check-circle" : "mdi:circle-outline"}
              className={`h-4 w-4 ${certPath ? "text-green-500" : "text-gray-400"}`}
            />
            已选择证书文件
          </li>
          <li className="flex items-center gap-2">
            <Icon
              icon={remotePath ? "mdi:check-circle" : "mdi:circle-outline"}
              className={`h-4 w-4 ${remotePath ? "text-green-500" : "text-gray-400"}`}
            />
            已推送到设备
          </li>
          <li className="flex items-center gap-2">
            <Icon
              icon={installOpened ? "mdi:check-circle" : "mdi:circle-outline"}
              className={`h-4 w-4 ${installOpened ? "text-green-500" : "text-gray-400"}`}
            />
            已打开安装向导（需在设备上确认）
          </li>
        </ul>
        {remotePath && (
          <p className="mt-2 text-xs text-gray-500">
            证书路径: <span className="font-mono">{remotePath}</span>
          </p>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
          <div className="flex items-center gap-2 text-red-800">
            <Icon icon="mdi:alert-circle" className="h-5 w-5" />
            <span className="text-sm font-medium">{error}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export const View = CertificateManagerView;
