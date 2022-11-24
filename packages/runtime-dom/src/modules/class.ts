// 处理class和class绑定
// 之前通过normalizeClass全都换成了字符串
export function patchClass(el: Element, value: string | null) {
  if (value == null) {
    value = '';
  }
  // TODO 后续添加transition组件这里还需要处理一层
  el.className = value;
}
