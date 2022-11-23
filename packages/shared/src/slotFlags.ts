export const enum SlotFlags {
  // 稳定插槽, 仅引用插槽道具或上下文状态。爹不需要强制儿子进行更新
  STABLE = 1,
  // 插槽没有完全捕获自己的依赖项, 爹必须强制儿子更新
  DYNAMIC = 2,
  // slot被转发, 爹是否需要更新儿子取决于爹本身收到的插槽类型。需要再运行时进行改进。
  FORWARDED = 3
}

export const slotFlagsText = {
  [SlotFlags.STABLE]: 'STABLE',
  [SlotFlags.DYNAMIC]: 'DYNAMIC',
  [SlotFlags.FORWARDED]: 'FORWARDED'
};
