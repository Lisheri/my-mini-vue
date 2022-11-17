import { EMPTY_OBJ, isArray, isIntegerKey, isMap } from '@mini-vue/shared';
import { TrackOpTypes, TriggerOpTypes } from './operations';
// 依赖集合
type Dep = Set<ReactiveEffect>;
// 依赖集合对应的key
type KeyToDepMap = Map<any, Dep>;
// 原始数据对象 map
const targetMap = new WeakMap<any, KeyToDepMap>();

export interface ReactiveEffect<T = any> {
  (): T;
  _isEffect: true;
  id: number;
  active: boolean;
  raw: () => T;
  deps: Array<Dep>;
  options: ReactiveEffectOptions;
  allowRecurse: boolean;
}

export interface ReactiveEffectOptions {
  lazy?: boolean; // 是否延迟触发 effect
  scheduler?: (job: ReactiveEffect) => void; // 调度函数
  onTrack?: (event: DebuggerEvent) => void; // 追踪时触发
  onTrigger?: (event: DebuggerEvent) => void; // 触发回调时触发
  onStop?: () => void; // 停止监听时触发
  allowRecurse?: boolean; // 是否允许递归调用
}

export type DebuggerEvent = {
  effect: ReactiveEffect;
  target: object;
  type: TrackOpTypes | TriggerOpTypes;
  key: any;
} & DebuggerEventExtraInfo;

export interface DebuggerEventExtraInfo {
  newValue?: any;
  oldValue?: any;
  oldTarget?: Map<any, any> | Set<any>;
}

// 存储effect的栈
const effectStack: ReactiveEffect[] = [];
// 当前激活的effect
let activeEffect: ReactiveEffect | undefined;

// 当前方法是否为一个effect方法
export function isEffect(fn: any): fn is ReactiveEffect {
  return fn && fn._isEffect === true;
}

/**
 *
 * @param fn 原始函数
 * @param options 选项对象
 * @returns 副作用函数
 */
export function effect<T = any>(
  fn: () => T,
  options: ReactiveEffectOptions = EMPTY_OBJ
) {
  if (isEffect(fn)) {
    // 如果fn已经是一个 effect 函数了, 则指向原始函数
    fn = fn.raw;
  }
  // 创建一个 wrapper, 它是一个响应式的effect函数
  const effect = createReactiveEffect(fn, options);
  if (!options.lazy) {
    // lazy配置, 计算属性才是true, 需延迟执行, 非 lazy则直接执行一次
    effect();
  }
  return effect;
}

// 清除当前effect中deps内所有依赖(同时也清除了对应属性所收集的当前effect依赖, 二者的dep指向同一地址)
function cleanup(effect: ReactiveEffect) {
  const { deps } = effect;
  if (deps.length) {
    let depLen = deps.length;
    for (let i = 0; i < depLen; i++) {
      // 这个地方是个浅拷贝, 这里删除后, 对应在
      deps[i].delete(effect);
    }
    deps.length = 0;
  }
}

// 计数器, 作唯一标识
let uid = 0;
function createReactiveEffect<T = any>(
  fn: () => T,
  options: ReactiveEffectOptions
): ReactiveEffect<T> {
  const effect = function reactiveEffect(): unknown {
    if (!effect.active) {
      // 非激活状态, 则判断是否调度执行, 如果非调度执行, 则直接执行原始函数
      // 调度执行会在调度时去执行对应的函数
      return options.scheduler ? undefined : fn();
    }
    if (!effectStack.includes(effect)) {
      // 栈内包含当前值则不需执行, 会在派发更新时触发
      // 清空 effect 引用的依赖
      cleanup(effect);
      try {
        // 开启全局 shouldTrack 允许依赖收集
        enableTracking()
        // 入栈, 用于控制多次effect执行
        effectStack.push(effect);
        // 设置activeEffect, 标识当前激活的effect, 用于收集依赖
        // ? effect回调函数中包含的响应式变量需收集当前effect作为依赖
        // ? 后续执行回调函数时内部访问响应式变量值, 会触发依赖收集, 进而收集当前effect函数作为依赖
        activeEffect = effect;
        // 执行原函数, 可能会出错, 所以这里使用try catch包裹
        return fn();
      } catch (e) {
        // 执行出错
        console.error(e);
      } finally {
        // 出栈, 允许再次入栈收集
        effectStack.pop();
        // 恢复 shouldTrack 开始前的状态
        resetTracking()
        // 指向栈顶 effect, 也就是前面进来的
        activeEffect = effectStack[effectStack.length - 1];
      }
    }
  } as ReactiveEffect;
  // effect 唯一标识
  effect.id = uid++;
  // 标识effect
  effect._isEffect = true;
  // effect激活标识
  effect.active = true;
  // 暂存回调函数
  effect.raw = fn;
  // 持有当前effect的依赖, 双向指针，依赖包含对 effect 的引用，effect 也包含对依赖的引用
  effect.deps = [];
  // 创建effect时传入的选项options
  effect.options = options;
  return effect;
}

