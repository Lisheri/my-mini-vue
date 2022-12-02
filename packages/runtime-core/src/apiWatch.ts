import {
  ComputedRef,
  isReactive,
  isRef,
  ReactiveEffectOptions,
  effect,
  Ref,
  stop
} from '@mini-vue/reactivity';
import {
  EMPTY_OBJ,
  hasChanged,
  isArray,
  isFunction,
  isMap,
  isObject,
  isSet,
  remove,
  NOOP
} from '@mini-vue/shared';
import { currentInstance } from './component';
import { callWithErrorHandling, ErrorCodes } from './errorHandling';
import { queuePostRenderEffect } from './renderer';
import { queuePreFlushCb, SchedulerJob } from './scheduler';

// watchEffect type
export type WatchEffect = (onInvalidate: InvalidateCbRegistrator) => void;

export type WatchSource<T = any> = Ref<T> | ComputedRef<T> | (() => T);

type InvalidateCbRegistrator = (cb: () => void) => void;

export type WatchCallback<V = any, OV = any> = (
  value: V,
  oldValue: OV,
  onInvalidate: InvalidateCbRegistrator
) => any;

export interface WatchOptionsBase {
  flush?: 'pre' | 'post' | 'sync';
  onTrack?: ReactiveEffectOptions['onTrack'];
  onTrigger?: ReactiveEffectOptions['onTrigger'];
}

export interface WatchOptions<Immediate = boolean> extends WatchOptionsBase {
  immediate?: Immediate;
  deep?: boolean;
}

export type WatchStopHandle = () => void;

