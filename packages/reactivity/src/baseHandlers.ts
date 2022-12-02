import {
  reactive,
  Target,
  ReactiveFlags,
  toRaw,
  readonlyMap,
  reactiveMap,
  readonly
} from './reactive';
import { track, trigger } from './effect';
import {
  isArray,
  isIntegerKey,
  hasOwn,
  hasChanged,
  isObject,
  extend
} from '@mini-vue/shared';
import { TriggerOpTypes } from './operations';
import { isRef } from './ref';

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
      return !isReadonly;
    } else if (key === ReactiveFlags.IS_READONLY) {
      // 访问 __v_isReadonly
      return isReadonly;
    } else if (
      key === ReactiveFlags.RAW &&
      receiver === (isReadonly ? readonlyMap : reactiveMap).get(target)
    ) {
      // 访问 __v_raw, 指向原有对象
      return target;
    }
    // 判断是否为数组
    const targetIsArray = isArray(target);
    // TODO 需处理数组方法直接访问
    // 获取目标值
    const res = Reflect.get(target, key, receiver);
    // * 依赖收集
    if (!isReadonly) {
      // readonly属性无需收集依赖
      track(target, key);
    }
    if (shallow) {
      // 浅层reactive或者readonly, 无需对内部对象进行进一步处理
      return res;
    }

    if (isRef(res)) {
      // 解ref, 数组成员或者key为数字除外
      const shouldUnwrap = !targetIsArray || !isIntegerKey(key)
      return shouldUnwrap ? res.value : res
    }

    if (isObject(res)) {
      // 如果res是个对象或者数组类型, 则递归执行 reactive函数把res变成响应式对象
      return isReadonly ? readonly(res) : reactive(res);
    }
    return res;
  };
}
const get = createGetter();
const shallowGet = /*#__PURE__*/ createGetter(false, true)
const readonlyGet = createGetter(true);
const shallowReadonlyGet = createGetter(true, true);

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
    if (!shallow) {
      // 获取原始值value, 防止value是一个响应式对象
      value = toRaw(value)
      // 处理数组
      if (!isArray(target) && isRef(oldValue) && !isRef(value)) {
        // 如果目标对象是一个数组, 并且初始值是一个Ref响应式对象, 同时当前value不是一个ref响应式对象
        // 此时对oldValue.value赋值, 也就是对原始值赋值, 然后返回即可
        // ? 此时数据更新已完成, Ref值, 也就是oldValue.value变化后中会继续进行派发更新, 因此此时无需继续操作
        oldValue.value = value
        return true
      }
    }
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
        trigger(target, TriggerOpTypes.SET, key, value);
      }
    }
    // 返回执行结果, 赋值成功为true, 失败为false
    return result;
  };
}

const set = createSetter();
const shallowSet = /*#__PURE__*/ createSetter(true)

export const mutableHandlers: ProxyHandler<object> = {
  get,
  set
};

export const readonlyHandlers: ProxyHandler<object> = {
  get: readonlyGet,
  set(target, key) {
    console.warn(`readonly属性 ${String(key)} 禁止set操作!`, target);
    return true;
  }
};

export const shallowReadonlyHandlers: ProxyHandler<object> = extend(
  {},
  readonlyHandlers,
  {
    get: shallowReadonlyGet
  }
);

export const shallowReactiveHandlers: ProxyHandler<object> = extend(
  {},
  mutableHandlers,
  {
    get: shallowGet,
    set: shallowSet
  }
)
