import { isString, isSymbol } from '@mini-vue/shared';
import {
  InterpolationNode,
  JSChildNode,
  NodeTypes,
  RootNode,
  SimpleExpressionNode,
  TemplateChildNode,
  TextNode,
  CompoundExpressionNode,
  CallExpression,
  VNodeCall
} from './ats';
import { CodegenOptions } from './options';
import {
  CREATE_ELEMENT_VNODE,
  helperMapName,
  TO_DISPLAY_STRING
} from './runtimeHelpers';

export interface CodegenResult {
  code: string;
  ast: RootNode;
}

type CodegenNode = TemplateChildNode | JSChildNode;

export interface CodegenContext
  extends Omit<
    Required<CodegenOptions>,
    'bindingMetadata' | 'inline' | 'isTS'
  > {
  push(code: string, node?: CodegenNode): void;
  helper(key: symbol): string;
  code: string;
}

export function generate(ast: RootNode): CodegenResult {
  const context = createCodeContext(ast, {});
  const { push } = context;

  genFunctionPreamble(ast, context);

  const functionName = 'render';
  const args = ['_ctx', '_cache'];
  const signature = args.join(', ');
  push(`function ${functionName}(${signature}){`);
  push('return ');
  genNode(ast.codegenNode!, context);
  push('}');

  return {
    ast,
    code: context.code
  };
}

// 前导处理, 其实就是添加一些必要的处理, 比如说 import { xxx } from 'xxxxx'这样的逻辑
function genFunctionPreamble(ast: RootNode, context: CodegenContext) {
  const { push } = context;
  const VueBinging = 'vue';
  // ? 改进在ast上直接有一个helpers
  const aliasHelper = (s) => `${helperMapName[s]}: _${helperMapName[s]}`;
  ast.helpers.length &&
    push(
      `const { ${ast.helpers
        .map(aliasHelper)
        .join(', ')} } = ${VueBinging}`
    );
  push('\n'); // 换行
  push('return ');
}

function genNode(node: CodegenNode | string | symbol, context: CodegenContext) {
  if (isString(node)) {
    // 处理node本身就是字符串的情况
    context.push(node);
    return;
  }
  if (isSymbol(node)) {
    context.push(context.helper(node));
    return;
  }
  switch (node.type) {
    case NodeTypes.ELEMENT:
      genNode(node.codegenNode!, context);
      break;
    case NodeTypes.TEXT:
      // text类型
      genText(node, context);
      break;
    case NodeTypes.INTERPOLATION:
      // 插值
      genInterpolation(node, context);
      break;
    case NodeTypes.SIMPLE_EXPRESSION:
      genExpression(node, context);
      break;
    case NodeTypes.VNODE_CALL:
      genVNodeCall(node, context)
      break;
    case NodeTypes.COMPOUND_EXPRESSION:
      genCompoundExpression(node, context);
      break;
  }
}

function genText(node: TextNode, context: CodegenContext) {
  context.push(`'${(node as any).content}'`);
}

function genInterpolation(node: InterpolationNode, context: CodegenContext) {
  // 处理插值
  const { push, helper } = context;
  push(`${helper(TO_DISPLAY_STRING)}(`);
  genNode(node.content, context);
  push(')');
}

function genExpression(node: SimpleExpressionNode, context: CodegenContext) {
  const { push } = context;
  push(`${node.content}`);
}

function genVNodeCall(node: VNodeCall, context: CodegenContext) {
  const { push, helper } = context;
  const { tag, children, props } = node;
  push(`${helper(CREATE_ELEMENT_VNODE)}(`);
  // ? 这里的children在transformElement中已处理为原有的node.children[0]
  genNodeList(genNullableArgs([tag, props, children]), context);
  // genNode(children as unknown as CodegenNode, context);
  push(')');
}

function genNodeList(
  nodes: (string | symbol | CodegenNode | TemplateChildNode[])[],
  context: CodegenContext
) {
  const { push } = context
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (isString(node)) {
      push(node);
    } else {
      genNode(node as CodegenNode, context);
    }

    // 处理逗号
    if (i < nodes.length - 1) {
      push(', ');
    }
  }
}

// 处理参数默认为null的情况
function genNullableArgs(args: any[]): CallExpression['arguments'] {
  return args.map((arg) => arg || `null`);
}

// 处理 text + 插值
// element => compound(复合类型)  to resolve text + interpolation
function genCompoundExpression(
  node: CompoundExpressionNode,
  context: CodegenContext
) {
  const children = node.children;
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    if (isString(child)) {
      // ? 字符串说明已处理完成
      context.push(child);
    } else {
      // 非需要继续递归处理
      genNode(child, context);
    }
  }
}

function createCodeContext(
  ast: RootNode,
  {
    mode = 'function',
    prefixIdentifiers = mode === 'module',
    filename = `template.vue.html`
  }: CodegenOptions
): CodegenContext {
  const context = {
    code: '',
    prefixIdentifiers,
    filename,
    mode,
    push(source) {
      context.code += source;
    },
    helper(name: symbol): string {
      return `_${helperMapName[name]}`;
    },
    ast
  };

  return context;
}
