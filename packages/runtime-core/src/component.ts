import {
  NormalizedPropsOptions,
  ComponentPropsOptions,
  normalizePropsOptions,
  initProps
} from './componentProps';
import {
  ObjectEmitsOptions,
  EmitsOptions,
  EmitFn,
  normalizeEmitsOptions,
  emit
} from './componentEmits';
import { Slots, InternalSlots, initSlots } from './componentSlots';
import { AppContext, createAppContext } from './apiCreateApp';
import {
  ComputedOptions,
  MethodOptions,
  ComponentOptions
} from './componentOptions';
import {
  ComponentPublicInstanceConstructor,
  ComponentPublicInstance,
  PublicInstanceProxyHandlers
} from './componentPublicInstance';
import { VNode, VNodeChild, isVNode } from './vnode';
import { ShapeFlags } from './shapeFlags';
import { currentRenderingInstance } from './componentRenderContext';
import { callWithErrorHandling, ErrorCodes } from './errorHandling';
import {
  pauseTracking,
  proxyRefs,
  ReactiveEffect,
  resetTracking
} from '@mini-vue/reactivity';
import { EMPTY_OBJ, isPromise, isObject, isFunction, NOOP } from '@mini-vue/shared';
export type Data = Record<string, unknown>;

export interface ComponentInternalOptions {
  // 标准化后的props
  __props?: NormalizedPropsOptions;
  // 标准化后的emits
  __emits?: ObjectEmitsOptions | null;
  __scopeId?: string;
  __cssModules?: Data;
  __hmrId?: string;
}

export interface SetupContext<E = EmitsOptions> {
  attrs: Data;
  slots: Slots;
  emit: EmitFn<E>;
  expose: (exposed: Record<string, any>) => void;
}

export type Component<
  Props = any,
  RawBindings = any,
  D = any,
  C extends ComputedOptions = ComputedOptions,
  M extends MethodOptions = MethodOptions
> =
  | ConcreteComponent<Props, RawBindings, D, C, M>
  | ComponentPublicInstanceConstructor<Props>;

// 最终组件内容
export type ConcreteComponent<
  Props = {},
  RawBindings = any,
  D = any,
  C extends ComputedOptions = ComputedOptions,
  M extends MethodOptions = MethodOptions
> =
  | ComponentOptions<Props, RawBindings, D, C, M>
  | FunctionalComponent<Props, any>;

export interface FunctionalComponent<P = {}, E extends EmitsOptions = {}>
  extends ComponentInternalOptions {
  // use of any here is intentional so it can be a valid JSX Element constructor
  (props: P, ctx: Omit<SetupContext<E>, 'expose'>): any;
  props?: ComponentPropsOptions<P>;
  emits?: E | (keyof E)[];
  attrs: Data;
  inheritAttrs?: boolean;
  displayName?: string;
}

export type InternalRenderFunction = {
  (
    ctx: ComponentPublicInstance,
    cache: ComponentInternalInstance['renderCache'],
    // for compiler-optimized bindings
    $props: ComponentInternalInstance['props'],
    $setup: ComponentInternalInstance['setupState'],
    $data: ComponentInternalInstance['data'],
    $options: ComponentInternalInstance['ctx']
  ): VNodeChild;
  _rc?: boolean; // isRuntimeCompiled
};

