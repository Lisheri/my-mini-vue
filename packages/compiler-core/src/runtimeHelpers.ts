export const TO_DISPLAY_STRING = Symbol('toDisplayString');
export const CREATE_ELEMENT_VNODE = Symbol('createElementVNode');

// 映射symbol对象到字符串
export const helperMapName = {
  [TO_DISPLAY_STRING]: 'toDisplayString',
  [CREATE_ELEMENT_VNODE]: 'createElementVNode'
};