function doWatch(
  source: WatchSource | WatchSource[] | WatchEffect | object,
  cb: WatchCallback | null,
  { immediate, deep, flush, onTrack, onTrigger }: WatchOptions = EMPTY_OBJ,
  instance = currentInstance
): WatchStopHandle {
  if (!cb) {
    if (immediate !== undefined) {
      console.warn('请勿使用watch专用options `immediate`');
    }
    if (deep !== undefined) {
      console.warn('请勿使用watch专用options `deep`');
    }
  }

  // 1. 标准化source(来源可能很混乱)
  const warnInvalidSource = (s: unknown) => {
    // 用于提示无效的来源
    console.warn(`watch对象 ${s}无效, 请检查`);
  };
  // 定义getter
  let getter: () => any;
  // 是否强制执行
  let forceTrigger = false;
  if (isRef(source)) {
    // source是一个ref响应式对象
    // 访问getter就是访问source.value的值, 直接解包返回
    getter = () => (source as Ref).value;
    // 是否强制更新取决于当前ref响应式是否为浅响应, 浅响应需要立即更新, 否则可能会导致内部有发生变化但视图未发生变化(props中的值被watch)
    forceTrigger = !!(source as Ref)._shallow;
    // 默认deep为true, 且外部设置的deep无效
    deep = true;
  } else if (isArray(source)) {
    // 监听数组类型
    getter = () =>
      source.map((s) => {
        if (isRef(s)) {
          // ref解包返回即可
          return s.value;
        } else if (isReactive(s)) {
          // reactive响应式对象需要收集各个成员的依赖
          return traverse(s);
        } else if (isFunction(s)) {
          return callWithErrorHandling(s, ErrorCodes.WATCH_GETTER, [
            instance && (instance.proxy as any)
          ]);
        } else {
          // 无效watch成员告警
          warnInvalidSource(s);
        }
      });
  } else if (isFunction(source)) {
    if (cb) {
      // 存在回调函数, 则getter就是source这个函数的执行结果
      getter = () =>
        callWithErrorHandling(source, ErrorCodes.WATCH_GETTER, [
          instance && (instance.proxy as any)
        ]);
    } else {
      // 不存在回调函数, 就是一个简单的effect, 也就是watchEffect使用场景, 所有响应式对象均可收集当前watchEffect作为依赖
      getter = () => {
        if (instance && instance.isUnmounted) {
          return;
        }
        if (cleanup) {
          cleanup();
        }
        return callWithErrorHandling(source, ErrorCodes.WATCH_GETTER, [
          onInvalidate
        ]);
      };
    }
  } else {
    // 空函数
    getter = NOOP;
    warnInvalidSource(source);
  }

  if (cb && deep) {
    const baseGetter = getter;
    // 依次触发所有层级的getter, 对数据源中每一个属性遍历进行监听
    getter = () => traverse(baseGetter());
  }
  let cleanup: () => void;
  const onInvalidate: InvalidateCbRegistrator = (fn: () => void) => {
    cleanup = runner.options.onStop = () => {
      callWithErrorHandling(fn, ErrorCodes.WATCH_CLEANUP);
    };
  };

  let oldValue = isArray(source) ? [] : INITIAL_WATCHER_VALUE;
  // 定义一个job, 后续加入queue中利用微队列触发
  const job: SchedulerJob = () => {
    if (!runner.active) {
      return;
    }
    if (cb) {
      // 新的值
      const newValue = runner();
      if (deep || forceTrigger || hasChanged(newValue, oldValue)) {
        cleanup && cleanup();
        // 执行watch回调
        callWithErrorHandling(cb, ErrorCodes.WATCH_CALLBACK, [
          newValue,
          oldValue === INITIAL_WATCHER_VALUE ? undefined : oldValue,
          onInvalidate
        ]);
        // 使用完成后更新oldValue
        oldValue = newValue;
      }
    } else {
      // watchEffect直接就是runner, 也是一个单纯的effect
      runner();
    }
  };
  // 是否递归
  job.allowRecurse = !!cb;

  let scheduler: ReactiveEffectOptions['scheduler'];
  if (flush === 'sync') {
    // 回调触发时机为sync, 表示同步触发
    scheduler = job;
  } else if (flush === 'post') {
    // 访问更新后的DOM结构, 其实就是在render之前执行watch回调, 利用postFlush即可
    scheduler = () => queuePostRenderEffect(job);
  } else {
    // default: 'pre'
    scheduler = () => {
      if (!instance || instance.isMounted) {
        // 组件挂载后或者组件实例还未创建, 则前置执行job
        queuePreFlushCb(job);
      } else {
        // 默认选项, 首次触发一定是在组件挂载后, 因此他其实也是同步触发的
        job();
      }
    };
  }

  // 创建runner
  const runner = effect(getter, {
    lazy: true,
    onTrack,
    onTrigger,
    scheduler
  });

  if (cb) {
    if (immediate) {
      // 立即触发
      job();
    } else {
      // 保存旧的值(作为初始值)
      oldValue = runner();
    }
  } else if (flush === 'post') {
    queuePostRenderEffect(runner);
  } else {
    runner();
  }

  return () => {
    stop(runner);
    if (instance) {
      remove(instance.effects!, runner);
    }
  };
}

// TODO 需处理重载适配多种watch参数的情况
export function watch<T = any, Immediate extends Readonly<boolean> = false>(
  source: T | WatchSource<T>,
  cb: any,
  options?: WatchOptions<Immediate>
): WatchStopHandle {
  if (!isFunction(cb)) {
    console.warn(
      `watch必须带上回调函数`
    )
  }
  return doWatch(source as any, cb, options)
}

export function watchEffect(
  effect: WatchEffect,
  options?: WatchOptionsBase
): WatchStopHandle {
  return doWatch(effect, null, options);
}

// 初始化watch监听值
const INITIAL_WATCHER_VALUE = {};

// 递归遍历处理各个类型, 将其收集到seen中, 最终去重返回value
function traverse(value: unknown, seen: Set<unknown> = new Set()) {
  if (!isObject(value) || seen.has(value)) {
    return value;
  }
  seen.add(value);
  if (isRef(value)) {
    traverse(value.value, seen);
  } else if (isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      traverse(value[i], seen);
    }
  } else if (isSet(value) || isMap(value)) {
    value.forEach((v: any) => {
      traverse(v, seen);
    });
  } else {
    for (const key in value) {
      traverse(value[key], seen);
    }
  }
  return value;
}
