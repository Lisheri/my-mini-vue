import type { ComponentPublicInstance } from './componentPublicInstance';
import type { ComponentOptions } from './componentOptions';
import { Component, Data } from './component';
import { RootRenderFunction } from './renderer';
import { createVNode } from './vnode';
import { isObject } from '@mini-vue/shared';
export interface App<HostElement = any> {
  mount(rootContainer: HostElement | string): ComponentPublicInstance;
  // 组件唯一id
  _uid: number;
}
export interface AppContext {
  app: App; // for devtools
  provides: Record<string | symbol, any>;
  mixins: ComponentOptions[];
}

export function createAppContext(): AppContext {
  return {
    // 占位
    app: null as any,
    provides: Object.create(null),
    mixins: []
  };
}

export type CreateAppFunction<HostElement> = (
  rootComponent: Component,
  rootProps?: Data | null
) => App<HostElement>;

let uid = 0;

export function createAppAPI<HostElement>(
  render: RootRenderFunction
): CreateAppFunction<HostElement> {
  return function createApp(rootComponent: Component, rootProps = null) {
    if (rootProps != null && isObject(rootProps)) {
      console.warn('传入根组件的rootProps必须是一个对象');
    }
    // 标记挂载
    let isMounted = false;
    const context = createAppContext();
    const app: App = (context.app = {
      _uid: uid++,
      mount(rootContainer): any {
        // 先vnode
        // component -> vnode
        // 所有的逻辑操作, 都会基于 vnode 做处理
        if (!isMounted) {
          // 创建vnode
          const vnode = createVNode(rootComponent, rootProps);
          // 设置 appContext
          vnode.appContext = context;
          // 渲染vnode
          render(vnode, rootContainer)
        } else {
          console.warn('App已挂载, 请勿重复挂载。');
        }
        return;
      }
    });
    return app;
  };
}
