/**
 * 应用程序入口点
 * 初始化 React 根节点并渲染主应用组件
 */
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";

const container = document.getElementById("root");
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
