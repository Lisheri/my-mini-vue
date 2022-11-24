import { callWithAsyncErrorHandling } from '@mini-vue/runtime-core';
import { isArray } from '@mini-vue/shared';
import { ErrorCodes } from 'packages/runtime-core/src/errorHandling';
import { e } from 'vitest/dist/index-2f5b6168';
type EventValue = Function | Function[];
interface Invoker extends EventListener {
  value: EventValue; // 事件函数
  attached: number; // 添加时间
}

let _getNow: () => number = Date.now;

if (
  typeof document !== 'undefined' &&
  _getNow() > document.createEvent('Event').timeStamp
) {
  // 浏览器允许使用高精度时间戳则使用高精度时间戳, 避免系统时间和浏览器事件循环时间不一致导致的判断错误
  _getNow = () => performance.now();
}

// 避免重复调用performance.now带来的开销, 这里使用缓存, 事件循环一次在更新一次
let cachedNow: number = 0;
const p = Promise.resolve();
const reset = () => {
  cachedNow = 0;
};
const getNow = () => cachedNow || (p.then(reset), (cachedNow = _getNow()));

export const addEventListener = (
  el: Element,
  event: string,
  handler: EventListener
) => {
  el.addEventListener(event, handler);
};

export const removeEventListener = (
  el: Element,
  event: string,
  handler: EventListener
) => {
  el.removeEventListener(event, handler);
}

export function patchEvent(
  el: Element & { _vei?: Record<string, Invoker | undefined> },
  rawName: string,
  nextValue: EventValue
) {
  // 事件缓存, vei, vue event invokers
  const invokers = el._vei || (el._vei = {});
  // 已经存在的事件
  const existingInvoker = invokers[rawName];
  if (nextValue && existingInvoker) {
    // 直接替换value即可, 这里是个浅拷贝, el._vei[rawName]和existingInvokers指向一致
    existingInvoker.value = nextValue;
  } else {
    // 新增
    if (nextValue) {
      // 添加
      const invoker = (invokers[rawName] = createInvoker(nextValue));
      addEventListener(el, rawName, invoker);
    } else if (existingInvoker) {
      // 移除
      removeEventListener(el, rawName, existingInvoker);
      invokers[rawName] = undefined;
    }
  }
}

function createInvoker(initialValue: EventValue) {
  const invoker = (e) => {
    // 这里需要防止patch期间重复触发事件回调, 由于浏览器事件循环期间会触发微任务
    // 这里暂存一个时间戳, 并且仅当激活事件被patch过后才触发事件回调
    const timeStamp = e.timeStamp || _getNow();
    if (timeStamp >= invoker.attached - 1) {
      callWithAsyncErrorHandling(
        patchStopImmediatePropagation(e, invoker.value),
        ErrorCodes.NATIVE_EVENT_HANDLER,
        [e]
      );
    }
  };
  invoker.value = initialValue; // 为了能随时更改 value 值
  invoker.attached = getNow(); // 带缓存的attached时间
  return invoker;
}

function patchStopImmediatePropagation(
  e: Event,
  value: EventValue
): EventValue {
  if (isArray(value)) {
    const originalStop = e.stopImmediatePropagation;
    e.stopImmediatePropagation = () => {
      // 防止this指向出错
      originalStop.call(e);
      // 防止重复触发, 这里上锁
      (e as any)._stopped = true;
    };
    return value.map((fn) => (e: Event) => !(e as any)._stopped && fn(e));
  }
  return value;
}
