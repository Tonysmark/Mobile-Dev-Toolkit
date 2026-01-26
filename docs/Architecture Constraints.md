# Architecture Constraints

This document defines **non-negotiable architectural rules** for the Real Device Development Assistant Tool.

Its purpose is to:

* Protect long-term extensibility
* Prevent core–UI coupling
* Ensure modules remain pluggable, testable, and replaceable

These rules must be followed by **all future code generation (Cursor or human)**.

---

## 1. Core Principles

### 1.1 Kernel-Centric Architecture

* `CoreKernel` is the single coordinator of the system.
* All modules and adapters are owned, initialized, and disposed by the kernel.
* No code outside `core/` may control system lifecycle.

---

## 2. Module System Constraints

### 2.1 Module Independence

* Modules **must not directly import or depend on other modules**.
* Inter-module communication is allowed **only via**:

  * Event emission
  * Adapters provided by `ModuleContext`

Direct method calls or shared state between modules are forbidden.

---

### 2.2 Module Identity

* Every module must have a **globally unique ID**.
* ID format is mandatory:

```
<namespace>.<category>.<name>
```

Examples:

* `device.android.install`
* `device.ios.profile`
* `tool.json.formatter`

Module IDs are immutable once published.

---

### 2.3 Module Activation Model

Each module must explicitly declare its activation behavior via its manifest.

Supported activation modes:

* `exclusive`

  * Only one module of this type may be active at a time
  * Used for main workspace modules

* `parallel`

  * Multiple modules may be active simultaneously
  * Used for utility tools

* `background`

  * Activated at system startup and remains active
  * Used for listeners, logging, or device monitoring

Activation rules are enforced by `ModuleManager`.

---

### 2.4 Conditional Availability

Modules may declare runtime availability constraints.

* A module **must not assume** platform or device availability.
* A module may expose an optional enablement predicate.

This enables:

* Platform-specific modules (Android / iOS / Harmony)
* Device-dependent features

---

## 3. UI Boundary Rules (Critical)

### 3.1 UI Is Optional for Modules

* A module **may** expose UI capability.
* A module **may** be completely headless.

UI exposure is declarative, not imperative.

---

### 3.2 UI Declaration, Not Control

* Modules may declare **what** UI they provide.
* Modules must never control:

  * Layout
  * Navigation
  * Window management

The UI layer decides **where and how** module UI is rendered.

---

### 3.3 Core and Module Layers Must Not Import UI Frameworks

* `core/` must never import React, Vue, or any UI framework.
* Modules must not directly render UI into the application root.

UI frameworks are confined strictly to the application/UI layer.

---

## 4. ModuleContext Constraints

### 4.1 Allowed Responsibilities

`ModuleContext` may expose only:

* Adapter access (`getAdapter`)
* Event emission or subscription
* System-level capabilities

---

### 4.2 Forbidden Responsibilities

`ModuleContext` must never expose:

* Application state
* Global stores
* Routing or navigation
* Direct DOM or window access

This prevents `ModuleContext` from becoming a God Object.

---

## 5. Adapter System Constraints

### 5.1 Ownership and Lifecycle

* Adapters are **owned by the kernel**.
* Adapters are initialized and disposed by the system lifecycle.
* Modules may only **request** adapters via `ModuleContext`.

Modules must never:

* Instantiate adapters directly
* Manage adapter lifecycle

---

### 5.2 Platform Abstraction

All platform-specific logic (Android / iOS / Harmony) must live inside adapters.

Modules must remain platform-agnostic.

---

## 6. Explicit Non-Goals (Important)

The following are intentionally **out of scope** at this stage:

* Plugin marketplace
* Hot module download or updates
* Permission management system
* User-level configuration UI

These concerns may be addressed in future phases only after the core stabilizes.

---

## 7. Enforcement

* All new modules must comply with this document.
* Any code generation must be reviewed against these constraints.
* When in doubt, **prefer removing capability over adding abstraction**.

This document takes precedence over convenience.
