import { NodeTypes, PlainElementNode, TextNode } from "../src/ats";
import { baseParse } from "../src/parse";
import { transform } from "../src/transform";

describe("transform", () => {
  it("happy path", () => {
    const ast = baseParse("<div>hi, {{ message }}</div>");

    const plugin = (node) => {
      if (node.type === NodeTypes.TEXT) {
        node.content = node.content + "mini-vue"
      }
    }

    transform(ast, {
      nodeTransforms: [plugin]
    });
    const nodeText = (ast.children[0] as PlainElementNode).children[0] as TextNode; // 获取text 节点
    expect(nodeText.content).toBe("hi, mini-vue");
  })
})