// 组件实例
export interface ComponentInternalInstance {
  // 组件唯一id
  uid: number;
  // vnode节点
  type: ConcreteComponent;
  // 父组件实例
  parent: ComponentInternalInstance | null;
  // 根组件实例
  root: ComponentInternalInstance;
  // 新的组件vnode(下一个兄弟)
  next: VNode | null;
  // app上下文
  appContext: AppContext;
  // Vnode 在其父 vdom 树中表示此组件
  vnode: VNode;
  // 该组件本身的虚拟dom树的根vnode
  subTree: VNode;
  // provides
  provides: Data;
  // 响应式对象依赖更新函数
  effects: ReactiveEffect[] | null;
  // 渲染代理的属性访问缓存
  accessCache: Data | null;
  // 渲染缓存
  renderCache: (Function | VNode)[];
  // 局部注册的组件
  components: Record<string, ConcreteComponent> | null;
  // 处理后的props选项
  propsOptions: NormalizedPropsOptions;
  // 处理后的emits选项
  emitsOptions: ObjectEmitsOptions | null;
  // 渲染上下文代理
  proxy: ComponentPublicInstance | null;
  // 暴露给其他组件访问的属性, 如refs访问子组件时, 只有通过exposed属性暴露的才能被访问到
  exposed: Record<string, any> | null;
  // 带有with区块的渲染上下文代理, 主要作用于template编译后的render函数
  // withProxy: ComponentPublicInstance | null;
  // 渲染上下文
  ctx: Data;
  // data属性
  data: Data;
  // props属性
  props: Data;
  // 普通的dom节点属性
  attrs: Data;
  // 插槽
  slots: InternalSlots;
  // 组件或DOM的ref引用
  refs: Data;
  // 派发事件方法
  emit: EmitFn;
  // 标识once已执行过一次
  emitted: Record<string, boolean> | null;
  // setup返回的数据
  setupState: Data;
  // setup 函数上下文数据
  setupContext: SetupContext | null;

  // 是否挂载
  isMounted: boolean;
  // 是否卸载
  isUnmounted: boolean;
  // 是否激活, keep-alive用
  isDeactivated: boolean;
  // 更新和组件首次挂载函数
  update: ReactiveEffect;
  // 渲染函数
  render: InternalRenderFunction | null;
  // 生命周期
  [LifecycleHooks.BEFORE_CREATE]: LifecycleHook;
  [LifecycleHooks.CREATED]: LifecycleHook;
  [LifecycleHooks.BEFORE_MOUNT]: LifecycleHook;
  [LifecycleHooks.MOUNTED]: LifecycleHook;
  [LifecycleHooks.BEFORE_UPDATE]: LifecycleHook;
  [LifecycleHooks.UPDATED]: LifecycleHook;
  [LifecycleHooks.BEFORE_UNMOUNT]: LifecycleHook;
  [LifecycleHooks.UNMOUNTED]: LifecycleHook;
  [LifecycleHooks.RENDER_TRACKED]: LifecycleHook;
  [LifecycleHooks.RENDER_TRIGGERED]: LifecycleHook;
  [LifecycleHooks.ACTIVATED]: LifecycleHook;
  [LifecycleHooks.DEACTIVATED]: LifecycleHook;
  [LifecycleHooks.ERROR_CAPTURED]: LifecycleHook;
}

export const enum LifecycleHooks {
  BEFORE_CREATE = 'bc',
  CREATED = 'c',
  BEFORE_MOUNT = 'bm',
  MOUNTED = 'm',
  BEFORE_UPDATE = 'bu',
  UPDATED = 'u',
  BEFORE_UNMOUNT = 'bum',
  UNMOUNTED = 'um',
  DEACTIVATED = 'da',
  ACTIVATED = 'a',
  RENDER_TRIGGERED = 'rtg',
  RENDER_TRACKED = 'rtc',
  ERROR_CAPTURED = 'ec'
}

type LifecycleHook = Function[] | null;

// 类组件声明
export interface ClassComponent {
  new (...args: any[]): ComponentPublicInstance<any, any, any, any, any>;
  __vccOpts: ComponentOptions;
}

type CompileFunction = (
  template: string | object
  // options?: CompilerOptions
) => InternalRenderFunction

let compiler: CompileFunction | undefined

// 标识是否为runtimeOnly
export const isRuntimeOnly = () => !compiler;

// 注册编译方法
export function registerRuntimeCompiler(_compiler: any) {
  compiler = _compiler;
}

// 默认的appContext
const emptyContext = createAppContext();

// 组件uid
let uid: number = 0;

