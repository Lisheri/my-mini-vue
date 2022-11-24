import { RendererOptions } from '@mini-vue/runtime-core';
import { isOn, isModelListener } from '@mini-vue/shared';
import { patchClass } from './modules/class';
import { patchStyle } from './modules/style';
import { patchEvent } from './modules/event';
import { patchAttrs } from './modules/attrs';
type DOMRendererOptions = RendererOptions<Node, Element>;

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
          patchEvent(el, key, nextValue)
        }
      } else {
        patchAttrs(el, key, nextValue);
      }
  }
};
