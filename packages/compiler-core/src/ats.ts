import { CREATE_ELEMENT_VNODE } from './runtimeHelpers';
import { TransformContext } from './transform';
import { PropsExpression } from './transforms/transformElement';

// 对象类型表达式
export interface ObjectExpression extends Node {
  type: NodeTypes.JS_OBJECT_EXPRESSION;
  properties: Array<Property>;
}

// 函数执行类型表达式
export interface CallExpression extends Node {
  type: NodeTypes.JS_CALL_EXPRESSION;
  callee: string | symbol;
  arguments: (
    | string
    | symbol
    | JSChildNode
    | TemplateChildNode
    | TemplateChildNode[]
  )[];
}

export interface VNodeCall extends Node {
  type: NodeTypes.VNODE_CALL;
  tag: string | symbol | CallExpression;
  props: PropsExpression | undefined;
  children:
    | TemplateChildNode[] // multiple children
    | TemplateTextChildNode // single text child
    // | SlotsExpression // component slots
    // | ForRenderListExpression // v-for fragment call
    | undefined;
  // patchFlag: string | undefined;
  // dynamicProps: string | undefined;
  // isBlock: boolean;
  // disableTracking: boolean;
}

export type TemplateTextChildNode =
  | ElementNode
  | TextNode
  | InterpolationNode
  | CompoundExpressionNode;

export interface CallExpression extends Node {
  type: NodeTypes.JS_CALL_EXPRESSION;
  callee: string | symbol;
  arguments: (
    | string
    | symbol
    | JSChildNode
    | TemplateChildNode
    | TemplateChildNode[]
  )[];
}

export interface ObjectExpression extends Node {
  type: NodeTypes.JS_OBJECT_EXPRESSION;
  properties: Array<Property>;
}

export interface Property extends Node {
  type: NodeTypes.JS_PROPERTY;
  key: ExpressionNode;
  value: JSChildNode;
}

export interface ArrayExpression extends Node {
  type: NodeTypes.JS_ARRAY_EXPRESSION;
  elements: Array<string | JSChildNode>;
}

export interface FunctionExpression extends Node {
  type: NodeTypes.JS_FUNCTION_EXPRESSION;
  params: ExpressionNode | string | (ExpressionNode | string)[] | undefined;
  returns?: TemplateChildNode | TemplateChildNode[] | JSChildNode;
  newline: boolean;
  isSlot: boolean;
}

export interface ConditionalExpression extends Node {
  type: NodeTypes.JS_CONDITIONAL_EXPRESSION;
  test: JSChildNode;
  consequent: JSChildNode;
  alternate: JSChildNode;
  newline: boolean;
}

// 缓存
export interface CacheExpression extends Node {
  type: NodeTypes.JS_CACHE_EXPRESSION;
  index: number;
  value: JSChildNode;
  isVNode: boolean;
}

export type JSChildNode =
  | VNodeCall
  | CallExpression
  | ObjectExpression
  | ArrayExpression
  | ExpressionNode
  | FunctionExpression
  | ConditionalExpression
  | CacheExpression;
export interface Node {
  type: NodeTypes;
  // 暂不处理位置
  // loc: SourceLocation;
}

// export interface BlockStatement extends Node {
//   type: NodeTypes.JS_BLOCK_STATEMENT
//   body: (JSChildNode | IfStatement)[]
// }
export interface RootNode extends Node {
  type: NodeTypes.ROOT;
  children: TemplateChildNode[];
  codegenNode: TemplateChildNode | JSChildNode | undefined;
  helpers: symbol[];
}
export interface SourceLocation {
  start: Position;
  end: Position;
  source: string;
}

export interface Position {
  offset: number;
  line: number;
  column: number;
}

// 普通插值表达式
export interface SimpleExpressionNode extends Node {
  type: NodeTypes.SIMPLE_EXPRESSION;
  content: string;
}

// 复合类型, 处理字符串 + 插值表达式这样的情况
export interface CompoundExpressionNode extends Node {
  type: NodeTypes.COMPOUND_EXPRESSION;
  children: Array<CompoundExpressionChildren>;
}

export type CompoundExpressionChildren =
  | SimpleExpressionNode
  | CompoundExpressionNode
  | string
  | symbol
  | InterpolationNode
  | TextNode;

export interface InterpolationNode extends Node {
  type: NodeTypes.INTERPOLATION;
  content: ExpressionNode;
}

// 插值表达式节点, 包含复合节点
export type ExpressionNode = SimpleExpressionNode | CompoundExpressionNode;
export interface InterpolationNode extends Node {
  type: NodeTypes.INTERPOLATION;
  content: ExpressionNode;
}
export enum NodeTypes {
  ROOT,
  SIMPLE_EXPRESSION,
  INTERPOLATION,
  ATTRIBUTE, // attr | props
  // 复合类型
  COMPOUND_EXPRESSION,
  ELEMENT,
  TEXT,
  // codegen
  VNODE_CALL,
  JS_CALL_EXPRESSION,
  JS_OBJECT_EXPRESSION,
  JS_PROPERTY,
  JS_ARRAY_EXPRESSION,
  JS_FUNCTION_EXPRESSION,
  JS_CONDITIONAL_EXPRESSION,
  JS_CACHE_EXPRESSION
}

export interface TextNode extends Node {
  type: NodeTypes.TEXT;
  content: string;
}

// element元素节点
export type ElementNode = PlainElementNode;
// | ComponentNode
// | SlotOutletNode
// | TemplateNode

export type TemplateChildNode =
  | ElementNode
  | InterpolationNode
  | CompoundExpressionNode
  | TextNode;
// | CommentNode
// | IfNode
// | IfBranchNode
// | ForNode
// | TextCallNode


export interface AttributeNode extends Node {
  type: NodeTypes.ATTRIBUTE
  name: string
  value: TextNode | undefined
}

export interface BaseElementNode extends Node {
  type: NodeTypes.ELEMENT;
  // ns: Namespace;
  tag: string;
  // tagType: ElementTypes;
  // isSelfClosing: boolean;
  props?: Array<AttributeNode>;
  children: TemplateChildNode[];
}

export interface PlainElementNode extends BaseElementNode {
  tagType: ElementTypes.ELEMENT;
  codegenNode:
    | VNodeCall
    | SimpleExpressionNode // 作为静态节点提升到最外层
    | CacheExpression // 被once缓存时
    | undefined;
}

export const enum ElementTypes {
  ELEMENT,
  COMPONENT,
  SLOT,
  TEMPLATE
}

export function createVNodeCall(
  context: TransformContext | null,
  tag: VNodeCall['tag'],
  props?: VNodeCall['props'],
  children?: VNodeCall['children']
): VNodeCall {
  if (context) {
    context.helper(CREATE_ELEMENT_VNODE);
  }

  return {
    type: NodeTypes.VNODE_CALL,
    tag,
    props,
    children
  };
}