/**
 * 依赖收集
 * @param target 当前对象
 * @param key 收集目标的key
 */
export function track(target: object, key: unknown) {
  if (!shouldTrack || !activeEffect) {
    // 如果激活的effect函数不存在, 直接返回
    // shouldTrack为false不允许收集依赖, 防止stop无法停止新的依赖收集
    // ? 因为收集的依赖就是effect函数
    return;
  }
  // effect函数不能重复, 这里选择使用set
  // ? 通过通过target获取当前依赖对象depsMap
  // 获取当前对象对应的depsMap
  let depsMap = targetMap.get(target);
  if (!depsMap) {
    // 每个target对应一个depsMap, 如果不存在, 则初始化一个新的depsMap, 并存入原始数据对象的map
    targetMap.set(target, (depsMap = new Map()));
  }
  // 获取dep集合, 也就是上面说的set数据结构
  let dep = depsMap.get(key);
  if (!dep) {
    // 集合初始化
    depsMap.set(key, (dep = new Set()));
  }
  // 防止重复收集
  // ? effect执行完毕后会被释放, 如果存在当前key对应的依赖集合中, 说明当前tick收集过
  if (!dep.has(activeEffect)) {
    // 将激活的effect函数作为依赖收集起来
    dep.add(activeEffect);
    // 当前激活的 effect 收集 dep 集合作为依赖
    // ? 后续执行cleanup移除effect.deps中某个dep下的effect时, 会将当前劫持属性dep中对应的effect一起移除(浅拷贝)
    activeEffect.deps.push(dep);
  }
}

/**
 * 派发更新
 * @param target 原始目标对象
 * @param type 派发通知的类型 set | add | delete | clear, 根据不同类型快速处理依赖
 * @param key 需要更新的属性名
 * @param newValue 更新的值
 * @param oldValue 更新前的值
 * @param oldTarget 更新前的原始对象
 */
export function trigger(
  target: object,
  type: TriggerOpTypes,
  key?: unknown,
  newValue?: unknown
) {
  // 取出之前收集的依赖并遍历执行
  // 通过 targetMap获取到 target 对应的依赖(dep)集合
  const depsMap = targetMap.get(target);
  if (!depsMap) {
    // 没有收集到依赖, 返回即可
    return;
  }
  // 创建运行的 effects 集合
  const effects = new Set<ReactiveEffect>();
  // 用于添加effect
  const add = (effectsToAdd: Set<ReactiveEffect> | undefined) => {
    if (effectsToAdd) {
      effectsToAdd.forEach((effect) => {
        // activeEffect已经被执行过了, 无需重复执行
        if (effect !== activeEffect) {
          effects.add(effect);
        }
      });
    }
  };
  // 用于执行effect的函数
  const run = (effect: ReactiveEffect) => {
    // 调度运行, 在tick结束时执行effect
    if (effect.options.scheduler) {
      effect.options.scheduler(effect);
    } else {
      // 直接运行
      effect();
    }
  };
  if (type === TriggerOpTypes.CLEAR) {
    // 类型为清除, 表示所有的都要执行
    depsMap.forEach(add);
  } else if (key === 'length' && isArray(target)) {
    // 修改是数组的length属性, 或者通过index向数组中新增字段
    depsMap.forEach((dep, key) => {
      if (key === 'length' || key >= (newValue as number)) {
        add(dep);
      }
    });
  } else {
    // 剩余情况
    if (key !== void 0) {
      // key存在, 添加对应的effect
      add(depsMap.get(key));
    }
    // 暂不处理迭代器的key
  }
  // 遍历effects执行
  effects.forEach(run);
}

export function stop(effect: ReactiveEffect) {
  if (effect.active) {
    // 清除effect的双向依赖
    cleanup(effect);
    if (effect.options.onStop) {
      effect.options.onStop();
    }
    // 设置为不激活
    effect.active = false;
  }
}

// 是否应该收集依赖
let shouldTrack = true;
const trackStack: boolean[] = [];

export function pauseTracking() {
  trackStack.push(shouldTrack);
  // 暂时关闭依赖收集功能
  shouldTrack = false;
}

export function enableTracking() {
  trackStack.push(shouldTrack);
  // 允许依赖收集
  shouldTrack = true;
}

export function resetTracking() {
  const last = trackStack.pop();
  // 指向上一次的shouldTrack, 和 enableTracking 区分
  shouldTrack = last === undefined ? true : last;
}
