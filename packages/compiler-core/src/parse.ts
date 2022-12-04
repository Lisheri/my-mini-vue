import {
  ElementNode,
  ElementTypes,
  InterpolationNode,
  NodeTypes,
  PlainElementNode,
  TextNode
} from './ats';

export interface ParserContext {
  source: string;
}

enum TagType {
  Start,
  End
}

export function baseParse(content: string) {
  // 创建全局上下文对象, 后续都根据此对象来处理
  const context = createParseContext(content);
  // 快速伪实现
  return createRoot(parseChildren(context, []));
}

function createRoot(children) {
  return {
    children
  };
}

/**
 * 转换子节点
 * @param context 上下文
 * @param ancestors 已处理标签记录栈
 * @returns
 */
function parseChildren(context: ParserContext, ancestors: ElementNode[]) {
  const nodes: any = [];
  while (!isEnd(context, ancestors)) {
    // 应当循环递归处理context, 直到处理完成
    let node;
    const s = context.source;
    if (s.startsWith('{{')) {
      // 处理插值的标识
      node = parseInterpolation(context);
    } else if (s[0] === '<') {
      // 标签
      if (/[a-z]/i.test(s[1])) {
        // Element
        node = parseElement(context, ancestors);
      }
    }
    if (!node) {
      // 当文本节点处理
      node = parseText(context);
    }
    nodes.push(node);
  }
  return nodes;
}

function createParseContext(content: string): ParserContext {
  return {
    source: content
  };
}

/**
 * 推进代码, 也就是将开始分隔符往里推, 去除开始结束分隔符
 * @param context 上下文
 * @param numberOfCharacters 推进字符串长度
 */
function advanceBy(context: ParserContext, numberOfCharacters: number): void {
  const { source } = context;
  context.source = source.slice(numberOfCharacters);
}

/**
 * 解析插值表达式
 * @param context 上下文
 * @returns 插值表达式ast节点
 */
function parseInterpolation(
  context: ParserContext
): InterpolationNode | undefined {
  // 解析content
  // {{message}} => message
  // ? 大于2才开始判断
  const openDelimiter = '{{'; // 开始分隔符
  const closeDelimiter = '}}'; // 结束分隔符
  // 计算结束分隔符出现的位置
  const indexClose = context.source.indexOf(
    closeDelimiter,
    openDelimiter.length
  );
  // 推进开始分隔符
  advanceBy(context, openDelimiter.length);
  // 去除开始结束分隔符的长度
  const rawContentLength = indexClose - openDelimiter.length;
  const rawContent = parseTextData(context, rawContentLength);
  // context.source.slice(0, rawContentLength);
  // 截取后过滤前后空格
  const content = rawContent.trim();
  // 过滤 "}}"后的标签或其他
  // ? parseTextData 中已经推进过 rawContentLength 的长度了, 无需重复, 只需推进 结束分隔符即可
  advanceBy(context, closeDelimiter.length);
  return {
    type: NodeTypes.INTERPOLATION, // 节点的类型
    content: {
      // 内容
      type: NodeTypes.SIMPLE_EXPRESSION,
      content: content
    }
  };
}

/**
 * 解析一般Element
 * @param context 上下文
 * @returns element ast 节点
 */
function parseElement(
  context: ParserContext,
  ancestors: ElementNode[]
): PlainElementNode | undefined {
  const element = parseTag(context, TagType.Start);
  // 当前节点入栈
  ancestors.push(element!);
  // 递归调用 parseChildren, 解析children, 毕竟内部可能有各种不同类型
  element!.children = parseChildren(context, ancestors);
  // 节点已解析完成, 出栈即可
  ancestors.pop();
  if (startsWithEndTagOpen(context.source, element!.tag)) {
    parseTag(context, TagType.End);
  } else {
    throw new Error(`缺少结束标签: ${element!.tag}`);
  }
  return element;
}

/**
 * 解析标签
 * @param context 上下文
 * @param type 标签类型
 * @returns element ast 节点
 */
function parseTag(
  context: ParserContext,
  type: TagType
): ElementNode | undefined {
  // + 1. 解析tag
  // ? 正则第一个括号里的内容会放在exec返回的数组的第一个位置(以后的括号以此类推), 第0个位置表示这个正则匹配到的所有内容
  // ? \/? 表示可以匹配到0或1个/, 其实就是匹配结束标签
  const match = /^<\/?([a-z]*)/i.exec(context.source);
  const tag = match?.[1] || '';
  // + 2. 删除处理完成的代码
  advanceBy(context, match?.[0]?.length || 0);
  advanceBy(context, 1);
  // 结束标签可以直接return
  if (type === TagType.End) return;
  let tagType = ElementTypes.ELEMENT;
  return {
    type: NodeTypes.ELEMENT, // 节点的类型
    tag,
    children: [], // tag的children默认为空数组
    tagType
  };
}

/**
 * 处理文本节点
 * @param context
 * @return 文本ast节点
 */
function parseText(context: ParserContext): TextNode {
  // 默认值还是不变, 依然为总长度
  let endIndex = context.source.length;
  // 结束标识可能有多个
  const endTokens = ['<', '{{'];
  for (let i = 0; i < endTokens.length; i++) {
    const index = context.source.indexOf(endTokens[i], 1);
    if (index !== -1 && endIndex > index) {
      // 不仅要存在, 并且当前的endIndex一定要比求出来的index大, 保证处理的结束点尽可能的靠左(可能会有 <div><p>1</p>{{fuck}}<p>2</p></div> 这样的嵌套情况, 会遍历很多结束点, 一定要优先靠左)
      endIndex = index;
    }
  }
  // 应当停在endToken处
  const content = parseTextData(context, endIndex);
  return {
    type: NodeTypes.TEXT,
    content
  };
}

function parseTextData(context: ParserContext, length: number): string {
  // 1. 获取content
  const content = context.source.slice(0, length);
  // ? 此处遇到插值开始应该停止解析
  // 2. 推进
  advanceBy(context, length);
  return content;
}

// 结束循环处理children的时机, 应当在处理完source或遇到结束标签时停止
function isEnd(context: ParserContext, ancestors: ElementNode[]) {
  const s = context.source;
  if (startsWith(s, '</')) {
    // 性能更好, 执行更快一些(后进去的在栈顶, 也就是在 ancestors 数组的最后)
    for (let i = ancestors.length - 1; i >= 0; --i) {
      const tag = ancestors[i].tag;
      if (startsWithEndTagOpen(s, tag)) {
        return true;
      }
    }
  }
  return !s;
}

// 判断source是否以searchString开头
function startsWith(source: string, searchString: string): boolean {
  return source.startsWith(searchString);
}

// 判断是否命中结束标签
function startsWithEndTagOpen(source: string, tag: string): boolean {
  return (
    startsWith(source, '</') &&
    // ? 通过substring直接截取tag, 过滤 "</", 全部转换为小写进行对比, 同时还要满足
    source.substring(2, tag.length).toLowerCase() === tag.toLowerCase() &&
    // ? 还要满足tag的结尾有一个水平制表符, 回车, 换行, 换页符或 ">", 用于校验结束标签也写完了
    /[\t\r\n\f />]/.test(source[2 + tag.length] || '>')
  );
}
