import type {
  ComputedGetter,
  WritableComputedOptions
} from '@mini-vue/reactivity';
import type { EmitsOptions } from './componentEmits';
import type { CreateComponentPublicInstance } from './componentPublicInstance';
import type { WatchCallback, WatchOptions } from './apiWatch';
import type {
  Data,
  ComponentInternalOptions,
  SetupContext,
  Component
} from './component';
import type { UnionToIntersection } from './helpers/typeUtils';
import type { VNodeChild } from './vnode';

// computed类型定义
export type ComputedOptions = Record<
  string,
  ComputedGetter<any> | WritableComputedOptions<any>
>;

// 自定义组件默认类型
export interface ComponentCustomOptions {}

// methods选项类型定义
export interface MethodOptions {
  [key: string]: Function;
}

// 组件mixin选项类型定义
export type ComponentOptionsMixin = ComponentOptionsBase<
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any
>;

// inject类型约束
type ComponentInjectOptions =
  | string[]
  | Record<
      string | symbol,
      string | symbol | { from?: string | symbol; default?: unknown }
    >;

// optionsType的类型定义
export type OptionTypesType<
  P = {},
  B = {},
  D = {},
  C extends ComputedOptions = {},
  M extends MethodOptions = {},
  Defaults = {}
> = {
  P: P;
  B: B;
  D: D;
  C: C;
  M: M;
  Defaults: Defaults;
};

// 保留选项
interface LegacyOptions<
  Props,
  D,
  C extends ComputedOptions,
  M extends MethodOptions,
  Mixin extends ComponentOptionsMixin,
  Extends extends ComponentOptionsMixin
> {
  // 值可以是任意类型
  [key: string]: any;

  // context或者this中不会公开 RawBindings(setup返回值), 因为会导致ts推断有误
  data?: (
    this: CreateComponentPublicInstance<
      Props,
      {},
      {},
      {},
      MethodOptions,
      Mixin,
      Extends
    >,
    vm: CreateComponentPublicInstance<
      Props,
      {},
      {},
      {},
      MethodOptions,
      Mixin,
      Extends
    >
  ) => D;
  computed?: C;
  methods?: M;
  watch?: ComponentWatchOptions;
  provide?: Data | Function;
  inject?: ComponentInjectOptions;

  // composition
  mixins?: Mixin[];
  extends?: Extends;

  // lifecycle
  beforeCreate?(): void;
  created?(): void;
  beforeMount?(): void;
  mounted?(): void;
  beforeUpdate?(): void;
  updated?(): void;
  activated?(): void;
  deactivated?(): void;
  /** @deprecated use `beforeUnmount` instead */
  beforeDestroy?(): void;
  beforeUnmount?(): void;
  /** @deprecated use `unmounted` instead */
  destroyed?(): void;
  unmounted?(): void;

  // runtime compile only
  delimiters?: [string, string];
}

type ExtractOptionProp<T> = T extends ComponentOptionsBase<
  infer P,
  any,
  any,
  any,
  any,
  any,
  any,
  any
>
  ? unknown extends P
    ? {}
    : P
  : {};

export type RenderFunction = () => VNodeChild;

// 基本组件options
export interface ComponentOptionsBase<
  Props,
  RawBindings,
  D,
  C extends ComputedOptions,
  M extends MethodOptions,
  Mixin extends ComponentOptionsMixin,
  Extends extends ComponentOptionsMixin,
  E extends EmitsOptions,
  EE extends string = string,
  Defaults = {}
> extends LegacyOptions<Props, D, C, M, Mixin, Extends>,
    ComponentInternalOptions,
    ComponentCustomOptions {
  setup?: (
    this: void,
    props: Props &
      UnionToIntersection<ExtractOptionProp<Mixin>> &
      UnionToIntersection<ExtractOptionProp<Extends>>,
    ctx: SetupContext<E>
  ) => Promise<RawBindings> | RawBindings | RenderFunction | void;
  name?: string;
  template?: string | object;
  // render用Function, 否则带有this的签名会导致ts推断报错
  render?: Function;
  components?: Record<string, Component>;
  inheritAttrs?: boolean;
  emits?: (E | EE[]) & ThisType<void>;
  expose?: string[];
  serverPrefetch?(): Promise<any>;
  // 缓存合并后的options
  __merged?: ComponentOptions;
  call?: (this: unknown, ...args: unknown[]) => never;

  __defaults?: Defaults;
}

export type OptionTypesKeys = 'P' | 'B' | 'D' | 'C' | 'M' | 'Defaults';

type WatchOptionItem =
  | string
  | WatchCallback
  | ({ handler: WatchCallback | string } & WatchOptions);

type ComponentWatchOptionItem = WatchOptionItem | WatchOptionItem[];

type ComponentWatchOptions = Record<string, ComponentWatchOptionItem>;

// 组件选项
export type ComponentOptions<
  Props = {},
  RawBindings = any,
  D = any,
  C extends ComputedOptions = any,
  M extends MethodOptions = any,
  Mixin extends ComponentOptionsMixin = any,
  Extends extends ComponentOptionsMixin = any,
  E extends EmitsOptions = any
> = ComponentOptionsBase<Props, RawBindings, D, C, M, Mixin, Extends, E> &
  ThisType<
    CreateComponentPublicInstance<
      {},
      RawBindings,
      D,
      C,
      M,
      Mixin,
      Extends,
      E,
      Readonly<Props>
    >
  >;

export type ExtractComputedReturns<T extends any> = {
  [key in keyof T]: T[key] extends { get: (...args: any[]) => infer TReturn }
    ? TReturn
    : T[key] extends (...args: any[]) => infer TReturn
    ? TReturn
    : never;
};

// 标识正处于beforeCreated阶段
export let isInBeforeCreate = false
