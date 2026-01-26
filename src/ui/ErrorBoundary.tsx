import { Component, type ReactNode } from "react";
import { Icon } from "@iconify/react";

type ErrorBoundaryProps = {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
  error: Error | null;
};

/**
 * React Error Boundary
 * 捕获模块渲染异常，防止单个模块的错误导致整个应用崩溃
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // 可以在这里记录错误到日志服务
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
    });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error!, this.handleReset);
      }

      // 默认错误 UI
      return (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6">
          <div className="mb-4 flex items-center gap-2 text-red-800">
            <Icon icon="mdi:alert-circle" className="h-6 w-6" />
            <h3 className="text-lg font-semibold">模块加载失败</h3>
          </div>
          <div className="mb-4 text-sm text-red-700">
            <p className="mb-2">
              模块渲染时发生错误，请检查模块实现或联系开发者。
            </p>
            {this.state.error && (
              <details className="mt-2">
                <summary className="cursor-pointer font-medium">
                  错误详情
                </summary>
                <pre className="mt-2 overflow-auto rounded bg-red-100 p-2 text-xs">
                  {this.state.error.toString()}
                  {this.state.error.stack && (
                    <>
                      {"\n\n"}
                      {this.state.error.stack}
                    </>
                  )}
                </pre>
              </details>
            )}
          </div>
          <button
            type="button"
            onClick={this.handleReset}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
          >
            重试
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
