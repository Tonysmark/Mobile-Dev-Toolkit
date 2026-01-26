/**
 * 主应用组件
 * 负责在组件挂载时启动核心内核的引导流程
 */
import { useEffect, useState } from "react";
import { bootstrap, getKernel } from "./app/bootstrap";
import { DeviceProvider } from "./ui/device";
import { KernelUI } from "./ui/KernelUI";

export default function App() {
  const [booted, setBooted] = useState(false);

  // 组件挂载时执行系统引导
  useEffect(() => {
    let active = true;
    void bootstrap().then(() => {
      if (active) {
        setBooted(true);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  if (!booted) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-gray-600">系统启动中...</div>
      </div>
    );
  }

  // UI 仅通过 CoreKernel 公共接口访问系统状态
  return (
    <DeviceProvider kernel={getKernel()}>
      <KernelUI kernel={getKernel()} />
    </DeviceProvider>
  );
}
