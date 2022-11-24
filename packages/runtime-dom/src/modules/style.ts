import { isString, camelize, isArray } from '@mini-vue/shared';

type StyleType = string | Record<string, string | string[]> | null;

// 处理style
export function patchStyle(
  el: Element,
  prevValue: StyleType,
  nextValue: StyleType
) {
  const style = (el as HTMLElement).style;
  if (!nextValue) {
    // 无新的属性直接移除
    el.removeAttribute('style');
  } else if (isString(nextValue)) {
    if (prevValue !== nextValue) {
      style.cssText = nextValue;
    }
  } else {
    // 非字符串
    for (const key in nextValue) {
      setStyle(style, key, nextValue[key]);
    }
    // 旧属性删除
    if (prevValue && !isString(prevValue)) {
      for (const key in prevValue) {
        if (nextValue[key] == null) {
          // 移除
          setStyle(style, key, '');
        }
      }
    }
  }
}

const setStyle = (
  style: CSSStyleDeclaration,
  name: string,
  val: string | string[]
) => {
  if (isArray(val)) {
    val.forEach((v) => setStyle(style, name, v));
  } else {
    const rawName = getRawName(style, name);
    // TODO 处理自定义属性 v-bind(xxx), 以及important
    style[rawName] = val;
  }
};

const styleNameCache: Record<string, string> = {};

const getRawName = (style: CSSStyleDeclaration, rawName: string): string => {
  const cached = styleNameCache[rawName];
  if (cached) {
    return cached;
  }
  let name = camelize(rawName);
  if (name in style) {
    return (styleNameCache[rawName] = name);
  }
  // TODO 正常还需要处理浏览器差异, 自动带上前缀
  return rawName;
};
