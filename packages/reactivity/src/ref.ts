import { track, trigger } from './effect';
import { TriggerOpTypes } from './operations';
import { reactive, toRaw, isReactive } from './reactive';
import { isArray, isObject, hasChanged } from '@mini-vue/shared';
import { CollectionTypes } from './collectionHandlers';

declare const RefSymbol: unique symbol;

export interface Ref<T = any> {
  value: T;
  /**
   * Type differentiator only.
   * We need this to be in public d.ts but don't want it to show up in IDE
   * autocomplete, so we use a private Symbol instead.
   */
  [RefSymbol]: true;
  /**
   * @internal
   */
  _shallow?: boolean;
}

export interface RefUnwrapBailTypes {}

export type ShallowUnwrapRef<T> = {
  [K in keyof T]: T[K] extends Ref<infer V> ? V : T[K];
};

// 基本类型
type BaseTypes = string | number | boolean;

export type UnwrapRef<T> = T extends Ref<infer V>
  ? UnwrapRefSimple<V>
  : UnwrapRefSimple<T>;

type UnwrapRefSimple<T> = T extends
  | Function
  | CollectionTypes
  | BaseTypes
  | Ref
  | RefUnwrapBailTypes[keyof RefUnwrapBailTypes]
  ? T
  : T extends Array<any>
  ? { [K in keyof T]: UnwrapRefSimple<T[K]> }
  : T extends object
  ? UnwrappedObject<T>
  : T;

// 从一个对象中提取所有的symbol, 包含所有已知的symbol
type SymbolExtract<T> = (T extends { [Symbol.asyncIterator]: infer V }
  ? { [Symbol.asyncIterator]: V }
  : {}) &
  (T extends { [Symbol.hasInstance]: infer V }
    ? { [Symbol.hasInstance]: V }
    : {}) &
  (T extends { [Symbol.isConcatSpreadable]: infer V }
    ? { [Symbol.isConcatSpreadable]: V }
    : {}) &
  (T extends { [Symbol.iterator]: infer V } ? { [Symbol.iterator]: V } : {}) &
  (T extends { [Symbol.match]: infer V } ? { [Symbol.match]: V } : {}) &
  (T extends { [Symbol.matchAll]: infer V } ? { [Symbol.matchAll]: V } : {}) &
  (T extends { [Symbol.replace]: infer V } ? { [Symbol.replace]: V } : {}) &
  (T extends { [Symbol.search]: infer V } ? { [Symbol.search]: V } : {}) &
  (T extends { [Symbol.species]: infer V } ? { [Symbol.species]: V } : {}) &
  (T extends { [Symbol.split]: infer V } ? { [Symbol.split]: V } : {}) &
  (T extends { [Symbol.toPrimitive]: infer V }
    ? { [Symbol.toPrimitive]: V }
    : {}) &
  (T extends { [Symbol.toStringTag]: infer V }
    ? { [Symbol.toStringTag]: V }
    : {}) &
  (T extends { [Symbol.unscopables]: infer V }
    ? { [Symbol.unscopables]: V }
    : {});

type UnwrappedObject<T> = {
  [P in keyof T]: UnwrapRef<T[P]>;
} & SymbolExtract<T>;

export type ToRef<T> = [T] extends [Ref] ? T : Ref<UnwrapRef<T>>;
export type ToRefs<T = any> = {
  // #2687: somehow using ToRef<T[K]> here turns the resulting type into
  // a union of multiple Ref<*> types instead of a single Ref<* | *> type.
  [K in keyof T]: T[K] extends Ref ? T[K] : Ref<UnwrapRef<T[K]>>;
};

const convert = <T extends unknown>(val: T): T => {
  return isObject(val) ? reactive(val) : val;
};

// 判断是否为ref
export function isRef<T>(r: Ref<T> | unknown): r is Ref<T>;
export function isRef(r: any): r is Ref {
  return Boolean(r && r.__v_isRef === true);
}

// 解除ref
export function unRef<T>(ref: T): T extends Ref<infer V> ? V : T {
  return isRef(ref) ? (ref.value as any) : ref;
}

const shallowUnwrapHandlers: ProxyHandler<any> = {
  // get需解ref
  get: (target, key, receiver) => unRef(Reflect.get(target, key, receiver)),
  set: (target, key, value, receiver) => {
    const oldValue: any = target[key];
    if (isRef(oldValue) && !isRef(value)) {
      // 旧的值是一个ref响应式变量, 则触发一次旧的ref响应式变量的set即可
      oldValue.value = value;
      return true
    } else {
      // 普通值则调用Reflect.set赋值
      return Reflect.set(target, key, value, receiver);
    }
  }
}
// 模板中代理ref, 无需使用.value访问
export function proxyRefs<T extends object>(objectWithRefs: T): ShallowUnwrapRef<T> {
  // 代理访问ref, reactive对象自带get和set, 无需重复添加
  return isReactive(objectWithRefs) ? objectWithRefs : new Proxy(objectWithRefs, shallowUnwrapHandlers);
}

// ref类
class RefImpl<T> {
  public _value: T;

  // 标识是否为ref响应式变量
  public readonly __v_isRef = true;

  constructor(private _rawValue: T, public readonly _shallow = false) {
    // 如果是引用类型则需要使用reactive变为响应式对象
    this._value = convert(_rawValue);
  }

  get value() {
    // 依赖收集
    // ? 这里需要将当前实例变为原始对象进行操作, 因为targetMap的键是原始对象
    track(toRaw(this), 'value');
    return this._value;
  }
  set value(newVal) {
    // * 没变化就不用更新了
    if (hasChanged(toRaw(this._value), newVal)) {
      // 派发更新
      this._rawValue = newVal;
      // _value是响应式对象值, 需经过convert处理
      this._value = convert(newVal);
      // trigger派发更新
      trigger(toRaw(this), TriggerOpTypes.SET, 'value', newVal);
    }
  }
}

// 重载支持不同类型参数
export function ref<T extends object>(value: T): ToRef<T>;
export function ref<T>(value: T): Ref<UnwrapRef<T>>;
export function ref<T = any>(): Ref<T | undefined>;
export function ref(value?: unknown) {
  return createRef(value);
}

function createRef(rawValue: unknown, shallow = false) {
  if (isRef(rawValue)) {
    // 如果已经是ref对象了, 无需重复操作
    return rawValue;
  }
  // 返回ref对象
  return new RefImpl(rawValue, shallow);
}
