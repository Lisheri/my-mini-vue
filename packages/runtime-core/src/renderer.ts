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
  Data,
  setupComponent
} from './component';
import { CreateAppFunction, createAppAPI } from './apiCreateApp';
import { ShapeFlags } from './shapeFlags';
import {
  renderComponentRoot,
  shouldUpdateComponent
} from './componentRenderUtils';
import { effect, stop } from '@mini-vue/reactivity';
import { isReservedProp, EMPTY_OBJ, EMPTY_ARR } from '@mini-vue/shared';
import { updateProps } from './componentProps';
import { updateSlots } from './componentSlots';
import {
  queueJob,
  flushPostFlushCbs,
  invalidateJob,
  flushPreFlushCbs,
  queuePostFlushCb
} from './scheduler'
export interface RendererNode {
  [key: string]: any;
}

type PatchFn = (
  n1: VNode | null,
  n2: VNode,
  container: RendererElement,
  anchor?: RendererNode | null,
  parentComponent?: ComponentInternalInstance | null
) => void;

// 卸载方法
type UnmountFn = (
  vnode: VNode,
  parentComponent: ComponentInternalInstance | null,
  doRemove?: boolean
) => void;

type RemoveFn = (vnode: VNode) => void;

// 移动子节点
type MoveFn = (
  vnode: VNode,
  container: RendererElement,
  anchor: RendererNode | null
  // TODO 暂不需要moveType, 用于处理transition
  // type: MoveType
) => void

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

export type UnmountChildrenFn = (
  children: VNode[], // 儿子
  parentComponent: ComponentInternalInstance | null, // 爹
  doRemove?: boolean, // 是否移除
  start?: number // 开始位置
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
  scheduler: queueJob,
  // 组件渲染的effect需支持递归更新
  allowRecurse: true
};


export const enum MoveType {
  ENTER,
  LEAVE,
  REORDER
}

