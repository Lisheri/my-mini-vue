import { NodeTypes, RootNode, TemplateChildNode } from './ats';
import { TransformOptions } from './options';
import { CREATE_ELEMENT_VNODE, TO_DISPLAY_STRING } from './runtimeHelpers';

export interface TransformContext
  extends Required<Omit<TransformOptions, 'filename'>> {
  root: RootNode;
  helpers: Set<symbol>; // 用于存储构建后引入的处理模块
  helper<T extends symbol>(name: T): T;
}

export type NodeTransform = (
  node: RootNode | TemplateChildNode,
  context: TransformContext
) => void | (() => void) | (() => void)[];

export function createTransformContext(
  root: RootNode,
  {
    // filename = '',
    prefixIdentifiers = false,
    nodeTransforms = [],
    inline = false,
    isTS = false
  }: TransformOptions
): TransformContext {
  const context: TransformContext = {
    root,
    prefixIdentifiers,
    nodeTransforms,
    inline,
    isTS,
    helpers: new Set(), // 防止重复, 用set数据结构
    helper(name) {
      context.helpers.add(name);
      return name;
    }
  };

  return context;
}

export function transform(root: RootNode, options: TransformOptions = {}) {
  // + 1. 遍历 - 深度优先搜索
  const context = createTransformContext(root, options);
  traverseNode(root, context);
  createRootCodegen(root);
  // 构建为render函数后的引入模块内容
  root.helpers = [...context.helpers];
}

function createRootCodegen(root: RootNode) {
  const child = root.children[0];
  if (child.type === NodeTypes.ELEMENT) {
    // 这里将element节点的codegenNode赋值给 根节点的 codegenNode, 方便后续处理
    // 那么element节点的children就变成了在transformElement中处理的 children[0]
    root.codegenNode = child.codegenNode;
  } else {
    root.codegenNode = child;
  }
}

// 深度优先搜索ast树
// 外部传入options控制内部程序的运行(类似插件的行为)
function traverseNode(
  node: RootNode | TemplateChildNode,
  context: TransformContext
) {
  // 取出options.nodeTransforms进行调用即可
  const nodeTransforms = context.nodeTransforms;
  const exitFns: any[] = [];
  for (let i = 0; i < nodeTransforms.length; i++) {
    // + 2. 修改 text content
    // ? 通过外部扩展
    // 存储插件执行完后退出函数
    const nodeTransform = nodeTransforms[i];
    const onExit = nodeTransform(node, context);
    onExit && exitFns.push(onExit);
  }

  switch (node.type) {
    case NodeTypes.INTERPOLATION:
      context.helper(TO_DISPLAY_STRING);
      break;
    case NodeTypes.ROOT:
    case NodeTypes.ELEMENT:
      // element和root都需要处理children
      context.helper(CREATE_ELEMENT_VNODE);
      traverseChildren(node, context);
      break;
    default:
      break;
  }

  // 当所有节点处理完毕后, 再次逆序执行插件退出方法, 可以让插件自行决定执行顺序
  let i = exitFns.length;
  while (i--) {
    exitFns[i]();
  }
}

function traverseChildren(
  node: RootNode | TemplateChildNode,
  context: TransformContext
) {
  const children = (node as any).children;
  for (let i = 0; i < children.length; i++) {
    const node = children[i];
    // 递归实现深度优先搜索
    traverseNode(node, context);
  }
}
