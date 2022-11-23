import { VNode, isSameVNodeType } from './vnode';
import {
  ComponentInternalInstance,
  createComponentInstance,
  setupComponent
} from './component';
import { CreateAppFunction, createAppAPI } from './apiCreateApp';
import { ShapeFlags } from './shapeFlags';
import { renderComponentRoot } from './componentRenderUtils';
import { effect } from '@mini-vue/reactivity';
// import { NOOP } from '@mini-vue/shared';
export interface RendererNode {
  [key: string]: any;
}

type PatchFn = (
  n1: VNode | null, // null means this is a mount
  n2: VNode,
  container: RendererElement,
  anchor?: RendererNode | null,
  parentComponent?: ComponentInternalInstance | null,
  slotScopeIds?: string[] | null,
  optimized?: boolean
) => void;

export type MountComponentFn = (
  initialVNode: VNode,
  container: RendererElement,
  anchor: RendererNode | null,
  parentComponent: ComponentInternalInstance | null
) => void;

export type SetupRenderEffectFn = (
  instance: ComponentInternalInstance,
  initialVNode: VNode,
  container: RendererElement,
  anchor: RendererNode | null
) => void;

export interface RendererElement extends RendererNode {}

// 渲染器
export interface Renderer<HostElement = RendererElement> {
  render: RootRenderFunction<HostElement>;
  createApp: CreateAppFunction<HostElement>;
}

export type RootRenderFunction<HostElement = RendererElement> = (
  vnode: VNode | null,
  container: HostElement,
  isSVG?: boolean
) => void;

type UnmountChildrenFn = (
  children: VNode[],
  parentComponent: ComponentInternalInstance | null,
  doRemove?: boolean,
  optimized?: boolean,
  start?: number
) => void;

// 渲染器配置类型定义
export interface RendererOptions<
  HostNode = RendererNode,
  HostElement = RendererElement
> {
  patchProp(
    el: HostElement,
    key: string,
    prevValue: any,
    nextValue: any,
    isSVG?: boolean,
    prevChildren?: VNode<HostNode, HostElement>[],
    parentComponent?: ComponentInternalInstance | null,
    unmountChildren?: UnmountChildrenFn
  ): void;
  forcePatchProp?(el: HostElement, key: string): boolean;
  insert(el: HostNode, parent: HostElement, anchor?: HostNode | null): void;
  remove(el: HostNode): void;
  createElement(
    type: string,
    isSVG?: boolean,
    isCustomizedBuiltIn?: string
  ): HostElement;
  createText(text: string): HostNode;
  createComment(text: string): HostNode;
  setText(node: HostNode, text: string): void;
  setElementText(node: HostElement, text: string): void;
  parentNode(node: HostNode): HostElement | null;
  nextSibling(node: HostNode): HostNode | null;
  querySelector?(selector: string): HostElement | null;
  setScopeId?(el: HostElement, id: string): void;
  cloneNode?(node: HostNode): HostNode;
  insertStaticContent?(
    content: string,
    parent: HostElement,
    anchor: HostNode | null,
    isSVG: boolean
  ): HostElement[];
}

const effectOptions = {
  // TODO queueJob 为调度更新的关键
  // scheduler: queueJob,
  // 组件渲染的effect需支持递归更新
  allowRecurse: true
};

// 创建渲染器
export function createRenderer<
  HostNode = RendererNode,
  HostElement = RendererElement
>(options: RendererOptions<HostNode, HostElement>) {
  return baseCreateRenderer<HostNode, HostElement>(options);
}

// 后续可能会添加 Hydration(水合, 也就是填充数据), 所以这里使用泛型
function baseCreateRenderer<
  HostNode = RendererNode,
  HostElement = RendererElement
