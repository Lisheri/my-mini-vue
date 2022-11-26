// vnode类型标识, 通过有符号左移操作进行定义, 以支持 & 操作符快速判断, 相等则为目标值, 否则为0
export const enum ShapeFlags {
  // 普通节点
  ELEMENT = 1,
  // 函数式组件 2
  FUNCTIONAL_COMPONENT = 1 << 1,
  // 状态组件 4
  STATEFUL_COMPONENT = 1 << 2,
  // 文本子节点 8
  TEXT_CHILDREN = 1 << 3,
  // 数组子节点 16
  ARRAY_CHILDREN = 1 << 4,
  // 插槽子节点 32
  SLOTS_CHILDREN = 1 << 5,
  // TELEPORT, 渲染到浏览器上任意位置的内建组件标识 64
  TELEPORT = 1 << 6,
  // SUSPENSE 128
  SUSPENSE = 1 << 7,
  // 需缓存的keepalive组件 256
  COMPONENT_SHOULD_KEEP_ALIVE = 1 << 8,
  // 普通keepalive组件 512
  COMPONENT_KEPT_ALIVE = 1 << 9,
  // 组件 6
  COMPONENT = ShapeFlags.STATEFUL_COMPONENT | ShapeFlags.FUNCTIONAL_COMPONENT
}