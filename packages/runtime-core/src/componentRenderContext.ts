import { ComponentInternalInstance } from './component';

export let currentRenderingInstance: ComponentInternalInstance | null = null;

export function setCurrentRenderingInstance(
  instance: ComponentInternalInstance | null
): void {
  currentRenderingInstance = instance;
}

/**
 * 包裹一个渲染函数用于缓存当前实例
 */
export function withCtx(
  fn: Function,
  ctx: ComponentInternalInstance | null = currentRenderingInstance
) {
  if (!ctx) return fn;
  const renderFnWithContext = (...args: any[]) => {
    const prevInstance = currentRenderingInstance;
    setCurrentRenderingInstance(ctx);
    const res = fn(...args);
    setCurrentRenderingInstance(prevInstance);
    return res;
  };
  // 用于设置渲染插槽标识
  renderFnWithContext._c = true;
  return renderFnWithContext;
}
