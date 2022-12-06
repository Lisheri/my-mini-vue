// template 通过 parse => ast
// parse后的ast 经过transform做一些特殊处理 => ast, transform转换后的代码应该是可以直接应用于生成render
// transform处理后的ast 通过generate => function render() {}

import { generate } from './codegen';
import { baseParse } from './parse';
import { transform } from './transform';
import { transformElement } from './transforms/transformElement';
import { transformExpression } from './transforms/transformExpression';
import { transformText } from './transforms/transformText';

export function baseCompile(template: string) {
  const ast = baseParse(template);
  // 此处的ast入参就是 ELEMENT类型
  transform(ast, {
    nodeTransforms: [transformExpression, transformElement, transformText]
  });
  return generate(ast);
}


