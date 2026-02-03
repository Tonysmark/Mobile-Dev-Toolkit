export const EventNames = {
  AdaptersInitialized: "adapters:initialized",
  AdaptersDisposed: "adapters:disposed",
  ModulesReady: "modules:ready",
  ModuleActivated: "module:activated",
  ModuleDeactivated: "module:deactivated",
  ModulesDeactivated: "modules:deactivated",
} as const;

export type EventName = `${string}:${string}`;

export const EVENT_NAME_PATTERN =
  /^[a-z][a-z0-9-]*(\.[a-z0-9-]+)*:[a-z][a-z0-9-]*(\.[a-z0-9-]+)*$/;

export function isValidEventName(event: string): boolean {
  return EVENT_NAME_PATTERN.test(event);
}

export function assertEventName(event: string): asserts event is EventName {
  if (!isValidEventName(event)) {
    throw new Error(
      `Invalid event name "${event}". Expected "domain:action" in lowercase.`,
    );
  }
}

export type ModuleActivatedPayload = {
  moduleId: import("../modules/types").ModuleId;
  activationMode: import("../modules/types").ModuleActivationMode;
  activeExclusiveModuleId: import("../modules/types").ModuleId | null;
  activeModuleIds: import("../modules/types").ModuleId[];
};

export type ModuleDeactivatedPayload = {
  moduleId: import("../modules/types").ModuleId;
  activeExclusiveModuleId: import("../modules/types").ModuleId | null;
  activeModuleIds: import("../modules/types").ModuleId[];
};