export const queuePostRenderEffect = queuePostFlushCb;

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
    remove: hostRemove,
    patchProp: hostPatchProp,
    forcePatchProp: hostForcePatchProp,
    createElement: hostCreateElement,
    createText: hostCreateText,
    createComment: hostCreateComment,
    setText: hostSetText,
    setElementText: hostSetElementText,
    parentNode: hostParentNode,
    nextSibling: hostNextSibling
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
    // * 这里要处理带有flush: true的watch, 需要再render触发前触发其绑定的watcher
    flushPreFlushCbs(undefined, instance.update);
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
        let { next, vnode } = instance;
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

  /**
   * diff核心
   * 主流程如下:
   * TODO 暂不处理patchFlag
   * + 1. 直接判断是否处理fragment
   * + 2. 如果有, 则处理fragment
   * + 3. 接着处理非fragment的子节点, 共三种情况, 数组、文本节点和空节点
   *  - 1. 如果当前节点是文本节点, 之前是数组, 则删除原有子节点
   *  - 2. 如果当前节点是文本节点, 之前是文本, 且两个文本内容不等, 则直接更新文本内容, 替换新的文本
   *  - 3. 如果之前子节点是数组, 新的子节点还是数组, 则执行 patchKeyedChildren, 做完整的diff流程, 和更新带key的fragment类似(这是最复杂的情况)
   *  - 4. 如果之前子节点是数组, 新的子节点是文本或者空节点, 则删除原有子节点
   *  - 5. 如果之前子节点是文本或者空, 新的子节点是空节点, 则将原有文本信息设置为空字符串(不管原来是文本还是空节点, 现在是空的都更新成空的)
   *  - 6. 如果之前子节点是文本或空, 新的子节点是数组, 则挂载新的子节点
   * @param n1 旧的vnode
   * @param n2 新的vnode
   * @param container 容器
   * @param anchor 挂载锚点
   * @param parentComponent 爹
   */
  const patchChildren: PatchChildrenFn = (
    n1,
    n2,
    container,
    anchor,
    parentComponent
  ) => {
    // 旧的儿子节点
    const c1 = n1 && n1.children;
    // 旧vnode的shapeFlag
    const prevShapeFlag = n1 ? n1.shapeFlag : 0;
    // 新的儿子节点
    const c2 = n2 && n2.children;
    const { shapeFlag } = n2;
    // TODO 暂不考虑patchFlag直接处理fragment的情况
    // * 除此之外, 还有三种情况, 分别是: 文本, 数组, 空
    if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
      if (prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
        // 数组 -> 文本 删除之前所有儿子
        unmountChildren(c1 as VNode[], parentComponent);
      }
      if (c1 !== c2) {
        // 文本节点不同, 则对文本节点更新, 也就是替换文本
        hostSetElementText(container, c2 as string);
      }
    } else {
      if (prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
        if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
          // 完整diff
          patchKeyedChildren(
            c1 as VNode[],
            c2 as VNodeArrayChildren,
            container,
            anchor,
            parentComponent
          );
        } else {
          // 非数组的单节点(文本和空节点均为单节点), 直接移除原有儿子们
          unmountChildren(c1 as VNode[], parentComponent, true);
        }
      } else {
        // 之前的儿子节点是空节点或文本节点
        // 新的儿子节点是数组或者空
        if (prevShapeFlag & ShapeFlags.TEXT_CHILDREN) {
          // 之前是文本节点, 一定要清空文本(空节点不需处理, 直接进下一步判断)
          hostSetElementText(container, '');
        }
        if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
          // 直接挂载新的子节点
          // ? 旧节点要么是空要么是文本, 文本在上面清空了
          mountChildren(
            c2 as VNodeArrayChildren,
            container,
            anchor,
            parentComponent
          );
        }
      }
    }
  };

  /**
   * 带key的完整diff
   * @param c1 旧儿子节点
   * @param c2 新儿子节点
   * @param container 容器
   * @param parentAnchor 父级挂载锚点
   * @param parentComponent 爹
   */
  const patchKeyedChildren = (
    c1: VNode[],
    c2: VNodeArrayChildren, // 可能其中有一些不是vnode, 而是单纯的多文本节点
    container: RendererElement,
    parentAnchor: RendererNode | null,
    parentComponent: ComponentInternalInstance | null
  ): void => {
    // 开始节点
    let i = 0;
    // 新子节点长度
    const l2 = c2.length;
    // 旧子节点尾部索引
    let e1 = c1.length - 1;
    // 新子节点尾部索引
    let e2 = c2.length - 1;
    // 1. 从新旧子节点数组头部开始同步
    while (i <= e1 && i <= e2) {
      const n1 = c1[i];
      const n2 = (c2[i] = normalizeVNode(c2[i]));
      if (isSameVNodeType(n1, n2)) {
        // 无锚点, 相同节点递归patch更新
        patch(n1, n2, container, null, parentComponent);
      } else {
        break;
      }
      i++;
    }
    // 2. 新旧子节点数组尾部同步
    while (i <= e1 && i <= e2) {
      const n1 = c1[e1];
      const n2 = (c2[e2] = normalizeVNode(c2[e2]));
      if (isSameVNodeType(n1, n2)) {
        patch(n1, n2, container, null, parentComponent);
      } else {
        // 直到节点不同
        break;
      }
      // 尾部往前
      e1--;
      e2--;
    }

    // 3.挂载节点剩余部分
    if (i > e1) {
      if (i <= e2) {
        // ? 旧的儿子节点先遍历完, 还有多余新的儿子节点
        const nextPos = e2 + 1;
        // 计算挂载锚点
        // ? nextPos 最多就和l2相等, 如果相等其实也是说明插入到最后一个即可, 所以用parentAnchor作为锚点即可
        const anchor = nextPos < l2 ? (c2[nextPos] as VNode).el : parentAnchor;
        while (i <= e2) {
          patch(
            null,
            (c2[i] = normalizeVNode(c2[i])),
            container,
            anchor,
            parentComponent
          );
          // 继续往后挂载所有未挂载的节点
          i++;
        }
      }
    }
    // 4.删除多余节点
    else if (i > e2) {
      while (i <= e1) {
        unmount(c1[e1], parentComponent, true);
        i++;
      }
    }
    // 5.处理未知子序列
    else {
      // 旧的儿子节点当前处理的开始位置
      const s1 = i;
      // 新的儿子节点当前处理的开始位置
      const s2 = i;
      // 5.1 存储剩余所有未操作的新的儿子所在序列的索引(key, 此索引从0开始)
      const keyToNewIndexMap: Map<string | number, number> = new Map();
      for (i = s2; i <= e2; i++) {
        const nextChild = (c2[i] = normalizeVNode(c2[i]));
        if (nextChild.key != null) {
          if (keyToNewIndexMap.has(nextChild.key)) {
            // 存在重复未处理的key
            console.warn(`key: ${nextChild.key}重复, 请确保key的唯一`);
          }
          // key进入 keyToNewIndexMap中存储起来, 标识数组中的vnode未处理
          keyToNewIndexMap.set(nextChild.key, i);
        }
      }

      // 5.2 判断是否存在移动节点, 正序遍历旧子序列, 找到匹配的节点更新, 删除不在新子序列中的节点
      let j;
      let patched = 0; // 新子序列中已更新的vnode数量
      const toBePatched = e2 - s2 + 1; // 新子序列中已处理过的节点数量(结尾 - 当前位置 + 1即可)
      let moved; // 是否需要存在移动节点的标识
      // 用于跟踪判断节点的位置
      // ? 其值一直等于当前旧子节点在新子序列中的位置(除非移动, 否则一直递增)
      let maxNewIndexSoFar = 0;
      // 用于存储新子节点在旧子序列中的位置索引(从1开始, 0为默认值, 表示没有出现在旧子序列中过)
      const newIndexToOldIndexMap = new Array(toBePatched);
      // 初始化 newIndexToOldIndexMap, 从0开始(这个很重要, 因为是数组, 同时也牵扯到后面快速确认当前新子节点记录在这个map的哪个位置)
      for (i = 0; i < toBePatched; i++) newIndexToOldIndexMap[i] = 0;
      // 正序遍历旧子序列
      for (i = s1; i <= e1; i++) {
        const prevChild = c1[i];
        if (patched >= toBePatched) {
          // 处理完成, 还有剩余, 说明都需要移除
          unmount(prevChild, parentComponent, true);
          continue;
        }
        let newIndex; // 当前旧子节点(prevChild)在新子序列中的位置
        if (prevChild.key != null) {
          // 直接从 keyToNewIndexMap 查找旧子节点在新子序列中的索引即可
          newIndex = keyToNewIndexMap.get(prevChild.key);
        } else {
          // 若没有key, 则推断一个当前旧子节点可能存在于新子序列中的索引
          // 其实就是找一个没有存储在 newIndexToOldIndexMap 中, 并且索引对应的节点和prevChild又是一个sameVNode的新子节点对应的索引
          for (j = s2; j <= e2; j++) {
            // j - s2确保 newIndexToOldIndexMap这个数组中的索引从0开始
            if (
              newIndexToOldIndexMap[j - s2] === 0 &&
              isSameVNodeType(prevChild, c2[j] as VNode)
            ) {
              // 找到一个即可退出循环
              newIndex = j;
              break;
            }
          }
        }
        if (newIndex === undefined) {
          // 没有找到newIndex, 说明当前旧子节点已在新子序列中被删除, 移除即可
          unmount(prevChild, parentComponent, true);
        } else {
          // 找到则说明旧子节点需要更新, 执行更新操作
          // 更新新子节点在旧子序列中的索引
          // ? newIndex表示当前旧子节点在新子序列中的索引
          // ? newIndex - s2计算当前新子节点存储在 newIndexToOldIndexMap 这个数组上的准确位置, 因为数组初始化从0开始的, 而newIndex从s2开始
          // ? i + 1防止0影响 新子节点在newIndexToOldIndexMap 这个判断, 同时 newIndexToOldIndexMap 存储的索引约定从1开始
          newIndexToOldIndexMap[newIndex - s2] = i + 1;
          if (newIndex >= maxNewIndexSoFar) {
            // 一直增加则说明没有移动过, 新旧子序列是统一的
            // 赋值更新 maxNewIndexSoFar 
            maxNewIndexSoFar = newIndex;
          } else {
            // ? 当前newIndex(前旧子节点在新子序列中的索引)比上一个vnode所在新子序列中的索引更靠前, 说明当前旧子节点移动过
            // ? 因为遍历是正序遍历的, 若无移动 maxNewIndexSoFar 一定是递增的, 不会存在比newIndex小的情况
            moved = true;
          }
          // 更新
          patch(
            prevChild,
            c2[newIndex] as VNode,
            container,
            null,
            parentComponent
          );
          // 更新了一个新节点, 需要将更新节点数 + 1, 以便于判断旧子节点是否需要移除
          patched++;
        }
      }

      // 5.3 挂载和移动新节点
      // ? 仅当节点移动时生成最长递增子序列
      const increasingNewIndexSequence = moved ? getSequence(newIndexToOldIndexMap) : EMPTY_ARR;
      
      // 最长递增子序列末尾index
      j = increasingNewIndexSequence.length - 1;
      // 倒序遍历以便可以使用最后更新的节点作为锚点
      for (i = toBePatched - 1; i >= 0; i--) {
        const nextIndex = s2 + i;
        const nextChild = c2[nextIndex] as VNode;
        const anchor = nextIndex + 1 < l2 ? (c2[nextIndex + 1] as VNode).el : parentAnchor;
        if (newIndexToOldIndexMap[i] === 0) {
          // 挂载新节点
          patch(null, nextChild, container, anchor, parentComponent);
        } else if (moved) {
          // 没有最长递增子序列（reverse 的场景）或者当前的节点索引不在最长递增子序列中，需要移动
          if (j < 0 || i !== increasingNewIndexSequence[j]) {
            // 此时知道当前节点的后一位应该谁(锚点), 也知道当前节点应该在的位置(nextIndex)
            // 所以直接将旧子序列中的节点移动到上面求出来的两个位置即可, 也就是nextIndex处, 锚点之前(无锚点就是最后一位)
            // TODO 暂不传入moveType, 用于处理transition
            move(nextChild, container, anchor);
          } else {
            j--;
          }
        }
      }
    }
  };

  const move: MoveFn = (
    vnode,
    container,
    anchor,
  ) => {
    const { el, type, shapeFlag, children } = vnode;
    if (shapeFlag & ShapeFlags.COMPONENT) {
      // 组件移动
      move(vnode.component!.subTree, container, anchor);
      return;
    }
    // Fragment整体移动
    if (type === Fragment) {
      // 插入当前el
      hostInsert(el!, container, anchor);
      for (let i = 0; i < (children as VNode[]).length; i++) {
        // 一个一个移动
        const child = (children as VNode[])[i];
        move(child, container, anchor);
      }
      // 插入锚点(其实就是前后的空节点)
      hostInsert(vnode.anchor!, container, anchor);
      return;
    }
    // 普通节点, 直接插入到对应的位置即可
    hostInsert(el!, container, anchor);
  }

  /**
   * 处理element更新, 只做两件事:
   * 1. 通过patchProps 更新DOM节点的class, style, event以及其他的一些DOM属性
   * 2. 通过 完整的 dom diff更新子节点, 也就是 patchChildren
   * @param n1 旧vnode节点
   * @param n2 新vnode节点
   * @param parentComponent 爹
   */
  const patchElement = (
    n1: VNode,
    n2: VNode,
    parentComponent: ComponentInternalInstance | null
  ): void => {
    // 获取现有dom元素
    const el = (n2.el = n1.el!);
    const oldProps = n1.props || EMPTY_OBJ;
    const newProps = n2.props || EMPTY_OBJ;
    // TODO 触发vnode的 onVnodeBeforeUpdate生命周期钩子
    // TODO 根据指令触发指令的beforeUpdate钩子
    // TODO 暂不处理根据匹配不同的patchFlag执行不同的props优化更新逻辑
    // ? 由于没有patchFlag, 这里直接做完整的props diff
    patchProps(el, n2, oldProps, newProps, parentComponent);
    // TODO 暂无block处理动态children更新, 这里做完整的 dom diff
    patchChildren(n1, n2, el, null, parentComponent);
  };

  /**
   * 更新props
   * @param el 真实dom节点
   * @param vnode 新的vnode
   * @param oldProps 旧的props信息
   * @param newProps 新的props信息
   * @param parentComponent 容器组件
   */
  const patchProps = (
    el: RendererElement,
    vnode: VNode,
    oldProps: Data,
    newProps: Data,
    parentComponent: ComponentInternalInstance | null
  ) => {
    // props前后不是同一指向说明发生了变化
    if (oldProps !== newProps) {
      for (const key in newProps) {
        if (isReservedProp(key)) continue;
        const nextProp = newProps[key];
        const prevProp = oldProps[key];
        if (
          nextProp !== prevProp ||
          (hostForcePatchProp && hostForcePatchProp(el, key))
        ) {
          // 属性有变化或强制更新的属性(value)调用patchProp对style, class, event, attrs, 以及dom上的属性进行更新
          hostPatchProp(
            el,
            key,
            prevProp,
            nextProp,
            vnode.children as Array<VNode>,
            parentComponent,
            unmountChildren
          );
        }
      }
      if (oldProps !== EMPTY_OBJ) {
        // 旧的props非空则需处理已移除的属性
        for (const key in oldProps) {
          if (!isReservedProp(key) && !(key in newProps)) {
            // 需要移除
            hostPatchProp(
              el,
              key,
              oldProps[key],
              null,
              vnode.children as Array<VNode>,
              parentComponent,
              unmountChildren
            );
          }
        }
      }
    }
  };

  const updateComponent = (n1: VNode, n2: VNode): void => {
    const instance = (n2.component = n1.component)!;
    if (shouldUpdateComponent(n1, n2)) {
      // 需要更新
      // TODO 暂不考虑异步组件, 对异步组件而言, 渲染用effect还没有设置, 因此只需要更新props和slots即可
      // * 此处为常规组件更新
      // 新的组件vnode直接赋值给next
      instance.next = n2;
      // * 处理更新队列问题, 子组件可能因数据变化被加入到更新队列中, 这里需要移除, 防止重复更新
      invalidateJob(instance.update)
      // ? 经过派发更新触发时, 还没有next, 上面更新完成next后重新执行, 在进入更新逻辑
      // 再次执行组件更新函数
      instance.update();
    } else {
      // 如果不需要更新, 直接赋值即可
      n2.component = n1.component;
      n2.el = n1.el;
      instance.vnode = n2;
    }
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

  // 卸载儿子们
  const unmountChildren: UnmountChildrenFn = (
    children,
    parentComponent,
    doRemove = false,
    start = 0
  ) => {
    // 其实就是遍历儿子们然后依次调用卸载
    for (let i = start; i < children.length; i++) {
      // 也会递归卸载儿子的儿子们
      unmount(children[i], parentComponent, doRemove);
    }
  };

  const unmount: UnmountFn = (vnode, parentComponent, doRemove) => {
    // TODO 暂不处理ref, 动态节点, patchFlag, keepalive
    const { type, children, shapeFlag } = vnode;

    // TODO 调用onVnodeBeforeUnmount
    if (shapeFlag & ShapeFlags.COMPONENT) {
      // 卸载组件, 这里也会递归调用unmount, 去移除组件内部的子节点等
      unmountComponent(vnode.component!, doRemove);
    } else {
      // TODO 暂不处理动态节点, 指令和patchFlag
      if (type === Fragment || shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
        // Fragment或数组子节点, 直接全都移除
        unmountChildren(children as VNode[], parentComponent);
      }
      if (doRemove) {
        remove(vnode);
      }
    }
    // TODO 最后需要调用onVnodeUnmounted和unmounted(destroyed)
  };

  /**
   * 移除节点
   * @param vnode 虚拟节点
   */
  const remove: RemoveFn = (vnode) => {
    const { el, type, anchor } = vnode;
    if (type === Fragment) {
      removeFragment(el!, anchor!);
    }
    // TODO 暂不考虑patchFlag
    const performRemove = () => {
      hostRemove(el!);
    };
    performRemove();
  };

  const removeFragment = (cur: RendererNode, end: RendererNode) => {
    // 对于 fragment, 移除所有包含的节点
    let next;
    while (cur !== end) {
      next = hostNextSibling(cur)!;
      hostRemove(cur);
      cur = next;
    }
    hostRemove(end);
  };

  /**
   * 卸载组件
   * @param instance 当前组件实例
   * @param doRemove 是否执行移除
   */
  const unmountComponent = (
    instance: ComponentInternalInstance,
    doRemove?: boolean
  ) => {
    const { effects, update, subTree } = instance;
    // TODO 调用beforeUnMounted
    if (effects) {
      // 当前实例上有收集的依赖, 需要停止所有依赖的进入更新队列后触发
      effects.forEach((eft) => {
        stop(eft);
      });
    }
    if (update) {
      // 移除updateEffect
      stop(update);
      // 移除subTree
      unmount(subTree, instance, doRemove);
    }
    // TODO 调用 UnMounted
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
    // TODO 可根据patchFlag对可复用节点进行直接复制
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
    // 微队列执行后置任务
    flushPostFlushCbs();
    // 缓存vnode节点(占位节点), 表示已经渲染
    container._vnode = vnode;
  };

  return {
    render,
    createApp: createAppAPI(render)
  };
}

