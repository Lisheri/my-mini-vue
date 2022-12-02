// ? 类型声明, 来自Vue3
import {
  ComputedOptions,
  MethodOptions,
  ComponentOptionsMixin,
  ComponentOptionsBase,
  OptionTypesType,
  OptionTypesKeys,
  ExtractComputedReturns,
  isInBeforeCreate
} from './componentOptions';
import { nextTick, queueJob } from './scheduler';
import { EmitsOptions } from './componentEmits';
import { UnionToIntersection } from './helpers/typeUtils';
import {
  ComponentInternalInstance,
  Data,
  isStatefulComponent
} from './component';
import { Slots } from './componentSlots';
import { EmitFn } from './componentEmits';
import { currentRenderingInstance } from './componentRenderContext';
import {
  ReactiveEffect,
  ShallowUnwrapRef,
  ReactiveFlags,
  track
} from '@mini-vue/reactivity';
import { EMPTY_OBJ, hasOwn, extend, isString } from '@mini-vue/shared';

// 以任何方式添加到组件实例的自定义属性，可以通过“this”访问
export interface ComponentCustomProperties {}
// 确保没有Non
type EnsureNonVoid<T> = T extends void ? {} : T;

export type ComponentPublicInstance<
  // props类型, 从props中提取类型约束
  P = {},
  // 从setup返回值中绑定raw类型
  B = {},
  // data()返回中获取类型
  D = {},
  C extends ComputedOptions = {},
  M extends MethodOptions = {},
  E extends EmitsOptions = {},
  PublicProps = P,
  Defaults = {},
  MakeDefaultsOptional extends boolean = false,
  Options = ComponentOptionsBase<any, any, any, any, any, any, any, any, any>
> = {
  $: ComponentInternalInstance;
  $data: D;
  $props: MakeDefaultsOptional extends true
    ? Partial<Defaults> & Omit<P & PublicProps, keyof Defaults>
    : P & PublicProps;
  $attrs: Data;
  $refs: Data;
  $slots: Slots;
  $root: ComponentPublicInstance | null;
  $parent: ComponentPublicInstance | null;
  $emit: EmitFn<E>;
  $el: any;
  $options: Options;
  $forceUpdate: ReactiveEffect;
  // $nextTick: typeof nextTick;
  // $watch(
  //   source: string | Function,
  //   cb: Function,
  //   options?: WatchOptions
  // ): WatchStopHandle;
} & P &
  ShallowUnwrapRef<B> &
  D &
  ExtractComputedReturns<C> &
  M &
  ComponentCustomProperties;

type UnwrapMixinsType<
  T,
  Type extends OptionTypesKeys
> = T extends OptionTypesType ? T[Type] : never;

type MixinToOptionTypes<T> = T extends ComponentOptionsBase<
  infer P,
  infer B,
  infer D,
  infer C,
  infer M,
  infer Mixin,
  infer Extends,
  any,
  any,
  infer Defaults
>
  ? OptionTypesType<P & {}, B & {}, D & {}, C & {}, M & {}, Defaults & {}> &
      IntersectionMixin<Mixin> &
      IntersectionMixin<Extends>
  : never;

type IsDefaultMixinComponent<T> = T extends ComponentOptionsMixin
  ? ComponentOptionsMixin extends T
    ? true
    : false
  : false;

// ExtractMixin(map type) 用于解决循环引用
type ExtractMixin<T> = {
  Mixin: MixinToOptionTypes<T>;
}[T extends ComponentOptionsMixin ? 'Mixin' : never];

type IntersectionMixin<T> = IsDefaultMixinComponent<T> extends true
  ? OptionTypesType<{}, {}, {}, {}, {}>
  : UnionToIntersection<ExtractMixin<T>>;