// 创建组件实例
export function createComponentInstance(
  vnode: VNode,
  parent: ComponentInternalInstance | null
) {
  // 用于区分组件是否有状态, 函数式组件暂时无状态
  const type = vnode.type as ConcreteComponent;
  // 继承父组件实例上的 appContext, 如果是根组件, 则直接从根vnode中取
  const appContext =
    (parent ? parent.appContext : vnode.appContext) || emptyContext;

  // 组件instance属性占位
  const instance: ComponentInternalInstance = {
    uid: uid++,
    type,
    parent,
    appContext,
    root: null!, // ? 断言跳过ts类型检查, 此处主要是占位, 后续同样
    next: null,
    vnode,
    subTree: null!,
    // 初始化的时候需要获取父级的provides, 否则继承根节点的provides
    provides: parent ? parent.provides : Object.create(appContext.provides),
    effects: null,
    // 作为effect的依赖出现,可以被收集, 首次挂载和更新时都会触发
    update: null!,
    // 渲染函数
    render: null,
    accessCache: null,
    renderCache: null!,
    components: null,
    // 设置的props选项
    propsOptions: normalizePropsOptions(type, appContext),
    emitsOptions: normalizeEmitsOptions(type, appContext),
    proxy: null,
    exposed: null,
    // 带有with区块的渲染上下文代理
    // withProxy: null,
    ctx: EMPTY_OBJ,
    data: EMPTY_OBJ,
    props: EMPTY_OBJ,
    attrs: EMPTY_OBJ,
    slots: EMPTY_OBJ,
    refs: EMPTY_OBJ,
    setupState: EMPTY_OBJ,
    setupContext: null,
    emit: null as any,
    emitted: null,
    isMounted: false,
    isUnmounted: false,
    isDeactivated: false,
    // 生命周期, beforeCreate
    bc: null,
    // 生命周期, created
    c: null,
    // 生命周期, beforeMounted
    bm: null,
    // 生命周期, mounted
    m: null,
    // 生命周期, beforeUpdated
    bu: null,
    // 生命周期, updated
    u: null,
    // 生命周期, beforeUnmounted
    bum: null,
    // 生命周期, unmounted
    um: null,
    // 生命周期, deactivated
    da: null,
    // 生命周期, activated
    a: null,
    // 生命周期 render triggered
    rtg: null,
    // 生命周期, render tracked
    rtc: null,
    // 生命周期, error capture
    ec: null
  };
  // 初始化渲染上下文ctx, 和instance做一个双向指针, 指向同一位置
  instance.ctx = { _: instance };
  // 初始化根组件指针root
  instance.root = parent ? parent.root : instance;
  instance.emit = emit.bind(null, instance);
  return instance;
}

export let currentInstance: ComponentInternalInstance | null = null;

// 获取当前组件实例
export const getCurrentInstance: () => ComponentInternalInstance | null = () =>
  currentInstance || currentRenderingInstance;

// 设置当前组件实例
export const setCurrentInstance = (
  instance: ComponentInternalInstance | null
) => {
  currentInstance = instance;
};

// 判断是否有状态组件
export const isStatefulComponent = (instance: ComponentInternalInstance) => {
  return instance.vnode.shapeFlag & ShapeFlags.STATEFUL_COMPONENT;
};

// 设置组件实例, 处理props, 插槽以及调用setup返回的值等
export function setupComponent(instance: ComponentInternalInstance) {
  const { props, children } = instance.vnode;
  // 判断当前组件是否为有状态组件
  const isStateful = isStatefulComponent(instance);
  initProps(instance, props, isStateful);
  // 初始化插槽
  initSlots(instance, children);

  // 设置有状态的组件实例并获取setup返回结果
  const setupResult = isStateful ? setupStatefulComponent(instance) : undefined;
  // 返回有状态的组件setup执行结果
  return setupResult;
}

// 创建setupContext(setup函数二号参数)
export const createSetupContext = (
  instance: ComponentInternalInstance
): SetupContext => {
  const expose: SetupContext['expose'] = (exposed) => {
    if (instance.exposed) {
      console.warn('请勿在同一个组件实例的setup中重复调用expose');
    }
    // 设置响应式代理, 外部访问时依然可以进行依赖收集
    instance.exposed = proxyRefs(exposed);
  };
  return {
    attrs: instance.attrs,
    slots: instance.slots,
    emit: instance.emit,
    expose
  };
};