/**
 * 获取最长递增子序列
 * @param arr 新子节点在旧子序列中对应的索引
 * @return 最长递增子序列
 * 求解方法为 二分查找+回溯
 * https://zh.wikipedia.org/wiki/%E6%9C%80%E9%95%BF%E9%80%92%E5%A2%9E%E5%AD%90%E5%BA%8F%E5%88%97
 */
function getSequence(arr: number[]): number[] {
  // 用于存储当前索引进入递增子序列result时, 当前索引所在result中的前一位
  const p = arr.slice();
  const result = [0];
  let i, j, u, v, c;
  const len = arr.length;
  for (i = 0; i < len; i++) {
    // 正序遍历
    const arrI = arr[i];
    if (arrI !== 0) {
      j = result[result.length - 1];
      if (arr[j] < arrI) {
        // 当前值满足需求, 可进入递增子序列
        p[i] = j;
        result.push(i);
        continue;
      }
      // 当前值小于等于子序列末尾, 说明需要插入到前面, 使用二分查找快速确认插入位置
      u = 0;
      v = result.length - 1;
      while(u < v) {
        c = ((u + v) / 2) | 0;
        if (arr[result[c]] < arrI) {
          // 当前值大于中值, 往中值之后继续查找插入点
          u = c + 1;
        } else {
          // 当前值小于或等于中值, 往中值之前继续查找插入点
          v = c;
        }
      }
      // 最终找到一个插入点(也就是得到的中值: arr[result[u - 1]])
      if (arrI < arr[result[u]]) {
        // ? 中值的下一位必须大于当前值, 否则当前值不能插入到u - 1的位置
        // ? 中值的下一位若小于等于当前值, 则不需要插入了
        // ? 此时 u 为 c + 1; 也就是中值下一个, 在中值 arr[result[c]] 已经比当前值小的情况下, 他的的下一位(比中值大)若与当前值相等, 则无需更新当前值, 更新也无效
        // ? 此时若中值下一位比arrI小, 则不应该替换中值, 否则无法确认递增
        if (u > 0) {
          p[i] = result[u - 1];
        }
        result[u] = i;
      }
    }
  }
  u = result.length;
  v = result[u - 1];
  // 回溯
  while(u-- > 0) {
    result[u] = v;
    v= p[v];
  }
  return result;
}