>(options: RendererOptions<HostNode, HostElement>): Renderer<HostElement>;
function baseCreateRenderer(options: RendererOptions): any {
  // 获取dom操作api, 以供后续流程使用
  const {
    // insert: hostInsert,
    // remove: hostRemove,
    // patchProp: hostPatchProp,
    // forcePatchProp: hostForcePatchProp,
    // createElement: hostCreateElement,
    // createText: hostCreateText,
    // createComment: hostCreateComment,
    // setText: hostSetText,
    // setElementText: hostSetElementText,
    // parentNode: hostParentNode,
    // nextSibling: hostNextSibling,
    // setScopeId: hostSetScopeId = NOOP,
    // cloneNode: hostCloneNode,
    // insertStaticContent: hostInsertStaticContent
  } = options;

  const setupRenderEffect: SetupRenderEffectFn = (
    instance,
    initialVNode,
    container,
    anchor
  ) => {
    // 核心是调用render, 获取一个subTree
    // vnode -> patch, 由patch方法做进一步处理
    // vnode -> element -> mountElement
    // 通过effect创建一个用于首次挂载和更新时的渲染函数(effect回调函数首次会直接触发)
    instance.update = effect(function componentEffect() {
      if (!instance.isMounted) {
        // 挂载操作
        // TODO 执行组件的 beforeMount 钩子
        // TODO 执行VNode的 onVnodeBeforeMount 钩子
        // 调用 renderComponentRoot 创建子树vnode
        const subTree = (instance.subTree = renderComponentRoot(instance));
        // TODO 不考虑 hydrateNode
        // 执行 patch 将子树vnode 挂载到 container 下
        patch(null, subTree, container, anchor, instance);
        // TODO 执行 mounted 钩子
        // TODO 执行 VNode 的 onVnodeMounted 钩子
        // ! 暂不处理keepalive的activated和suspense等预制组件
        // 标记挂载
        instance.isMounted = true;
      } else {
        // TODO 更新操作
      }
    }, effectOptions);
  };

  const mountComponent: MountComponentFn = (
    initialVNode,
    container,
    anchor,
    parentComponent
  ) => {
    // 1. 创建组件实例对象, 其中有对props和emits的标准化
    const instance: ComponentInternalInstance = (initialVNode.component =
      createComponentInstance(initialVNode, parentComponent));
    // 设置组件实例, 处理props, 插槽以及调用setup返回的值等
    setupComponent(instance);
    // 设置并运行带副作用的渲染函数
    setupRenderEffect(instance, initialVNode, container, anchor);
  };

  const processElement = (
    n1: VNode | null,
    n2: VNode,
    container: RendererElement,
    anchor: RendererNode | null = null,
    parentComponent: ComponentInternalInstance | null = null
  ) => {
    if (n1 == null) {
      // 没有旧节点, 则挂载元素
      // TODO 通过mountElement 实现元素挂载
      // mountElement(n2, container, anchor, parentComponent)
    } else {
      // 更新元素
      // TODO 通过patchElement实现元素更新
    }
  };

  /**
   *
   * @param {VNode | null} n1 旧vnode
   * @param {VNode} n2 新vnode
   * @param {RendererElement} container 容器
   * @param {RendererNode | null} anchor 挂载锚点
   * @param {ComponentInternalInstance} parentComponent 父组件
   */
  const processComponent = (
    n1: VNode | null,
    n2: VNode,
    container: RendererElement,
    anchor: RendererNode | null = null,
    parentComponent: ComponentInternalInstance | null = null
  ) => {
    if (n1 == null) {
      // n1不存在, 挂载组件
      // TODO 未处理keep-alive
      // 直接挂载
      mountComponent(n2, container, anchor, parentComponent);
    } else {
      // TODO updateComponent
    }
  };

  /**
   *
   * @param n1 旧的vnode
   * @param n2 新的vnode
   * @param container 容器(父节点)
   */
  const patch: PatchFn = (
    n1,
    n2,
    container,
    // 挂载锚点
    anchor = null,
    // 父组件
    parentComponent = null
  ) => {
    // 暂时只有component, 所以就先只处理Component即可
    if (n1 && !isSameVNodeType(n1, n2)) {
      // 如果旧的vnode存在, 并且和新的vnode不是相似节点, 说明旧节点应当被销毁
      // TODO 缺少unmount逻辑, 稍后实现
      n1 = null;
    }
    const { shapeFlag } = n2;
    if (shapeFlag & ShapeFlags.ELEMENT) {
      // 处理element
      processElement(n1, n2, container, anchor, parentComponent);
    } else if (shapeFlag & ShapeFlags.COMPONENT) {
      // 处理组件
      processComponent(n1, n2, container, anchor, parentComponent);
    }
  };
  /**
   *
   * @param vnode 虚拟节点
   * @param container 容器
   */
  const render: RootRenderFunction = (vnode, container) => {
    // ? 核心是调用patch方法, 主要是为了后续递归处理
    if (vnode == null) {
      // vnode不存在, 说明是组件卸载
      // TODO 组件卸载
    } else {
      // 挂载或更新流程
      patch(container._vnode || null, vnode, container, null, null);
    }
    // 缓存vnode节点(占位节点), 表示已经渲染
    container._vnode = vnode;
  };

  return {
    render,
    createApp: createAppAPI(render)
  };
}
