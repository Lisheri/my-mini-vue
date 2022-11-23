import { VNode } from './vnode';
import { ComponentInternalInstance } from './component';
import { SlotFlags } from '@mini-vue/shared';
export type Slot = (...args: any[]) => VNode[];

export type InternalSlots = {
  [name: string]: Slot | undefined;
};

export type Slots = Readonly<InternalSlots>;
export type RawSlots = {
  [name: string]: unknown
  // manual render fn hint to skip forced children updates
  $stable?: boolean
  /**
   * for tracking slot owner instance. This is attached during
   * normalizeChildren when the component vnode is created.
   * @internal
   */
  _ctx?: ComponentInternalInstance | null
  /**
   * indicates compiler generated slots
   * we use a reserved property instead of a vnode patchFlag because the slots
   * object may be directly passed down to a child component in a manual
   * render function, and the optimization hint need to be on the slot object
   * itself to be preserved.
   * @internal
   */
  _?: SlotFlags
}