import {
  VNode,
  isSameVNodeType,
  normalizeVNode,
  VNodeArrayChildren,
  Fragment,
  Comment,
  Text
} from './vnode';
import {
  ComponentInternalInstance,
  createComponentInstance,
  setupComponent
} from './component';
import { CreateAppFunction, createAppAPI } from './apiCreateApp';
import { ShapeFlags } from './shapeFlags';
import { renderComponentRoot } from './componentRenderUtils';
import { effect } from '@mini-vue/reactivity';
import { isReservedProp } from '@mini-vue/shared';
import { updateProps } from './componentProps';
import { updateSlots } from './componentSlots';
export interface RendererNode {
  [key: string]: any;
}

type PatchFn = (
  n1: VNode | null,
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

type MountChildrenFn = (
  children: VNodeArrayChildren,
  container: RendererElement,
  anchor: RendererNode | null,
  parentComponent: ComponentInternalInstance | null,
  start?: number
) => void;

export type SetupRenderEffectFn = (
  instance: ComponentInternalInstance,
  initialVNode: VNode,
  container: RendererElement,
  anchor: RendererNode | null
) => void;

type NextFn = (vnode: VNode) => RendererNode | null;

// diff
type PatchChildrenFn = (
  n1: VNode | null, // 旧vnode
  n2: VNode, // 新vnode
  container: RendererElement, // 容器
  anchor: RendererNode | null, // 锚点
  parentComponent: ComponentInternalInstance | null // 爹
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

type ProcessTextOrCommentFn = (
  n1: VNode | null,
  n2: VNode,
  container: RendererElement,
  anchor: RendererNode | null
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

// 创建渲染器(根据不同的options， 去适配不同的平台)
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
    insert: hostInsert,
    // remove: hostRemove,
    patchProp: hostPatchProp,
    // forcePatchProp: hostForcePatchProp,
    createElement: hostCreateElement,
    createText: hostCreateText,
    createComment: hostCreateComment,
    setText: hostSetText,
    setElementText: hostSetElementText,
    parentNode: hostParentNode,
    nextSibling: hostNextSibling
    // setScopeId: hostSetScopeId = NOOP,
    // cloneNode: hostCloneNode,
    // insertStaticContent: hostInsertStaticContent
  } = options;

  /**
   * 在render触发更新前去处理组件vnode信息的更新
   * @param instance 当前组件实例
   * @param nextVNode {} 新的vnode
   */
  const updateComponentPreRender = (
    instance: ComponentInternalInstance,
    nextVNode: VNode
  ) => {
    // 新的组件vnode的component属性指向原有的instance, 不需要重新创建instance实例
    nextVNode.component = instance;
    // 缓存旧组件vnode的props属性
    const prevProps = instance.vnode.props;
    // 当前实例上的vnode指向新的vnode
    instance.vnode = nextVNode;
    // 清空next属性, 为下一次更新准备
    instance.next = null;
    // * 更新props属性
    updateProps(instance, nextVNode.props, prevProps);
    // * 更新插槽属性
    updateSlots(instance, nextVNode.children);
    // TODO 这里要处理带有flush: true的watch, 需要再render触发前触发其绑定的watcher
  };

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
        // 将当前实例的vnode.el指向创建的subTree的el属性, 便于后续访问(mounted周期以后可以获取到真实DOM节点)
        // ? patch是一个自顶向下深度递归的过程, 因此最外层patch执行完毕后, 内层所有元素也patch完成了
        // ? 所以到此处, 便可以将vnode.el指向创建的el, 也就是真实DOM节点, 同时这里也可以看出, mounted的执行, 是先子后爹, 自内向外的
        // ? 同级子节点的mounted也是按顺序执行
        initialVNode.el = subTree.el;
        // TODO 到此, 所有的element处理完成 执行 mounted 钩子
        // TODO 执行 VNode 的 onVnodeMounted 钩子
        // ! 暂不处理keepalive的activated和suspense等预制组件
        // 标记挂载
        instance.isMounted = true;
      } else {
        // TODO 更新操作
        console.info('update');
        let { next, bu, u, parent, vnode } = instance;
        let originNext = next;
        // 判断组件实例中是否存在新的组件vnode
        if (next) {
          // 存在则更新vnode即可
          next.el = vnode.el;
          // 更新vnode节点信息
          updateComponentPreRender(instance, next);
        } else {
          // next不存在则直接指向原有vnode
          next = vnode;
        }
        // TODO beforeUpdate生命周期触发
        // TODO 触发VNode上的 onVnodeBeforeUpdate
        // 渲染新的子树vnode
        const nextTree = renderComponentRoot(instance);
        // 缓存旧的子树vnode
        const prevTree = instance.subTree;
        // 更新
        instance.subTree = nextTree;
        // 新旧子树patch(核心)
        patch(
          prevTree,
          nextTree,
          // 所以容器直接找旧树DOM元素的父节点, 这里主要是考虑teleport
          // ? 虽然未实现teleport, 但此处可以先占位, 逻辑是一样的
          hostParentNode(prevTree.el!)!,
          // ? 参考节点(锚点)在fragment的情况可能改变, 所以直接找旧树DOM元素的下一个节点
          getNextHostNode(prevTree),
          instance
        );
        // 缓存更新后的DOM节点
        next.el = nextTree.el;
        // TODO updated钩子
        // TODO onVNodeUpdated钩子
      }
    }, effectOptions);
  };

  // diff核心
  const patchChildren: PatchChildrenFn = (
    n1,
    n2,
    container,
    anchor,
    parentComponent
  ) => {
    console.info('同级儿子diff')
  };

  const patchElement = (
    n1: VNode,
    n2: VNode,
    parentComponent: ComponentInternalInstance | null
  ): void => {
    console.info('element节点更新')
  }

  const updateComponent = (n1: VNode, n2: VNode): void => {
    console.info('updateComponent');
  }

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

  const unmountChildren = () => {
    console.info('卸载儿子们');
  };

  const mountChildren: MountChildrenFn = (
    children,
    container,
    anchor,
    parentComponent,
    // ? 考虑到后续diff优化, 这里不一定是从开头开始遍历
    start = 0 // 开始位置
  ) => {
    for (let i = start; i < children.length; i++) {
      const child = (children[i] = normalizeVNode(children[i]));
      patch(null, child, container, anchor, parentComponent);
    }
  };

  const mountElement = (
    vnode: VNode,
    container: RendererElement,
    anchor: RendererNode | null,
    parentComponent: ComponentInternalInstance | null
  ) => {
    let el: RendererElement;
    const { props, shapeFlag } = vnode;
    // 创建节点
    el = vnode.el = hostCreateElement(vnode.type as string, props && props.is);

    if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
      // 处理文本节点
      hostSetElementText(el, vnode.children as string);
    } else if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
      // 处理多个儿子, 遍历递归调用patch
      mountChildren(
        vnode.children as VNodeArrayChildren,
        el,
        null,
        parentComponent
      );
    }

    // 处理props,  class, style, event等
    if (props) {
      for (const key in props) {
        // 过滤key, ref等内建属性和空字符串
        if (!isReservedProp(key)) {
          // 对需要处理的props进行处理
          hostPatchProp(
            el,
            key,
            null,
            props[key],
            vnode.children as VNode[],
            parentComponent,
            unmountChildren
          );
        }
      }
    }

    // 挂载dom元素到container上
    hostInsert(el, container, anchor);
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
      mountElement(n2, container, anchor, parentComponent);
    } else {
      // 更新元素
      // TODO 通过patchElement实现元素更新
      patchElement(n1, n2, parentComponent);
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
      // 组件更新
      updateComponent(n1, n2);
    }
  };

  /**
   * 处理文本节点
   * @param n1 旧节点
   * @param n2 新节点
   * @param container 容器节点
   * @param anchor 锚点
   */
  const processText: ProcessTextOrCommentFn = (
    n1: VNode | null,
    n2: VNode,
    container: RendererElement,
    anchor: RendererNode | null = null
  ) => {
    if (n1 == null) {
      // 挂载
      hostInsert(
        (n2.el = hostCreateText(n2.children as string)),
        container,
        anchor
      );
    } else {
      // 更新
      const el = (n2.el = n1.el!);
      if (n2.children !== n1.children) {
        // 有发生变化
        hostSetText(el, n2.children as string);
      }
    }
  };

  /**
   * 处理注释节点
   * @param n1 旧节点
   * @param n2 新节点
   * @param container 容器节点
   * @param anchor 锚点
   */
  const processCommentNode: ProcessTextOrCommentFn = (
    n1,
    n2,
    container,
    anchor
  ) => {
    if (n1 == null) {
      hostInsert(
        (n2.el = hostCreateComment(n2.children as string)),
        container,
        anchor
      );
    } else {
      // 注释节点更新后还是注释节点
      n2.el = n1.el;
    }
  };

  /**
   * 处理fragment
   * @param {VNode | null} n1 旧vnode
   * @param {VNode} n2 新vnode
   * @param {RendererElement} container 容器
   * @param {RendererNode | null} anchor 挂载锚点
   * @param {ComponentInternalInstance} parentComponent 父组件
   */
  const processFragment = (
    n1: VNode | null,
    n2: VNode,
    container: RendererElement,
    anchor: RendererNode | null = null,
    parentComponent: ComponentInternalInstance | null = null
  ) => {
    const fragmentStartAnchor = (n2.el = n1 ? n1.el : hostCreateText(''))!;
    const fragmentEndAnchor = (n2.anchor = n1
      ? n1.anchor
      : hostCreateText(''))!;
    if (n1 == null) {
      // 挂载
      // ? 首次挂载时, 需要先插入一个 Fragment, 也就是一个Text节点(其实就是占位)
      hostInsert(fragmentStartAnchor, container, anchor);
      hostInsert(fragmentEndAnchor, container, anchor);
      // 挂载子节点, 只能是数组
      mountChildren(
        n2.children as VNodeArrayChildren,
        container,
        fragmentEndAnchor,
        parentComponent
      );
    } else {
      // TODO 前置考虑patchFlag优化diff
      // 直接diff更新
      patchChildren(n1, n2, container, anchor, parentComponent);
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
    const { type, shapeFlag } = n2;
    // 处理Fragment和Text
    switch (type) {
      case Text:
        // 处理文本节点
        processText(n1, n2, container, anchor);
        break;
      case Comment:
        processCommentNode(n1, n2, container, anchor);
        break;
      case Fragment:
        processFragment(n1, n2, container, anchor, parentComponent);
        break;
      default:
        if (shapeFlag & ShapeFlags.ELEMENT) {
          // 处理element
          processElement(n1, n2, container, anchor, parentComponent);
        } else if (shapeFlag & ShapeFlags.COMPONENT) {
          // 处理组件
          processComponent(n1, n2, container, anchor, parentComponent);
        }
    }
  };

  // 寻找DOM元素的下一个节点
  const getNextHostNode: NextFn = (vnode) => {
    if (vnode.shapeFlag & ShapeFlags.COMPONENT) {
      // 组件的subTree才是他的虚拟DOM树
      return getNextHostNode(vnode.component!.subTree);
    }
    // TODO 处理 SUSPENSE
    // 返回节点的兄弟元素(nextSibling)
    return hostNextSibling((vnode.anchor || vnode.el)!);
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
