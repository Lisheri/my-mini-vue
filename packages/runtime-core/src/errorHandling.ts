import { LifecycleHooks } from "./component";
// 标识当前执行的用户输入函数
export const enum ErrorCodes {
  SETUP_FUNCTION,
  RENDER_FUNCTION,
  WATCH_GETTER,
  WATCH_CALLBACK,
  WATCH_CLEANUP,
  NATIVE_EVENT_HANDLER,
  COMPONENT_EVENT_HANDLER,
  VNODE_HOOK,
  FUNCTION_REF
}

// 错误产生的函数位置
export const ErrorTypeStrings: Record<string | number, string> = {
  [ErrorCodes.SETUP_FUNCTION]: 'setup function',
  [ErrorCodes.RENDER_FUNCTION]: 'render function',
  [ErrorCodes.WATCH_GETTER]: 'watcher getter',
  [ErrorCodes.WATCH_CALLBACK]: 'watch callback',
  [ErrorCodes.WATCH_CLEANUP]: 'watch cleanup function',
  [ErrorCodes.NATIVE_EVENT_HANDLER]: 'native event handler',
  [ErrorCodes.COMPONENT_EVENT_HANDLER]: 'component event handler',
  [ErrorCodes.VNODE_HOOK]: 'vnode hook',
  [ErrorCodes.FUNCTION_REF]: 'ref function',
  [LifecycleHooks.BEFORE_CREATE]: 'beforeCreate hook',
  [LifecycleHooks.CREATED]: 'created hook',
  [LifecycleHooks.BEFORE_MOUNT]: 'beforeMount hook',
  [LifecycleHooks.MOUNTED]: 'mounted hook',
  [LifecycleHooks.BEFORE_UPDATE]: 'beforeUpdate hook',
  [LifecycleHooks.UPDATED]: 'updated',
  [LifecycleHooks.BEFORE_UNMOUNT]: 'beforeUnmount hook',
  [LifecycleHooks.UNMOUNTED]: 'unmounted hook',
  [LifecycleHooks.ACTIVATED]: 'activated hook',
  [LifecycleHooks.DEACTIVATED]: 'deactivated hook',
  [LifecycleHooks.ERROR_CAPTURED]: 'errorCaptured hook',
  [LifecycleHooks.RENDER_TRACKED]: 'renderTracked hook',
  [LifecycleHooks.RENDER_TRIGGERED]: 'renderTriggered hook',
};

export type ErrorTypes = LifecycleHooks | ErrorCodes;

/**
 * 
 * @param fn 原始函数
 * @param instance 当前组件实例
 * @param type 执行的函数类型(可能出错的位置)
 * @param args 函数执行的参数
 */
export function callWithErrorHandling(
  fn: Function,
  type: ErrorTypes,
  args: unknown[] = []
) {
  let res;
  try {
    res = args.length ? fn(...args) : fn()
  } catch (err) {
    // 处理错误
    // console.error(`${ErrorTypeStrings[type]}: ${err}`)
    handleError(type, err);
  }
  return res;
}
// 单独抛错
export const handleError = (type, err) => {
  console.error(`${ErrorTypeStrings[type]}: ${err}`)
}