function setupStatefulComponent(instance: ComponentInternalInstance) {
  const Component = instance.type as ComponentOptions;
  // TODO 校验组件名称

  // 1. 创建渲染代理的属性访问缓存(初始值为无原型空数组)
  instance.accessCache = Object.create(null);
  // 2. 创建公开的渲染上下文代理
  instance.proxy = new Proxy(instance.ctx, PublicInstanceProxyHandlers);
  // 3. 执行setup
  const { setup } = Component;
  if (setup) {
    // 执行setup
    // 如果setup使用了第二个参数, 则创建一个 setupContext, 后续会注入到setup中
    const setupContext = (instance.setupContext =
      setup.length > 1 ? createSetupContext(instance) : null);
    // 设置当前实例
    setCurrentInstance(instance);
    // 暂停依赖收集
    // ? setup执行期间不应进行依赖收集, render函数中使用时会访问对应的响应式变量再触发依赖收集操作
    pauseTracking();
    // 触发setup
    // ? 此处需要考虑用户传入的setup会执行出错, 但这个出错不应阻塞框架运行
    const setupResult = callWithErrorHandling(
      setup,
      ErrorCodes.SETUP_FUNCTION,
      [instance.props, setupContext]
    );
    // 恢复依赖收集
    resetTracking();
    // 还原当前实例对象
    setCurrentInstance(null);
    if (isPromise(setupResult)) {
      // TODO 暂不处理异步组件
      console.warn('暂不支持异步组件');
    } else {
      // 处理setup执行结果
      handleSetupResult(instance, setupResult);
    }
  } else {
    // 完成组件实例设置
    finishComponentSetup(instance);
  }
}

// 标准化setup执行结果, 可能是对象, 也可能是render函数
export function handleSetupResult(
  instance: ComponentInternalInstance,
  setupResult: unknown
): void {
  if (isFunction(setupResult)) {
    // setup返回渲染函数
    instance.render = setupResult as InternalRenderFunction;
  } else if (isObject(setupResult)) {
    if (isVNode(setupResult)) {
      console.warn('setup返回值应该是渲染函数而不是一个VNode对象');
    }
    // 将返回值转变为响应式对象
    instance.setupState = proxyRefs(setupResult);
  } else if (setupResult !== undefined) {
    // setup存在, 但是返回值有问题, 抛错处理
    console.warn(
      `setup函数应该返回一个对象或者渲染函数, 此时为: ${
        setupResult === null ? 'null' : typeof setupResult
      }`
    );
  }
  finishComponentSetup(instance);
}

// 对标准化后的setupResult进一步处理, 保证组件的render正常执行
export function finishComponentSetup(instance: ComponentInternalInstance) {
  const Component = instance.type as ComponentOptions;
  if (Component.render) {
    // 组件上存在render配置
    // ? 断言, ComponentInternalInstance.render属性为 InternalRenderFunction
    // ? 但是 ComponentOptions.render为了防止ts抛错, 使用的是Function
    instance.render = Component.render as InternalRenderFunction;
  } else if (!instance.render) {
    // 运行时编译
    // ! 这里不应直接引入compile-core的逻辑, 编译逻辑只需要在构建时使用即可, 无需在运行时跑编译, 如果没有经过注册事件注册compile, 那么此处没有compile方法
    if (compiler && Component.template && !Component.render) {
      // ? 必须存在compiler编译器和template, 并且用户没有手写的render函数, 否则以手写的render函数为最高优先级
      if (Component.template) {
        Component.render = compiler(Component.template);
      }
    }
    instance.render = (Component.render || NOOP) as InternalRenderFunction;
  }

  // TODO 兼容Vue2
  // currentInstance = instance
  // pauseTracking()
  // applyOptions(instance, Component)
  // resetTracking()
  // currentInstance = null

  // 无render抛错
  if (!Component.render && instance.render === NOOP) {
    /* istanbul ignore if */
    if (!compiler && Component.template) {
      // 没有compile函数, 但是有template模板, 开发环境抛错
      console.warn('请在runtime-only的版本需提前编译template');
    } else {
      // 无template也没有render, 开发环境抛错
      console.warn(`组件缺少render或template`);
    }
  }
}
