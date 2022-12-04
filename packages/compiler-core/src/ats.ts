export interface Node {
  type: NodeTypes;
  // 暂不处理位置
  // loc: SourceLocation;
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

export interface SimpleExpressionNode extends Node {
  type: NodeTypes.SIMPLE_EXPRESSION;
  content: string;
}

export interface CompoundExpressionNode extends Node {
  type: NodeTypes.COMPOUND_EXPRESSION;
  children: SimpleExpressionNode | CompoundExpressionNode;
}

export interface InterpolationNode extends Node {
  type: NodeTypes.INTERPOLATION;
  content: ExpressionNode;
}

export type ExpressionNode = SimpleExpressionNode | CompoundExpressionNode;
export interface InterpolationNode extends Node {
  type: NodeTypes.INTERPOLATION;
  content: ExpressionNode;
}
export enum NodeTypes {
  SIMPLE_EXPRESSION,
  INTERPOLATION,
  COMPOUND_EXPRESSION,
  ELEMENT,
  TEXT
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
  | TextNode
  // | CommentNode
  // | IfNode
  // | IfBranchNode
  // | ForNode
  // | TextCallNode

export interface BaseElementNode extends Node {
  type: NodeTypes.ELEMENT;
  // ns: Namespace;
  tag: string;
  // tagType: ElementTypes;
  // isSelfClosing: boolean;
  // props: Array<AttributeNode | DirectiveNode>;
  children: TemplateChildNode[];
}

export interface PlainElementNode extends BaseElementNode {
  tagType: ElementTypes.ELEMENT;
  // codegenNode:
  //   | VNodeCall
  //   | SimpleExpressionNode // 作为静态节点提升到最外层
  //   | CacheExpression // 被once缓存时
  //   | undefined;
}

export const enum ElementTypes {
  ELEMENT,
  COMPONENT,
  SLOT,
  TEMPLATE
}
