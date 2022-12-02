import { ComponentPublicInstance } from "./componentPublicInstance";

const resolvedPromise: Promise<any> = Promise.resolve();
// 存储当前正在执行的 flush Promise
let currentFlushPromise: Promise<void> | null = null;

export function nextTick(
  this: ComponentPublicInstance | void,
  fn?: () => void
): Promise<void> {
  const p = currentFlushPromise || resolvedPromise;
  return fn ? p.then(this ? fn.bind(this) : fn) : p;
}