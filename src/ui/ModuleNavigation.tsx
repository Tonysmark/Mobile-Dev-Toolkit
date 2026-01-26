import { useState, useMemo } from "react";
import { Icon } from "@iconify/react";
import type { ModuleId, ModuleManifest } from "../core";

// 按分类分组模块
function groupByCategory(manifests: ModuleManifest[]): Map<string, ModuleManifest[]> {
  const grouped = new Map<string, ModuleManifest[]>();
  
  for (const manifest of manifests) {
    const category = manifest.category || "其他";
    if (!grouped.has(category)) {
      grouped.set(category, []);
    }
    grouped.get(category)!.push(manifest);
  }
  
  return grouped;
}

type ModuleNavigationProps = {
  manifests: ModuleManifest[];
  activeModuleId: ModuleId | null;
  onActivate: (moduleId: ModuleId) => void;
};

// 根据模块分类或名称返回对应的图标
function getModuleIcon(manifest: ModuleManifest): string {
  // 优先使用清单中定义的图标
  if (manifest.icon) {
    return manifest.icon;
  }

  // Fallback 逻辑
  const id = manifest.id.toLowerCase();
  if (id.includes("device")) return "mdi:cellphone-link";
  if (id.includes("app")) return "mdi:application";
  if (id.includes("screenshot")) return "mdi:camera";
  if (id.includes("recorder") || id.includes("record")) return "mdi:record-rec";
  if (id.includes("file")) return "mdi:folder";
  if (id.includes("certificate") || id.includes("cert")) return "mdi:certificate";
  if (id.includes("json")) return "mdi:code-json";
  if (id.includes("base64") || id.includes("encode")) return "mdi:code-braces";
  if (id.includes("timestamp") || id.includes("time")) return "mdi:clock-outline";
  return "mdi:puzzle";
}

// 高亮匹配文本
function highlightText(text: string, query: string): React.ReactNode {
  if (!query) return text;

  const parts = text.split(new RegExp(`(${query})`, "gi"));
  return parts.map((part, index) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <mark key={index} className="bg-yellow-200">
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

export function ModuleNavigation({
  manifests,
  activeModuleId,
  onActivate,
}: ModuleNavigationProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(),
  );

  // 过滤模块
  const filteredManifests = useMemo(() => {
    if (!searchQuery.trim()) {
      return manifests;
    }

    const query = searchQuery.toLowerCase();
    return manifests.filter(
      (manifest) =>
        manifest.name.toLowerCase().includes(query) ||
        manifest.id.toLowerCase().includes(query) ||
        manifest.category?.toLowerCase().includes(query),
    );
  }, [manifests, searchQuery]);

  // 按分类分组（仅在非搜索模式下）
  const groupedManifests = useMemo(() => {
    if (searchQuery.trim()) {
      return null; // 搜索模式下不分组
    }
    return groupByCategory(filteredManifests);
  }, [filteredManifests, searchQuery]);

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  return (
    <nav
      className="w-64 border-r border-gray-200 bg-white p-4"
      aria-label="模块导航"
    >
      <div className="mb-4 flex items-center gap-2">
        <Icon icon="mdi:view-grid" className="h-5 w-5 text-gray-600" />
        <h2 className="text-sm font-semibold text-gray-900">模块</h2>
      </div>

      {/* 搜索框 */}
      <div className="mb-4">
        <div className="relative">
          <Icon
            icon="mdi:magnify"
            className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索模块..."
            className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-8 pr-3 text-sm placeholder-gray-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <Icon icon="mdi:close-circle" className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* 模块列表 */}
      {filteredManifests.length === 0 ? (
        <div className="py-8 text-center text-sm text-gray-500">
          <Icon icon="mdi:magnify" className="mx-auto mb-2 h-8 w-8 text-gray-300" />
          <p>未找到匹配的模块</p>
        </div>
      ) : groupedManifests ? (
        // 分类折叠模式
        <div className="space-y-2">
          {Array.from(groupedManifests.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([category, categoryManifests]) => {
              const isExpanded = expandedCategories.has(category);
              return (
                <div key={category} className="space-y-1">
                  <button
                    type="button"
                    onClick={() => toggleCategory(category)}
                    className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs font-semibold text-gray-600 hover:bg-gray-50"
                  >
                    <span>{category}</span>
                    <Icon
                      icon={
                        isExpanded ? "mdi:chevron-down" : "mdi:chevron-right"
                      }
                      className="h-4 w-4"
                    />
                  </button>
                  {isExpanded && (
                    <ul className="ml-2 space-y-1 border-l border-gray-200 pl-2">
                      {categoryManifests.map((manifest) => {
                        const isActive = manifest.id === activeModuleId;
                        return (
                          <li key={manifest.id}>
                            <button
                              type="button"
                              onClick={() => onActivate(manifest.id)}
                              className={`w-full rounded-lg px-3 py-2.5 text-left transition-colors ${
                                isActive
                                  ? "bg-primary-50 text-primary-700 shadow-sm"
                                  : "text-gray-700 hover:bg-gray-50"
                              }`}
                            >
                              <div className="flex items-center gap-2.5">
                                <Icon
                                  icon={getModuleIcon(manifest)}
                                  className={`h-5 w-5 flex-shrink-0 ${
                                    isActive
                                      ? "text-primary-600"
                                      : "text-gray-400"
                                  }`}
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium">
                                    {manifest.name}
                                  </div>
                                  <div className="truncate text-xs text-gray-500">
                                    {manifest.id}
                                  </div>
                                </div>
                              </div>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            })}
        </div>
      ) : (
        // 搜索模式：平铺显示
        <ul className="space-y-1">
          {filteredManifests.map((manifest) => {
            const isActive = manifest.id === activeModuleId;
            return (
              <li key={manifest.id}>
                <button
                  type="button"
                  onClick={() => onActivate(manifest.id)}
                  className={`w-full rounded-lg px-3 py-2.5 text-left transition-colors ${
                    isActive
                      ? "bg-primary-50 text-primary-700 shadow-sm"
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon
                      icon={getModuleIcon(manifest)}
                      className={`h-5 w-5 flex-shrink-0 ${
                        isActive ? "text-primary-600" : "text-gray-400"
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">
                        {highlightText(manifest.name, searchQuery)}
                      </div>
                      <div className="truncate text-xs text-gray-500">
                        {highlightText(manifest.id, searchQuery)}
                      </div>
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </nav>
  );
}
