import { UnionToIntersection } from './helpers/typeUtils';
import { ConcreteComponent, ComponentInternalInstance } from './component';
import { AppContext } from './apiCreateApp';
import { callWithAsyncErrorHandling, ErrorCodes } from './errorHandling';
import {
  extend,
  isArray,
  isFunction,
  isOn,
  hasOwn,
  EMPTY_OBJ,
  camelize,
  hyphenate,
  toHandlerKey
} from '@mini-vue/shared';

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
  : {} extends Options
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
    };

    if (!asMixin && appContext.mixins.length) {
      // 处理全局mixins
      appContext.mixins.forEach(extendEmits);
    }
    if (comp.extends) {
      // 处理组件的extends属性
      extendEmits(comp.extends);
    }
    if (comp.mixins) {
      // 处理组件的mixins
      comp.mixins.forEach(extendEmits);
    }
  }
  if (!hasExtends && !raw) {
    // 无emits数据, 无需处理
    return (comp.__emits = null);
  }
  if (isArray(raw)) {
    // 遍历赋值为null, 仅保留属性名
    raw.forEach((key) => (normalized[key] = null));
  } else {
    // 直接合并
    extend(normalized, raw);
  }

  return (comp.__emits = normalized);
}

// 判断是否为emit专属字段
export function isEmitListener(
  options: ObjectEmitsOptions | null,
  key: string
): boolean {
  if (!options || !isOn(key)) {
    return false;
  }
  // 截取前两位(on), 在移除Once标识, 获取最纯粹的key
  key = key.slice(2).replace(/Once$/, '');
  return (
    // 转小写开头进行判断
    hasOwn(options, key[0].toLowerCase() + key.slice(1)) || hasOwn(options, key)
  );
}

// 派发事件函数
export function emit(
  instance: ComponentInternalInstance,
  event: string,
  ...rawArgs: any[]
) {
  const props = instance.vnode.props || EMPTY_OBJ;
  let args = rawArgs;
  // TODO 暂不处理v-model的修饰符
  let handlerName = toHandlerKey(camelize(event));
  let handler = props[handlerName];
  if (!handler) {
    // 如果handler不存在, 这里在进行一次操作, 处理属性时, 会将带有事件修饰符的事件名称从驼峰转换为短横线
    handlerName = toHandlerKey(hyphenate(event));
    // 再次尝试获取
    handler = props[handlerName];
  }

  if (handler) {
    // 调用
    callWithAsyncErrorHandling(
      handler,
      ErrorCodes.COMPONENT_EVENT_HANDLER,
      args
    );
  }

  // 处理$once
  const onceHandler = props[`${handlerName}Once`];
  if (onceHandler) {
    if (!instance.emitted) {
      (instance.emitted = {} as Record<string, boolean>)[handlerName] = true;
    } else if (instance.emitted[handlerName]) {
      // 已经处理就直接返回
      return;
    }
    // 执行once
    callWithAsyncErrorHandling(
      onceHandler,
      ErrorCodes.COMPONENT_EVENT_HANDLER,
      args
    );
  }
}
