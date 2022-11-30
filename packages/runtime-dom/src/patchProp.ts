import { RendererOptions } from '@mini-vue/runtime-core';
import { isOn, isModelListener, isString } from '@mini-vue/shared';
import { patchClass } from './modules/class';
import { patchStyle } from './modules/style';
import { patchEvent } from './modules/event';
import { patchAttrs } from './modules/attrs';
import { patchDOMProp } from './modules/prop';
type DOMRendererOptions = RendererOptions<Node, Element>;

const nativeOnRE = /^on[a-z]/;

export const forcePatchProp: DOMRendererOptions['forcePatchProp'] = (_, key) =>
  key === 'value';

export const patchProp: DOMRendererOptions['patchProp'] = (
  el,
  key,
  prevValue,
  nextValue,
  prevChildren,
  parentComponent,
  unmountChildren
) => {
  switch (key) {
    case 'class':
      patchClass(el, nextValue);
      break;
    case 'style':
      patchStyle(el, prevValue, nextValue);
      break;
    default:
      if (isOn(key)) {
        // v-model前面处理过了
        if (!isModelListener(key)) {
          patchEvent(el, key, nextValue);
        } else if (shouldSetAsProp(el, key, nextValue)) {
          patchDOMProp(
            el,
            key,
            nextValue,
            prevChildren!,
            parentComponent!,
            unmountChildren!
          );
        }
      } else {
        patchAttrs(el, key, nextValue);
      }
  }
};

/**
 * 判断是否需要被设置为props属性
 * @param el dom节点
 * @param key 属性名
 * @param value 属性值
 */
const shouldSetAsProp = (el: Element, key: string, value: unknown) => {
  // TODO暂不考虑DOM属性
  if (key === 'spellcheck' || key === 'draggable') {
    // spellcheck和draggable 均为数字类型的枚举
    // 但其对应的dom是一个布尔值, 这会导致用字符串的false值设置时, 会被强行设置为true, 所以这里需要始终让他作为attrs
    // ? contentEditable没有问题, 因为其dom属性是枚举类型的字符串, 和上面不一样
    return false;
  }
  if (key === 'form') {
    // form属性是表单的只读属性, 并且他一定会被设置为dom本身的属性, 也就是attrs
    return false;
  }

  if (key === 'list' && el.tagName === 'INPUT') {
    // input上的list属性为只读dom属性
    return false;
  }

  if (key === 'type' && el.tagName === 'TEXTAREA') {
    // textarea上的type为只读dom属性
    return false;
  }

  if (nativeOnRE.test(key) && isString(value)) {
    // 原生事件一定不是prop属性
    return false;
  }

  return key in el;
};
