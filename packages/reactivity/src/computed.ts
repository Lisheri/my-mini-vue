import { ReactiveEffect, effect, trigger, track } from './effect';
import { Ref } from './ref';
import { ReactiveFlags, toRaw } from './reactive';
import { TriggerOpTypes } from './operations';
import { isFunction, NOOP } from '@mini-vue/shared';

export interface ComputedRef<T = any> extends WritableComputedRef<T> {
  readonly value: T;
}

export interface WritableComputedRef<T> extends Ref<T> {
  readonly effect: ReactiveEffect<T>;
}

export type ComputedGetter<T> = (ctx?: any) => T;
export type ComputedSetter<T> = (v: T) => void;

export interface WritableComputedOptions<T> {
  get: ComputedGetter<T>;
  set: ComputedSetter<T>;
}

class ComputedRefImpl<T> {
  // getter的值, 也是计算属性的值
  private _value!: T;
  // 是否为脏数据, 计算属性派发更新时使用标识
  private _dirty = true;

  public readonly effect: ReactiveEffect<T>;
  public readonly __v_isRef = true;
  // @ts-ignore
  public readonly [ReactiveFlags.IS_READONLY]: boolean;
  constructor(
    getter: ComputedGetter<T>,
    // ? private关键字会直接将 _setter绑定到实例上
    private readonly _setter: ComputedSetter<T>,
    isReadonly: boolean
  ) {
    // 创建副作用函数
    this.effect = effect(getter, {
      // 计算属性需延迟执行
      lazy: true,
      // 调度执行的实现
      scheduler: () => {
        if (!this._dirty) {
          this._dirty = true;
          // 派发通知, 通知运行访问该计算属性的 activeEffect
          trigger(toRaw(this), TriggerOpTypes.SET, 'value');
        }
      }
    });
    // 只读标识
    this[ReactiveFlags.IS_READONLY] = isReadonly;
  }

  get value() {
    if (this._dirty) {
      // 只有dirty标识为true, 也就是调度执行过后, 才能重新访问计算属性, 表示需要更新
      this._value = this.effect();
      // 重置dirty
      this._dirty = false;
    }
    // 依赖收集
    // ? 依然要将当前计算属性整体转换为原始值
    track(toRaw(this), 'value');
    // 返回值
    return this._value;
  }

  set value(newValue: T) {
    // 设置时候直接访问setter
    this._setter(newValue);
  }
}

// 重载以适配不同参数类型的compouted
export function computed<T>(getter: ComputedGetter<T>): ComputedRef<T>;
export function computed<T>(
  options: WritableComputedOptions<T>
): WritableComputedRef<T>;
export function computed<T>(
  getterOrOptions: ComputedGetter<T> | WritableComputedOptions<T>
) {
  // getter
  let getter: ComputedGetter<T>;
  // setter
  let setter: ComputedSetter<T>;
  if (isFunction(getterOrOptions)) {
    // 计算属性传入回调函数, 表示其本身没有setter
    getter = getterOrOptions;
    // 空函数, 没有setter
    setter = () => {
      console.warn('当前computed是readonly类型');
      return NOOP();
    };
  } else {
    getter = getterOrOptions.get;
    setter = getterOrOptions.set;
  }
  return new ComputedRefImpl(
    getter,
    setter,
    isFunction(getterOrOptions) || !getterOrOptions.set
  ) as any;
}
