import { useState } from "react";
import { Icon } from "@iconify/react";
import type { ModuleUIDescriptor } from "../../core";

type JsonFormatterViewProps = {
  descriptor: ModuleUIDescriptor;
};

export const viewId = "json-formatter";

export function JsonFormatterView({ descriptor }: JsonFormatterViewProps) {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [indent, setIndent] = useState(2);

  const formatJson = () => {
    try {
      setError(null);
      if (!input.trim()) {
        setOutput("");
        return;
      }

      const parsed = JSON.parse(input);
      const formatted = JSON.stringify(parsed, null, indent);
      setOutput(formatted);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : "无效的 JSON";
      setError(errorMessage);
      setOutput("");
    }
  };

  const minifyJson = () => {
    try {
      setError(null);
      if (!input.trim()) {
        setOutput("");
        return;
      }

      const parsed = JSON.parse(input);
      const minified = JSON.stringify(parsed);
      setOutput(minified);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : "无效的 JSON";
      setError(errorMessage);
      setOutput("");
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      console.error("复制失败:", e);
    }
  };

  const clearAll = () => {
    setInput("");
    setOutput("");
    setError(null);
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="mb-2 text-lg font-semibold text-gray-900">
          {descriptor.title || "JSON 格式化"}
        </h2>
        {descriptor.description && (
          <p className="text-sm text-gray-600">{descriptor.description}</p>
        )}
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <label htmlFor="indent" className="text-sm text-gray-700">
            缩进：
          </label>
          <select
            id="indent"
            value={indent}
            onChange={(e) => setIndent(Number(e.target.value))}
            className="rounded border border-gray-300 px-2 py-1 text-sm"
          >
            <option value={2}>2 空格</option>
            <option value={4}>4 空格</option>
            <option value={0}>无缩进</option>
          </select>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={formatJson}
            className="flex items-center gap-1 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700"
          >
            <Icon icon="mdi:code-json" className="h-4 w-4" />
            格式化
          </button>
          <button
            type="button"
            onClick={minifyJson}
            className="flex items-center gap-1 rounded-lg bg-gray-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700"
          >
            <Icon icon="mdi:code-braces" className="h-4 w-4" />
            压缩
          </button>
          <button
            type="button"
            onClick={clearAll}
            className="flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            <Icon icon="mdi:delete-outline" className="h-4 w-4" />
            清空
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
          <div className="flex items-center gap-2 text-red-800">
            <Icon icon="mdi:alert-circle" className="h-5 w-5" />
            <span className="font-medium">错误：{error}</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">输入</label>
            <button
              type="button"
              onClick={() => copyToClipboard(input)}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
            >
              <Icon icon="mdi:content-copy" className="h-3 w-3" />
              复制
            </button>
          </div>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="粘贴或输入 JSON 数据..."
            className="h-96 w-full rounded-lg border border-gray-300 p-3 font-mono text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
          />
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">输出</label>
            <button
              type="button"
              onClick={() => copyToClipboard(output)}
              disabled={!output}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 disabled:opacity-50"
            >
              <Icon icon="mdi:content-copy" className="h-3 w-3" />
              复制
            </button>
          </div>
          <textarea
            value={output}
            readOnly
            placeholder="格式化后的 JSON 将显示在这里..."
            className="h-96 w-full rounded-lg border border-gray-300 bg-gray-50 p-3 font-mono text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
          />
        </div>
      </div>
    </div>
  );
}

export const View = JsonFormatterView;
