import {
  ComponentInternalInstance,
  FunctionalComponent,
  Data
} from './component';
import { VNode, normalizeVNode, cloneVNode } from './vnode';
import { setCurrentRenderingInstance } from './componentRenderContext';
import { handleError, ErrorCodes } from './errorHandling';
import { ShapeFlags } from './shapeFlags';
import { NormalizedProps } from './componentProps';
import { isOn, isModelListener } from '@mini-vue/shared';
import { isEmitListener } from './componentEmits';

const getFunctionalFallthrough = (attrs: Data): Data | undefined => {
  let res: Data | undefined;
  for (const key in attrs) {
    if (key === 'class' || key === 'style' || isOn(key)) {
      (res || (res = {}))[key] = attrs[key];
    }
  }
  return res;
};

const filterModelListeners = (attrs: Data, props: NormalizedProps): Data => {
  const res: Data = {};
  for (const key in attrs) {
    // ? 一个v-model分成了 value 和 onUpdate:value再入参
    // 都是为了过滤v-model的attrs
    if (!isModelListener(key) || !(key.slice(9) in props)) {
      res[key] = attrs[key];
    }
  }
  return res;
};

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
      fallthroughAttrs = Component.attrs
        ? attrs
        : getFunctionalFallthrough(attrs);
    }

    // 合并attr
    let root = result;
    if (Component.inheritAttrs) {
      // 所有attrs的key
      const keys = Object.keys(fallthroughAttrs);
      const { shapeFlag } = root;
      if (keys.length) {
        if (
          shapeFlag & ShapeFlags.ELEMENT ||
          shapeFlag & ShapeFlags.COMPONENT
        ) {
          if (propsOptions && keys.some(isModelListener)) {
            // 存在v-model的声明, 并且组件一定要处理这个prop
            fallthroughAttrs = filterModelListeners(
              fallthroughAttrs,
              propsOptions
            );
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

/**
 * 判断新旧vnode所对应的component是否需要更新
 * @param prevVNode 旧的节点
 * @param nextVNode 新的节点
 */
export function shouldUpdateComponent(
  prevVNode: VNode,
  nextVNode: VNode
): boolean {
  // ? 更新过程中走到processComponent时, 此时props已被update, 所以这里的props都是最新的标准化且处理完默认值的props
  const { props: prevProps, children: prevChildren, component } = prevVNode;
  const { props: nextProps, children: nextChildren } = nextVNode;
  const emits = component!.emitsOptions;
  // TODO 应加入对patchFlag和optimized的处理, 这里暂不处理
  // 标识手动编写的渲染函数采用，因此任何子项的存在都会导致强制更新
  if (prevChildren || nextChildren) {
    if (!nextChildren || !(nextChildren as any).$stable) {
      return true;
    }
  }
  if (prevChildren === nextChildren) {
    // 两个组件的children没有发生变化, 不需要更新
    return false;
  }
  if (!prevProps) {
    // 旧的组件vnode没有props, 由新的组件vnode是否存在props来决定
    return !!nextProps;
  }
  if (!nextProps) {
    return true;
  }
  return hasPropsChanged(prevProps, nextProps, emits);
}

/**
 * 判断组件vnode的props是否发生变化
 * @param prevProps 旧的vnode props
 * @param nextProps 新的vnode props
 * @param emitsOptions 组件的emits配置
 */
const hasPropsChanged = (
  prevProps: Data,
  nextProps: Data,
  emitsOptions: ComponentInternalInstance['emitsOptions']
): boolean => {
  const nextKeys = Object.keys(nextProps);
  // 优先比较length;
  if (nextKeys.length !== Object.keys(prevProps).length) {
    return true;
  }
  // * 存在一个key, 满足不是emit的属性, 并且更新前后props发生变化, 说明组件需要更新
  return nextKeys.some(
    (key) =>
      prevProps[key] !== nextProps[key] && !isEmitListener(emitsOptions, key)
  );
};
