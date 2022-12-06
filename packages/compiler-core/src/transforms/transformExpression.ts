import { SimpleExpressionNode, NodeTypes, RootNode, TemplateChildNode } from '../ats';
import { TransformContext } from '../transform';

export function transformExpression(node: RootNode | TemplateChildNode, _context?: TransformContext) {
  if (node.type === NodeTypes.INTERPOLATION) {
    node.content = processExpression(node.content as SimpleExpressionNode);
  }
}

function processExpression(node: SimpleExpressionNode) {
  node.content = `_ctx.${node.content}`;
  return node;
}