// 创建组件上下文instance, createCurrentInstance时返回值
export type CreateComponentPublicInstance<
  P = {},
  B = {},
  D = {},
  C extends ComputedOptions = {},
  M extends MethodOptions = {},
  Mixin extends ComponentOptionsMixin = ComponentOptionsMixin,
  Extends extends ComponentOptionsMixin = ComponentOptionsMixin,
  E extends EmitsOptions = {},
  PublicProps = P,
  Defaults = {},
  MakeDefaultsOptional extends boolean = false,
  PublicMixin = IntersectionMixin<Mixin> & IntersectionMixin<Extends>,
  PublicP = UnwrapMixinsType<PublicMixin, 'P'> & EnsureNonVoid<P>,
  PublicB = UnwrapMixinsType<PublicMixin, 'B'> & EnsureNonVoid<B>,
  PublicD = UnwrapMixinsType<PublicMixin, 'D'> & EnsureNonVoid<D>,
  PublicC extends ComputedOptions = UnwrapMixinsType<PublicMixin, 'C'> &
    EnsureNonVoid<C>,
  PublicM extends MethodOptions = UnwrapMixinsType<PublicMixin, 'M'> &
    EnsureNonVoid<M>,
  PublicDefaults = UnwrapMixinsType<PublicMixin, 'Defaults'> &
    EnsureNonVoid<Defaults>
> = ComponentPublicInstance<
  PublicP,
  PublicB,
  PublicD,
  PublicC,
  PublicM,
  E,
  PublicProps,
  PublicDefaults,
  MakeDefaultsOptional,
  ComponentOptionsBase<P, B, D, C, M, Mixin, Extends, E, string, Defaults>
>;

export type ComponentPublicInstanceConstructor<
  T extends ComponentPublicInstance<
    Props,
    RawBindings,
    D,
    C,
    M
  > = ComponentPublicInstance<any>,
  Props = any,
  RawBindings = any,
  D = any,
  C extends ComputedOptions = ComputedOptions,
  M extends MethodOptions = MethodOptions
> = {
  __isFragment?: never;
  __isTeleport?: never;
  __isSuspense?: never;
  new (...args: any[]): T;
};

export interface ComponentRenderContext {
  [key: string]: any;
  _: ComponentInternalInstance;
}

type PublicPropertiesMap = Record<
  string,
  (i: ComponentInternalInstance) => any
>;

// 访问的属性枚举
const enum AccessTypes {
  SETUP,
  DATA,
  PROPS,
  CONTEXT,
  OTHER
}

// 获取当前实例暴露的内容, 若没有exposed则获取proxy
const getPublicInstance = (
  i: ComponentInternalInstance | null
): ComponentPublicInstance | ComponentInternalInstance['exposed'] | null => {
  if (!i) return null;
  if (isStatefulComponent(i)) return i.exposed ? i.exposed : i.proxy;
  // 无状态组件递归向上找他爹
  return getPublicInstance(i.parent);
};

// 公开属性map
const publicPropertiesMap: PublicPropertiesMap = extend(Object.create(null), {
  $: (i) => i,
  $el: (i) => i.vnode.el,
  $data: (i) => i.data,
  $props: (i) => i.props,
  $attrs: (i) => i.attrs,
  $slots: (i) => i.slots,
  $refs: (i) => i.refs,
  $parent: (i) => getPublicInstance(i.parent),
  $root: (i) => getPublicInstance(i.root),
  $emit: (i) => i.emit,
  $options: (i) => i.type,
  $forceUpdate: i => () => queueJob(i.update),
  $nextTick: i => nextTick.bind(i.proxy!)
  // $watch: i => NOOP
} as PublicPropertiesMap);

