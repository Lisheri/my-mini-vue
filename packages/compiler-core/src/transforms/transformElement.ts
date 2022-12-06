import {
  CallExpression,
  createVNodeCall,
  ExpressionNode,
  NodeTypes,
  ObjectExpression,
  RootNode,
  TemplateChildNode
} from '../ats';
import { TransformContext } from '../transform';

// props表达式类型
export type PropsExpression =
  | ObjectExpression
  | CallExpression
  | ExpressionNode;

export function transformElement(
  node: RootNode | TemplateChildNode,
  context: TransformContext
) {
  if (node.type === NodeTypes.ELEMENT) {
    return () => {
      // context.helper(CREATE_ELEMENT_VNODE);
      // 中间处理层
      // 处理tag
      const vnodeTag = `"${node.tag}"`;
      // 处理props
      let vnodeProps;
      // 处理children
      const children = node.children;
      let vnodeChildren = children[0];

      // 在vnodeCall中处理转换后的节点信息
      node.codegenNode = createVNodeCall(context, vnodeTag, vnodeProps, vnodeChildren);
    };
  }
}
