import { useEffect, useState } from "react";
import type { CoreKernel, EventBus, ModuleId, ModuleManager } from "../core";

type ModuleManagerSnapshot = {
  activeExclusiveModuleId: ModuleId | null;
  activeModuleIds: ModuleId[];
};

const emptySnapshot: ModuleManagerSnapshot = {
  activeExclusiveModuleId: null,
  activeModuleIds: [],
};

function readSnapshot(manager?: ModuleManager): ModuleManagerSnapshot {
  if (!manager) {
    return emptySnapshot;
  }
  return {
    activeExclusiveModuleId: manager.getActiveModuleId(),
    activeModuleIds: manager.getActiveModuleIds(),
  };
}

type ModuleActivatedPayload = {
  moduleId: ModuleId;
  activationMode: string;
  activeExclusiveModuleId: ModuleId | null;
  activeModuleIds: ModuleId[];
};

export function useModuleManagerSnapshot(
  kernel: CoreKernel,
): ModuleManagerSnapshot {
  const manager = kernel.getModuleManager();
  const eventBus = kernel.getEventBus();

  const [snapshot, setSnapshot] = useState<ModuleManagerSnapshot>(() =>
    readSnapshot(manager),
  );

  useEffect(() => {
    if (!manager) {
      setSnapshot(emptySnapshot);
      return;
    }

    // 初始化时读取一次状态
    setSnapshot(readSnapshot(manager));

    // 订阅模块激活事件，实时更新状态
    const unsubscribe = eventBus.on<ModuleActivatedPayload>(
      "module:activated",
      (payload) => {
        setSnapshot({
          activeExclusiveModuleId: payload.activeExclusiveModuleId,
          activeModuleIds: payload.activeModuleIds,
        });
      },
    );

    // 订阅模块就绪事件，确保初始化完成后状态同步
    const unsubscribeReady = eventBus.on("modules:ready", () => {
      setSnapshot(readSnapshot(manager));
    });

    // 清理订阅
    return () => {
      unsubscribe();
      unsubscribeReady();
    };
  }, [manager, eventBus]);

  return snapshot;
}