// 渲染上下文代理劫持属性
export const PublicInstanceProxyHandlers: ProxyHandler<any> = {
  get({ _: instance }: ComponentRenderContext, key: string) {
    const { ctx, setupState, data, props, accessCache } =
      instance;
    if (key === ReactiveFlags.SKIP) {
      // 访问 __v_skip 属性
      return true;
    }
    // 在渲染期间访问渲染上下文上的属性时会触发getter, 内部多次调用hasOwn是比较关键的过程, 在普通对象上进行单一属性的访问非常快, 因此这里使用accessCache(null原型对象)来记住键对应的访问类型
    let normalizedProps;
    if (key[0] !== '$') {
      // 访问上下文上的props/data/setupState/ctx
      // 渲染代理的属性访问缓存中
      // ? accessCache在设置全局proxy之前, 已经设置为了 Object.create(null);
      const n = accessCache![key];
      if (n !== undefined) {
        // 有缓存则根据缓存类型直接从对应的数据源中取出
        switch (n) {
          case AccessTypes.SETUP:
            // 访问setupState中的属性
            return setupState[key];
          case AccessTypes.DATA:
            // 访问data中的属性
            return data[key];
          case AccessTypes.PROPS:
            // 访问props中的属性, 有缓存时候props已被标准化
            return props[key];
          case AccessTypes.CONTEXT:
            // 访问context中的属性
            return ctx[key];
          // 剩下的直接跳过
        }
      } else if (setupState !== EMPTY_OBJ && hasOwn(setupState, key)) {
        // 记录key缓存
        accessCache![key] = AccessTypes.SETUP;
        // 返回值
        return setupState[key];
      } else if (data !== EMPTY_OBJ && hasOwn(data, key)) {
        // 记录缓存
        accessCache![key] = AccessTypes.DATA;
        return data[key];
      } else if (
        (normalizedProps = instance.propsOptions[0]) &&
        hasOwn(normalizedProps, key)
      ) {
        // 这里需要查找标准化完成后的props, 而不是原始props, 原始props会有不统一的问题出现
        accessCache![key] = AccessTypes.PROPS;
        return props[key];
      } else if (ctx !== EMPTY_OBJ && hasOwn(ctx, key)) {
        accessCache![key] = AccessTypes.CONTEXT;
        return ctx[key];
      } else if (!isInBeforeCreate) {
        // 都没有取到, 且不在beforeCreate阶段, 则直接记录为OTHER, 再次进入直接跳过缓存
        accessCache![key] = AccessTypes.OTHER;
      }
    }
    // 访问的是 $开头的保留属性或预设属性
    // 获取对应属性的getter
    const publicGetter = publicPropertiesMap[key];
    if (publicGetter) {
      // 访问的公开的 $xxx 属性或方法
      if (key === '$attrs') {
        // 此处需要收集依赖
        track(instance, key);
      }
      return publicGetter(instance);
    }
    // TODO 应考虑cssModule, 但是cssModule通过vue-loader编译注入, mini-vue中暂不考虑, 详情请看vue-next
    else if (ctx !== EMPTY_OBJ && hasOwn(ctx, key)) {
      // 用户自定义属性, 但是以 $ 开头了
      // 记录缓存
      accessCache![key] = AccessTypes.CONTEXT;
      // 从ctx中取出
      return ctx[key];
    } else if (
      currentRenderingInstance &&
      // 处理非常规key
      (!isString(key) ||
        // 避免对循环组件实例进行内部 isRef/isVNode检查
        key.indexOf('__v') !== 0)
    ) {
      if (
        data !== EMPTY_OBJ &&
        (key[0] === '$' || key[0] === '_') &&
        hasOwn(data, key)
      ) {
        // 在data中有 $ 开头的key
        console.warn(
          `属性 ${JSON.stringify(key)}无效, data中的key不能以 $ 开头`
        );
      } else if (instance === currentRenderingInstance) {
        console.warn(`模板中存在没有定义的变量: ${JSON.stringify(key)}`);
      }
    }
  },
  set(
    { _: instance }: ComponentRenderContext,
    key: string,
    value: any
  ): boolean {
    const { data, setupState, ctx } = instance;
    if (setupState !== EMPTY_OBJ && hasOwn(setupState, key)) {
      // 给setup属性赋值
      setupState[key] = value;
    } else if (data !== EMPTY_OBJ && hasOwn(data, key)) {
      data[key] = value;
    } else if (hasOwn(instance.props, key)) {
      // props上属性赋值, 直接告警
      console.warn(`给props上属性${key}赋值失败, 该属性为只读属性`);
      return false
    }
    if (key[0] === "$" && key.slice(1) in instance) {
      // 保留属性赋值
      console.warn(`属性${key}赋值失败, 保留属性为只读属性`);
      return false
    } else {
      // TODO 其实更加完善的是需要处理定级注入的全局属性, 但mini-vue不做此处理, 直接挂载到渲染上下文上即可
      // 非保留属性或只读允许直接挂载到渲染上下文上
      ctx[key] = value;
    }
    return true
  }
  // TODO 缺少一个has劫持
};
