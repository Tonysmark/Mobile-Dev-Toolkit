import { useState } from "react";
import { Icon } from "@iconify/react";
import type { ModuleUIDescriptor } from "../../core";

type Base64CodecViewProps = {
  descriptor: ModuleUIDescriptor;
};

export const viewId = "base64-codec";

export function Base64CodecView({ descriptor }: Base64CodecViewProps) {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"encode" | "decode">("encode");

  const encode = () => {
    try {
      setError(null);
      if (!input.trim()) {
        setOutput("");
        return;
      }

      const encoded = btoa(unescape(encodeURIComponent(input)));
      setOutput(encoded);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : "编码失败";
      setError(errorMessage);
      setOutput("");
    }
  };

  const decode = () => {
    try {
      setError(null);
      if (!input.trim()) {
        setOutput("");
        return;
      }

      const decoded = decodeURIComponent(escape(atob(input)));
      setOutput(decoded);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : "解码失败：无效的 Base64 字符串";
      setError(errorMessage);
      setOutput("");
    }
  };

  const handleModeChange = (newMode: "encode" | "decode") => {
    setMode(newMode);
    setError(null);
    // 切换模式时，交换输入输出
    if (output && !error) {
      setInput(output);
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
          {descriptor.title || "Base64 编解码"}
        </h2>
        {descriptor.description && (
          <p className="text-sm text-gray-600">{descriptor.description}</p>
        )}
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-700">模式：</label>
          <div className="flex rounded-lg border border-gray-300">
            <button
              type="button"
              onClick={() => handleModeChange("encode")}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                mode === "encode"
                  ? "bg-primary-600 text-white"
                  : "bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              编码
            </button>
            <button
              type="button"
              onClick={() => handleModeChange("decode")}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                mode === "decode"
                  ? "bg-primary-600 text-white"
                  : "bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              解码
            </button>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={mode === "encode" ? encode : decode}
            className="flex items-center gap-1 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700"
          >
            <Icon
              icon={mode === "encode" ? "mdi:arrow-down" : "mdi:arrow-up"}
              className="h-4 w-4"
            />
            {mode === "encode" ? "编码" : "解码"}
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
            <label className="text-sm font-medium text-gray-700">
              {mode === "encode" ? "原始文本" : "Base64 字符串"}
            </label>
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
            placeholder={
              mode === "encode"
                ? "输入要编码的文本..."
                : "输入要解码的 Base64 字符串..."
            }
            className="h-96 w-full rounded-lg border border-gray-300 p-3 font-mono text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
          />
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">
              {mode === "encode" ? "Base64 字符串" : "解码文本"}
            </label>
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
            placeholder={
              mode === "encode"
                ? "编码后的 Base64 将显示在这里..."
                : "解码后的文本将显示在这里..."
            }
            className="h-96 w-full rounded-lg border border-gray-300 bg-gray-50 p-3 font-mono text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
          />
        </div>
      </div>
    </div>
  );
}

export const View = Base64CodecView;
