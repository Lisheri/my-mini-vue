import { NodeTypes, TemplateChildNode } from './ats';

export const isText = (node: TemplateChildNode): boolean => {
  // 是否为 text 或 插值表达式
  return node.type === NodeTypes.TEXT || node.type === NodeTypes.INTERPOLATION;
};
