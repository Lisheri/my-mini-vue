import { Slots } from '../componentSlots';
import { Data } from '../component';
import { createVNode, Fragment } from '../vnode';

/**
 * 
 * TODO 暂不支持block
 * 但 block 的本质上还是 vnode
 * @private
 */
export function renderSlot(slots: Slots, name: string, props: Data = {}) {
  const slot = slots[name];
  if (slot) {
    const slotContent = slot(props);
    // TODO 插槽根节应该是一个 fragment
    return createVNode(Fragment, {}, slotContent);
  }
}