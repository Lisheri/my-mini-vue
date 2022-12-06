import { generate } from '../src/codegen';
import { baseParse } from '../src/parse';
import { transform } from '../src/transform';
import { transformElement } from '../src/transforms/transformElement';
import { transformExpression } from '../src/transforms/transformExpression';
import { transformText } from '../src/transforms/transformText';

describe('codegen', () => {
  it('string', () => {
    const ast = baseParse('hi');
    transform(ast);
    const { code } = generate(ast);
    // 快照测试
    // - 1. 抓bug
    // - 2. 有意的更新快照
    expect(code).matchSnapshot();
  });

  it('interpolation', () => {
    // 插值
    const ast = baseParse('{{ message }}');
    transform(ast, {
      nodeTransforms: [transformExpression]
    });
    const { code } = generate(ast);
    expect(code).matchSnapshot();
  });

  it('element', () => {
    const ast = baseParse('<div>hi, {{ message }}</div>');
    // 此处的ast入参就是 ELEMENT类型
    transform(ast, {
      nodeTransforms: [transformExpression, transformElement, transformText]
    });
    const { code } = generate(ast);
    expect(code).matchSnapshot();
  });
});
