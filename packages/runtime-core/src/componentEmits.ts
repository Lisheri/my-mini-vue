import { UnionToIntersection } from './helpers/typeUtils';
import { ConcreteComponent } from './component';
import { AppContext } from './apiCreateApp';
import { extend, isArray, isFunction } from '@mini-vue/shared';

// key为string, value为函数
export type ObjectEmitsOptions = Record<
  string,
  ((...args: any[]) => any) | null
>;

// emits类型定义
export type EmitsOptions = ObjectEmitsOptions | string[];
export type EmitFn<
  Options = ObjectEmitsOptions,
  Event extends keyof Options = keyof Options
> = Options extends Array<infer V>
  ? (event: V, ...args: any[]) => void
  : {} extends Options // if the emit is empty object (usually the default value for emit) should be converted to function
  ? (event: string, ...args: any[]) => void
  : UnionToIntersection<
      {
        [key in Event]: Options[key] extends (...args: infer Args) => any
          ? (event: key, ...args: Args) => void
          : (event: key, ...args: any[]) => void;
      }[Event]
    >;

export function normalizeEmitsOptions(
  comp: ConcreteComponent,
  appContext: AppContext,
  asMixin = false
): ObjectEmitsOptions | null {
  if (comp.__emits !== undefined) {
    // 有缓存直接获取缓存
    return comp.__emits;
  }
  // 获取用户传入的原始emits数据
  const raw = comp.emits;
  // 存储标准化后的emit
  let normalized: ObjectEmitsOptions = {};

  // 是否合并过extends或mixins上的emits属性
  let hasExtends = false;
  if (!isFunction(comp)) {
    // ? 非函数组件为有状态组件
    const extendEmits = (raw) => {
      // 置为true
      hasExtends = true;
      extend(normalized, normalizeEmitsOptions(raw, appContext, true));
    }

    if (!asMixin && appContext.mixins.length) {
      // 处理全局mixins
      appContext.mixins.forEach(extendEmits);
    }
    if (comp.extends) {
      // 处理组件的extends属性
      extendEmits(comp.extends)
    }
    if (comp.mixins) {
      // 处理组件的mixins
      comp.mixins.forEach(extendEmits)
    }
  }
  if (!hasExtends && !raw) {
    // 无emits数据, 无需处理
    return (comp.__emits = null);
  }
  if (isArray(raw)) {
    // 遍历赋值为null, 仅保留属性名
    raw.forEach(key => (normalized[key] = null))
  } else {
    // 直接合并
    extend(normalized, raw);
  }

  return (comp.__emits = normalized);
}
