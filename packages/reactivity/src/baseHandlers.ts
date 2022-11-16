import { reactive, Target, ReactiveFlags, toRaw, reactiveMap } from './reactive';
import { track, trigger } from './effect';
import { isArray, isIntegerKey, hasOwn, hasChanged, isObject } from '@mini-vue/shared';
import { TriggerOpTypes } from './operations';

/**
 *
 * @param isReadonly 是否只读get
 * @param shallow 是否浅比较
 * @returns 目标字段值
 */
function createGetter(isReadonly = false, shallow = false) {
  return function get(target: Target, key: string | symbol, receiver: object) {
    if (key === ReactiveFlags.IS_REACTIVE) {
      // 访问 __v_isReactive
      return !isReadonly
    } else if (key === ReactiveFlags.IS_READONLY) {
      // 访问 __v_isReadonly
      return isReadonly
    } else if (
      key === ReactiveFlags.RAW &&
      receiver === (reactiveMap).get(target)
    ) {
      // 访问 __v_raw, 指向原有对象
      return target
    }
    // 获取目标值
    const res = Reflect.get(target, key, receiver);
    // * 依赖收集
    track(target, key);
    if (isObject(res)) {
      // 如果res是个对象或者数组类型, 则递归执行 reactive函数把res变成响应式对象
      return reactive(res)
    }
    return res;
  };
}
const get = createGetter();

function createSetter(shallow = false) {
  return function set( // 目标对象
    target: object,
    // 更新字段
    key: string | symbol,
    // 更新值
    value: unknown,
    // 一般是响应式对象本身, 或者继承这个响应式对象的一个对象
    receiver: object
  ): boolean {
    // 更新前的值
    const oldValue = (target as any)[key];
    // 判断当前key是否在原始对象上
    const hadKey =
      isArray(target) && isIntegerKey(key)
        ? Number(key) < target.length
        : hasOwn(target, key);
    // 赋值
    const result = Reflect.set(target, key, value, receiver);
    // * 派发更新, 并防止重复触发trigger
    // 如果目标的原型为当前proxy对象, 通过 Reflect.set修改原型链上的属性会再次触发setter, 这种情况下就没必要触发两次trigger了
    if (target === toRaw(receiver)) {
      if (!hadKey) {
        // 属性添加
        trigger(target, TriggerOpTypes.ADD, key, value);
      } else if (hasChanged(value, oldValue)) {
        // 属性更新
        trigger(target, TriggerOpTypes.SET, key, value, oldValue);
      }
    }
    // 返回执行结果, 赋值成功为true, 失败为false
    return result;
  };
}

const set = createSetter();

export const mutableHandlers: ProxyHandler<object> = {
  get,
  set
};
