/**
 * 事件总线
 * 提供发布-订阅模式的事件系统，用于模块间解耦通信
 */

export type EventHandler<T = unknown> = (payload: T) => void;

/**
 * 事件总线类
 * 管理事件的注册、注销和触发
 */
export class EventBus {
  // 存储所有事件监听器，以事件名称为键
  private readonly listeners = new Map<string, Set<EventHandler<unknown>>>();

  /**
   * 订阅事件
   * @param event 事件名称
   * @param handler 事件处理函数
   * @returns 取消订阅的函数
   */
  on<T = unknown>(event: string, handler: EventHandler<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler as EventHandler<unknown>);

    // 返回取消订阅的函数
    return () => {
      this.off(event, handler as EventHandler<unknown>);
    };
  }

  /**
   * 取消订阅事件
   * @param event 事件名称
   * @param handler 事件处理函数
   */
  off(event: string, handler: EventHandler<unknown>): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.delete(handler);
      // 如果该事件没有监听器了，删除该事件
      if (handlers.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  /**
   * 触发事件
   * @param event 事件名称
   * @param payload 事件负载数据
   */
  emit<T = unknown>(event: string, payload?: T): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      // 复制 handlers 集合，避免在执行过程中修改原集合导致的问题
      const handlersCopy = new Set(handlers);
      handlersCopy.forEach((handler) => {
        try {
          handler(payload as unknown);
        } catch (error) {
          // 捕获处理函数中的错误，避免影响其他监听器
          console.error(`Error in event handler for "${event}":`, error);
        }
      });
    }
  }

  /**
   * 清除所有事件监听器
   */
  clear(): void {
    this.listeners.clear();
  }

  /**
   * 获取指定事件的监听器数量
   * @param event 事件名称
   * @returns 监听器数量
   */
  listenerCount(event: string): number {
    return this.listeners.get(event)?.size ?? 0;
  }
}
