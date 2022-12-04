import { ElementTypes, NodeTypes } from '../src/ats';
import { baseParse } from '../src/parse';
describe('Parse', () => {
  describe('interpolation', () => {
    // 插值
    test('simple interpolation', () => {
      // baseParse返回一个ast
      const ast = baseParse('{{ message }}');
      expect(ast.children[0]).toStrictEqual({
        type: NodeTypes.INTERPOLATION, // 节点的类型
        content: {
          // 内容
          type: NodeTypes.SIMPLE_EXPRESSION,
          content: 'message'
        }
      });
    });
  });

  describe('element', () => {
    it('simple element div', () => {
      const ast = baseParse('<div></div>');
      expect(ast.children[0]).toStrictEqual({
        type: NodeTypes.ELEMENT, // 节点的类型
        tag: 'div',
        tagType: ElementTypes.ELEMENT,
        children: []
      });
    });
  });

  describe('text', () => {
    it('simple text', () => {
      const ast = baseParse('some text');
      expect(ast.children[0]).toStrictEqual({
        type: NodeTypes.TEXT, // 节点的类型
        content: 'some text'
      });
    });
  });

  it('hello world', () => {
    const ast = baseParse('<p>hi, {{ message }}</p>');
    /* 
      {
        element,
        插值
      }
    */
    expect(ast.children[0]).toStrictEqual({
      type: NodeTypes.ELEMENT,
      tag: 'p',
      tagType: ElementTypes.ELEMENT,
      children: [
        {
          type: NodeTypes.TEXT,
          content: 'hi, '
        },
        {
          type: NodeTypes.INTERPOLATION, // 节点的类型
          content: {
            // 内容
            type: NodeTypes.SIMPLE_EXPRESSION,
            content: 'message'
          }
        }
      ]
    });
  });

  it('Nest element', () => {
    const ast = baseParse('<div><p>hi</p>{{ message }}</div>');
    /* 
      {
        element,
        插值
      }
    */
    expect(ast.children[0]).toStrictEqual({
      type: NodeTypes.ELEMENT,
      tag: 'div',
      tagType: ElementTypes.ELEMENT,
      children: [
        {
          type: NodeTypes.ELEMENT,
          tag: 'p',
          tagType: ElementTypes.ELEMENT,
          children: [
            {
              type: NodeTypes.TEXT,
              content: 'hi'
            }
          ]
        },
        {
          type: NodeTypes.INTERPOLATION, // 节点的类型
          content: {
            // 内容
            type: NodeTypes.SIMPLE_EXPRESSION,
            content: 'message'
          }
        }
      ]
    });
  });

  it("should throw error when lack end tag", () => {
    // 缺少结束标签抛错
    expect(() => {
      baseParse("<div><span></div>")
    }).toThrow("缺少结束标签: span");
  })
});
