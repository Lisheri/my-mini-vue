export function patchAttrs(el: Element, key: string, value: any) {
  // TODO 未处理svg
  if (value == null) {
    // false也要添加上去
    el.removeAttribute(key);
  } else {
    // TODO 需处理一部分不会变成true或false的情况, 比如readonly
    el.setAttribute(key, value);
  }
}
