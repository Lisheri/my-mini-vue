import { isFunction } from '@mini-vue/shared';
import { currentInstance } from './component';
import { currentRenderingInstance } from './componentRenderContext';

export interface InjectionKey<T> extends Symbol {}

// provide函数
export function provide<T>(key: InjectionKey<T> | string | number, value: T) {
  if (!currentInstance) {
    // provide只能在setup阶段使用, 函数式组件不能使用, 因为Vue3的函数式组件为无状态组件
    console.warn('不要乱用provide');
  } else {
    // 获取provides配置
    let provides = currentInstance.provides;
    // 获取父节点的provides
    // ? 其实这里在递归, 父级的provide也是这样来的
    const parentProvides =
      currentInstance.parent && currentInstance.parent.provides;
    if (parentProvides === provides) {
      // ? 初始化时, 当前组件的provides指向他爹的provides, 所以parentProvides和provides一定是同一个指针, 基于这个事实来判断是否初始化, 并执行继承操作
      // 如果他们一样, 这里需要继承父级的provides, 防止当前组件调用provides后, inject到的属性丢失且仅执行一次
      provides = currentInstance.provides = Object.create(parentProvides);
    }
    // ts中symbol不能作为index类型的key, 静态类型检查会通不过
    provides[key as string] = value;
  }
}

// 重载以适配不同参数
export function inject<T>(key: InjectionKey<T> | string): T | undefined;
export function inject<T>(
  key: InjectionKey<T> | string,
  defaultValue: T,
  treatDefaultAsFactory?: false
): T;
export function inject<T>(
  key: InjectionKey<T> | string,
  defaultValue: T | (() => T),
  treatDefaultAsFactory: true
): T;

export function inject(
  key: InjectionKey<any> | string,
  defaultValue?: unknown,
  treatDefaultAsFactory = false
) {
  // 有可能在函数式组件中调用inject
  const instance = currentInstance || currentRenderingInstance;
  if (instance) {
    const provides =
      instance.parent == null
      // 没有父组件就从根组件取
        ? instance.vnode.appContext && instance.vnode.appContext.provides
        : instance.parent.provides;
    if (provides && (key as string | symbol) in provides) {
      return provides[key as string]
    } else if (arguments.length > 1) {
      // 从默认值中取值
      return treatDefaultAsFactory && isFunction(defaultValue) ? defaultValue() : defaultValue;
    } else {
      console.warn('没找到');
    }
  } else {
    // 只有setup或者函数式组件中可以使用inject
    console.warn('不要乱用inject');
  }
}
