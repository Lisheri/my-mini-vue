import { ComponentInternalInstance, FunctionalComponent, Data } from './component';
import { VNode, normalizeVNode, cloneVNode } from './vnode';
import { setCurrentRenderingInstance } from './componentRenderContext';
import { handleError, ErrorCodes } from './errorHandling';
import { ShapeFlags } from './shapeFlags';
import { NormalizedProps } from './componentProps';
import { isOn, isModelListener } from '@mini-vue/shared';

const getFunctionalFallthrough = (attrs: Data): Data | undefined => {
  let res: Data | undefined;
  for (const key in attrs) {
    if (key === 'class' || key === 'style' || isOn(key)) {
      (res || (res = {}))[key] = attrs[key];
    }
  }
  return res;
}

const filterModelListeners = (attrs: Data, props: NormalizedProps): Data => {
  const res: Data = {};
  for (const key in attrs) {
    // ? 一个v-model分成了 value 和 onUpdate:value再入参
    // 都是为了过滤v-model的attrs
    if (!isModelListener(key) || !(key.slice(9) in props)) {
      res[key] = attrs[key]
    }
  }
  return res;
}

export function renderComponentRoot(
  instance: ComponentInternalInstance
): VNode {
  let result;
  const {
    vnode,
    type: Component,
    proxy,
    // withProxy,
    props,
    propsOptions: [propsOptions],
    slots,
    attrs,
    emit,
    render,
    renderCache,
    data,
    setupState,
    ctx
  } = instance;
  // 设置当前渲染组件实例
  setCurrentRenderingInstance(instance);

  try {
    // 暂存组件中的attrs, 用于合并attrs
    let fallthroughAttrs;
    if (vnode.shapeFlag & ShapeFlags.STATEFUL_COMPONENT) {
      //  有状态组件
      // TODO 还需考虑template编译后使用with注入上下文的proxy对象, 也就是withProxy
      const proxyToUse = proxy;
      // 标准化VNode
      result = normalizeVNode(
        render!.call(
          proxyToUse,
          proxyToUse!,
          renderCache,
          props,
          setupState,
          data,
          ctx
        )
      );
      fallthroughAttrs = attrs;
    } else {
      // 函数组件
      // ? 函数式组件本身就是render函数
      const render = Component as FunctionalComponent;
      result = normalizeVNode(
        render.length > 1
          ? render(props, { attrs, slots, emit })
          : render(props, null as any) // 此时不需要第二个参数
      );
      fallthroughAttrs = Component.attrs ? attrs : getFunctionalFallthrough(attrs)
    }

    // 合并attr
    let root = result;
    if (Component.inheritAttrs) {
      // 所有attrs的key
      const keys = Object.keys(fallthroughAttrs);
      const { shapeFlag } = root;
      if (keys.length) {
        if (shapeFlag & ShapeFlags.ELEMENT || shapeFlag & ShapeFlags.COMPONENT) {
          if (propsOptions && keys.some(isModelListener)) {
            // 存在v-model的声明, 并且组件一定要处理这个prop
            fallthroughAttrs = filterModelListeners(fallthroughAttrs, propsOptions);
            root = cloneVNode(root, fallthroughAttrs);
          }
        }
      }
    }
    // TODO 还需处理 指令和动画组件
    // 置回来
    result = root;
  } catch (err) {
    // 抛错处理
    handleError(ErrorCodes.RENDER_FUNCTION, err);
    // TODO render函数执行失败, 存在未知错误, 此时需要创建注释节点
  }

  setCurrentRenderingInstance(null);
  return result;
}
