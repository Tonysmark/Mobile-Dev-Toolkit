import { useEffect, useState } from "react";
import type { CoreKernel, ModuleId } from "../core";
import {
  EventNames,
  type ModuleDeactivatedPayload,
  type ModuleActivatedPayload,
} from "../core";

type ModuleManagerSnapshot = {
  activeExclusiveModuleId: ModuleId | null;
  activeModuleIds: ModuleId[];
};

const emptySnapshot: ModuleManagerSnapshot = {
  activeExclusiveModuleId: null,
  activeModuleIds: [],
};

export function useModuleManagerSnapshot(
  kernel: CoreKernel,
): ModuleManagerSnapshot {
  const eventBus = kernel.getEventBus();

  const [snapshot, setSnapshot] = useState<ModuleManagerSnapshot>(() => {
    const modules = kernel.getSnapshot().modules;
    return {
      activeExclusiveModuleId: modules.activeExclusiveModuleId,
      activeModuleIds: modules.activeModuleIds,
    };
  });

  useEffect(() => {
    // 初始化时读取一次状态
    const initial = kernel.getSnapshot().modules;
    setSnapshot({
      activeExclusiveModuleId: initial.activeExclusiveModuleId,
      activeModuleIds: initial.activeModuleIds,
    });

    // 订阅模块激活事件，实时更新状态
    const unsubscribeActivated = eventBus.on<ModuleActivatedPayload>(
      EventNames.ModuleActivated,
      (payload) => {
        setSnapshot({
          activeExclusiveModuleId: payload.activeExclusiveModuleId,
          activeModuleIds: payload.activeModuleIds,
        });
      },
    );

    const unsubscribeDeactivated = eventBus.on<ModuleDeactivatedPayload>(
      EventNames.ModuleDeactivated,
      (payload) => {
        setSnapshot({
          activeExclusiveModuleId: payload.activeExclusiveModuleId,
          activeModuleIds: payload.activeModuleIds,
        });
      },
    );

    // 订阅模块就绪事件，确保初始化完成后状态同步
    const unsubscribeReady = eventBus.on(EventNames.ModulesReady, () => {
      const next = kernel.getSnapshot().modules;
      setSnapshot({
        activeExclusiveModuleId: next.activeExclusiveModuleId,
        activeModuleIds: next.activeModuleIds,
      });
    });

    // 清理订阅
    return () => {
      unsubscribeActivated();
      unsubscribeDeactivated();
      unsubscribeReady();
    };
  }, [eventBus, kernel]);

  return snapshot;
}
