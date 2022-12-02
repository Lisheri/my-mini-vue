import { isObject } from '@mini-vue/shared';
import { UnwrapRef, Ref } from './ref';
import {
  mutableHandlers,
  readonlyHandlers,
  shallowReactiveHandlers,
  shallowReadonlyHandlers
} from './baseHandlers';

type UnwrapNestedRefs<T> = T extends Ref ? T : UnwrapRef<T>;

export const reactiveMap = new WeakMap<Target, any>();
export const readonlyMap = new WeakMap<Target, any>();

export const enum ReactiveFlags {
  // 不做响应式处理
  SKIP = '__v_skip',
  // 判断对象是否已经有对应的响应式对象, 此时target是原始对象
  IS_REACTIVE = '__v_isReactive',
  IS_READONLY = '__v_isReadonly',
  // 判断对象是不是一个响应式对象(Proxy对象), 此时target就是Proxy对象
  RAW = '__v_raw'
}

export interface Target {
  [ReactiveFlags.SKIP]?: boolean;
  [ReactiveFlags.IS_REACTIVE]?: boolean;
  [ReactiveFlags.IS_READONLY]?: boolean;
  [ReactiveFlags.RAW]?: any;
}

// 重载, 支持泛型
export function reactive<T extends object>(target: T): UnwrapNestedRefs<T>;
export function reactive(target: object) {
  // 不允许将readonly对象变为reactive响应式对象
  if (target && target[ReactiveFlags.IS_READONLY]) {
    return target;
  }
  return createReactiveObject(target, false, mutableHandlers);
}

type Primitive = string | number | boolean | bigint | symbol | undefined | null;
type Builtin = Primitive | Function | Date | Error | RegExp;
export type DeepReadonly<T> = T extends Builtin
  ? T
  : T extends Map<infer K, infer V>
  ? ReadonlyMap<DeepReadonly<K>, DeepReadonly<V>>
  : T extends ReadonlyMap<infer K, infer V>
  ? ReadonlyMap<DeepReadonly<K>, DeepReadonly<V>>
  : T extends WeakMap<infer K, infer V>
  ? WeakMap<DeepReadonly<K>, DeepReadonly<V>>
  : T extends Set<infer U>
  ? ReadonlySet<DeepReadonly<U>>
  : T extends ReadonlySet<infer U>
  ? ReadonlySet<DeepReadonly<U>>
  : T extends WeakSet<infer U>
  ? WeakSet<DeepReadonly<U>>
  : T extends Promise<infer U>
  ? Promise<DeepReadonly<U>>
  : T extends {}
  ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
  : Readonly<T>;

export function readonly<T extends object>(
  target: T
): DeepReadonly<UnwrapNestedRefs<T>> {
  return createReactiveObject(target, true, readonlyHandlers);
}

export function shallowReadonly<T extends object>(
  target: T
): Readonly<{ [K in keyof T]: UnwrapNestedRefs<T[K]> }> {
  return createReactiveObject(target, true, shallowReadonlyHandlers);
}

export function shallowReactive<T extends object>(target: T): T {
  return createReactiveObject(
    target,
    false,
    shallowReactiveHandlers
  )
}

function createReactiveObject(
  target: Target,
  // 是否只读
  isReadonly: boolean,
  // 基本reactive响应式对象的劫持属性
  baseHandlers
) {
  if (!isObject(target)) {
    console.warn(`当前值不能作为reactive响应式对象: ${String(target)}`);
    return target;
  }

  if (
    // __v_row 表示是一个响应式对象, 不允许reactive作用于一个reactive响应式对象
    target[ReactiveFlags.RAW] &&
    // __v_reactive表示这个对象已经被变成响应式过, 允许readonly作用于reactive响应式对象
    !(isReadonly && target[ReactiveFlags.IS_REACTIVE])
  ) {
    return target;
  }
  const proxyMap = isReadonly ? readonlyMap : reactiveMap;
  const existingProxy = proxyMap.get(target);
  if (existingProxy) {
    // target 已经有对应的 Proxy, 直接返回当前Proxy
    return existingProxy;
  }
  const proxy = new Proxy(target, baseHandlers);
  proxyMap.set(target, proxy);
  return proxy;
}

export function isReactive(value: unknown): boolean {
  if (isReadonly(value)) {
    // readonly对象应该继续判断reactive, 因为可以将reactive对象设置为readonly
    return isReactive((value as Target)[ReactiveFlags.RAW]);
  }
  return !!(value && (value as Target)[ReactiveFlags.IS_REACTIVE]);
}

export function isReadonly(value: unknown): boolean {
  return !!(value && (value as Target)[ReactiveFlags.IS_READONLY]);
}

export function isProxy(value: unknown): boolean {
  return isReactive(value) || isReadonly(value);
}

// 将响应式对象还原为原始对象
export function toRaw<T>(observed: T): T {
  return (
    // 这里递归一次, 来看 observed 是否是一个响应式对象, 非响应式对象没有 __v_raw属性, 该属性指向原对象
    (observed && toRaw((observed as Target)[ReactiveFlags.RAW])) || observed
  );
}
