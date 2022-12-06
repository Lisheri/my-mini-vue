import {
  CompoundExpressionChildren,
  CompoundExpressionNode,
  NodeTypes,
  RootNode,
  TemplateChildNode
} from '../ats';
import { TransformContext } from '../transform';
import { isText } from '../utils';

export function transformText(
  node: TemplateChildNode | RootNode,
  _context: TransformContext
) {
  if (node.type === NodeTypes.ELEMENT) {
    return () => {
      const { children } = node;
      let currentContainer: CompoundExpressionNode | undefined = undefined;
      for (let i = 0; i < children.length; i++) {
        const child = children[i];
        if (isText(child)) {
          // 是的话搜索下一个节点
          for (let j = i + 1; j < children.length; j++) {
            const nextChild = children[j];
            if (isText(nextChild)) {
              // 收集并创建容器, 同时赋值给 currentContainer
              if (!currentContainer) {
                currentContainer = children[i] = {
                  type: NodeTypes.COMPOUND_EXPRESSION,
                  children: [child as CompoundExpressionChildren]
                };
              }

              // 添加一个 "+" 号
              currentContainer.children.push(' + ');
              currentContainer.children.push(
                nextChild as CompoundExpressionChildren
              );
              // 需要删除原有的插值表达式
              children.splice(j, 1);
              // 删除后, j已指向下一个, 需要调整回去
              j--;
            } else {
              currentContainer = undefined;
              // 停止循环
              continue;
            }
          }
        }
      }
    };
  }
}
