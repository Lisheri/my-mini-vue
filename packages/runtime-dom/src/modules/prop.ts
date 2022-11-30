import { VNode, ComponentInternalInstance, UnmountChildrenFn } from "@mini-vue/runtime-core";

/**
 * 处理dom上的属性
 * @param el dom element
 * @param key 属性名
 * @param value 属性值
 * @param prevChildren 需要卸载的旧的儿子
 * @param parentComponent 父组件
 * @param unmountChildren 卸载方法
 */
export function patchDOMProp (
  el: any,
  key: string,
  value: unknown,
  // 以下参数仅在修改innerHTML/textContent时, 新的dom创建时被传递, 因为此时必须卸载oldSubTree
  prevChildren: VNode[],
  parentComponent: ComponentInternalInstance,
  unmountChildren: UnmountChildrenFn
) {
  if (key === 'innerHTML' || key === 'textContent') {
    // 处理innerHTML/textContent被修改, 导致新的节点已建立, 旧的subtree还没有删除的情况
    if (prevChildren) {
      unmountChildren(prevChildren, parentComponent);
    }
    el[key] = value == null ? '' : value as string;
    return;
  }
  // ? 暂存非字符的value, 非字符串的value会被强制转换为字符串, 需暂存以对比状态变化
  if (key === 'value' && el.tagName !== 'PROGRESS') {
    // ? progress的value是字符串, 无需暂存
    el._value = value;
    const newValue = value == null ? '' : value;
    if (el.value !== newValue) {
      el.value = newValue;
    }
    return;
  }
  // ? 处理非字符串类型的默认值和移除dom上的属性
  if (value === '' || value == null) {
    const type = typeof el[key];
    if (value === '' && type === 'boolean') {
      // 设置空字符串属性, 但是类型应该是boolean, 则为默认true, 如 <input disabled /> 中的 disabled
      el[key] = true;
      return;
    } else if (value == null && type === 'string') {
      el[key] = '';
      el.removeAttribute(key);
      return;
    } else if (value == null && type === 'number') {
      el[key] = 0;
      el.removeAttribute(key);
      return;
    }
  }
  // 常规字符串属性直接赋值
  try {
    el[key] = value;
  } catch(e) {
    console.error(`在<${el.tagName.toLowerCase()}>上设置属性 ${key}失败, value: ${value}无效`)
  }
}