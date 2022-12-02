import { isArray } from '@mini-vue/shared';
import { ComponentPublicInstance } from './componentPublicInstance';
import { callWithErrorHandling, ErrorCodes } from './errorHandling';

// 微任务队列中的任务, 其实和effect选项类似(调度选项执行, 其实就是通过queue实现)
export interface SchedulerJob {
  // 工作函数
  (): void;
  id?: number;
  // 是否允许递归
  allowRecurse?: boolean;
}

export type SchedulerCb = Function & { id?: number };
export type SchedulerCbs = SchedulerCb | SchedulerCb[];

// 是否正在执行
let isFlushing = false;
// 是否正在等待执行
let isFlushPending = false;

const queue: SchedulerJob[] = [];
let flushIndex = 0; // 执行的位置

// 等待执行前置任务队列
const pendingPreFlushCbs: SchedulerCb[] = [];
// 当前活动的前置任务队列
let activePreFlushCbs: SchedulerCb[] | null = null;
// 前置队列执行位置
let preFlushIndex = 0;

// 全部后置任务队列
const pendingPostFlushCbs: SchedulerCb[] = [];
// 当前激活的后置任务队列
let activePostFlushCbs: SchedulerCb[] | null = null;
// 后置任务队列执行位置
let postFlushIndex = 0;

const resolvedPromise: Promise<any> = Promise.resolve();
// 存储当前正在执行的 flush Promise
let currentFlushPromise: Promise<void> | null = null;

// 当前正在处理的任务
let currentPreFlushParentJob: SchedulerJob | null = null;

// 最大递归限制
const RECURSION_LIMIT = 100;
type CountMap = Map<SchedulerJob | SchedulerCb, number>;

export function nextTick(
  this: ComponentPublicInstance | void,
  fn?: () => void
): Promise<void> {
  const p = currentFlushPromise || resolvedPromise;
  return fn ? p.then(this ? fn.bind(this) : fn) : p;
}

/**
 * 寻找当前任务可以插入到任务队列中的插入点
 * @param job
 */
function findInsertionIndex(job: SchedulerJob): number {
  // 插入点一定是当前处理的任务位置的下一个位置之后
  let start = flushIndex + 1;
  let end = queue.length;
  const jobId = getId(job);
  while (start < end) {
    // 二分查找, 找到一个恰好比中间值大的位置, 插入此处即可
    const middle = (start + end) >>> 1;
    const middleJobId = getId(queue[middle]);
    middleJobId < jobId ? (start = middle + 1) : (end = middle);
  }
  return start;
}

// 执行(微)队列任务
export function queueJob(job: SchedulerJob) {
  // 默认情况下, 去重搜索使用 Array,includes() 的startIndex 参数搜索索引包括正在运行的当前作业, 因此它不能递归地再次出发自身。如果作业是watch()回调, 则搜索将从 +1 索引开始以允许它递归地触发自身
  // 用户有责任确保它不会以无限循环结束
  if (
    (!queue.length ||
      !queue.includes(
        job,
        isFlushing && job.allowRecurse ? flushIndex + 1 : flushIndex
      )) &&
    job !== currentPreFlushParentJob
  ) {
    // 当前工作可插入queue队列中的位置
    const pos = findInsertionIndex(job);
    if (pos > -1) {
      // 若存在这个位置, 则将当前job插入到queue中
      queue.splice(pos, 0, job);
    } else {
      // 否则插入到队尾
      queue.push(job);
    }
    // 创建微任务执行所有任务队列
    queueFlush();
  }
}

function queueFlush() {
  if (!isFlushing && !isFlushPending) {
    // 不能正在执行flush队列, 也不能正处于等待执行
    // 标识正在等待执行中
    isFlushPending = true;
    currentFlushPromise = resolvedPromise.then(flushJobs);
  }
}

// 将job从queue中移除
export function invalidateJob(job: SchedulerJob) {
  const i = queue.indexOf(job);
  if (i > -1) {
    queue.splice(i, 1);
  }
}

/**
 * 触发执行任务队列
 * @param cb 任务回调
 * @param activeQueue 当前激活的队列
 * @param pendingQueue 等待执行的队列
 * @param index 当前任务队列执行任务的开始位置
 */
function queueCb(
  cb: SchedulerCbs,
  activeQueue: SchedulerCb[] | null,
  pendingQueue: SchedulerCb[],
  index: number
) {
  if (!isArray(cb)) {
    if (
      !activeQueue ||
      !activeQueue.includes(
        cb,
        // 若递归, 从 index + 1 处开始查找, 否则从index处开始
        (cb as SchedulerJob).allowRecurse ? index + 1 : index
      )
    ) {
      pendingQueue.push(cb);
    }
  } else {
    pendingQueue.push(...cb);
  }
  queueFlush();
}

// 执行前置任务队列
export function queuePreFlushCb(cb: SchedulerCb) {
  queueCb(cb, activePreFlushCbs, pendingPreFlushCbs, preFlushIndex);
}

// 执行后置任务队列(主要是生命周期)
export function queuePostFlushCb(cb: SchedulerCbs) {
  queueCb(cb, activePostFlushCbs, pendingPostFlushCbs, postFlushIndex);
}

/**
 * 执行前置任务队列(带flush的watch, 需要在render前获取到最新的值)
 * @param seen
 * @param parentJob
 */
export function flushPreFlushCbs(
  seen?: CountMap,
  parentJob: SchedulerJob | null = null
) {
  if (pendingPreFlushCbs.length) {
    // 如果待处理队列不为空
    currentPreFlushParentJob = parentJob;
    // 保存队列中去重后的任务为当前活动的队列
    activePreFlushCbs = [...new Set(pendingPreFlushCbs)];
    // 清空待处理队列
    pendingPreFlushCbs.length = 0;
    seen = seen || new Map();
    for (
      preFlushIndex = 0;
      preFlushIndex < activePreFlushCbs.length;
      preFlushIndex++
    ) {
      // 检查递归层级是否超出限制
      checkRecursiveUpdates(seen!, activePreFlushCbs[preFlushIndex]);
      // 执行当前活动任务
      activePreFlushCbs[preFlushIndex]();
    }
    // 清空当前活动的任务队列
    activePreFlushCbs = null;
    // 重置活动队列执行位置
    preFlushIndex = 0;
    // 清空当前正在处理的任务
    currentPreFlushParentJob = null;
    // 递归执行，直到清空前置任务队列，再往下执行异步更新队列任务
    flushPreFlushCbs(seen, parentJob);
  }
}

export function flushPostFlushCbs(seen?: CountMap) {
  if (pendingPostFlushCbs.length) {
    // 和前置一样, 存在才执行
    const deduped = [...new Set(pendingPostFlushCbs)];
    // 清空队列
    pendingPostFlushCbs.length = 0;
    // 如果当前已经有活动的队列，就添加到执行队列的末尾，并返回
    if (activePostFlushCbs) {
      activePostFlushCbs.push(...deduped);
      return;
    }
    // 赋值为当前后置任务活动队列
    activePostFlushCbs = deduped;
    seen = seen || new Map();
    // 排序
    activePostFlushCbs.sort((a, b) => getId(a) - getId(b));
    // 遍历并执行(前置和后置都是内置, 无需try catch)
    for (
      postFlushIndex = 0;
      postFlushIndex < activePostFlushCbs.length;
      postFlushIndex++
    ) {
      // 校验递归层级
      checkRecursiveUpdates(seen!, activePostFlushCbs[postFlushIndex]);
      activePostFlushCbs[postFlushIndex]();
    }
    // 清空并重置
    activePostFlushCbs = null;
    postFlushIndex = 0;
  }
}

// 获取任务id
const getId = (job: SchedulerJob | SchedulerCb) =>
  job.id == null ? Infinity : job.id;

/**
 * 该方法负责处理队列任务，主要逻辑如下:
 * + 1. 先处理前置任务队列
 * + 2. 根据 Id 排队队列
 * + 3. 遍历执行队列任务
 * + 4. 执行完毕后清空并重置队列
 * + 5. 执行后置队列任务
 * + 6. 如果还有就递归继续执行
 * @param seen
 */
function flushJobs(seen?: CountMap) {
  isFlushPending = false; // 结束等待执行
  isFlushing = true; // 进入执行阶段
  seen = seen || new Map();
  // 先处理前置任务队列
  flushPreFlushCbs(seen);
  // 根据 Id 排队队列
  // + 1. 从父到子, 因为爹总是在儿子前面先创建
  // + 2. 如果父组件更新期间卸载了组件, 就可以跳过
  queue.sort((a, b) => getId(a) - getId(b));

  try {
    for (flushIndex = 0; flushIndex < queue.length; flushIndex++) {
      // 执行任务队列
      const job = queue[flushIndex];
      if (job) {
        checkRecursiveUpdates(seen!, job);
        callWithErrorHandling(job, ErrorCodes.SCHEDULER);
      }
    }
  } finally {
    // 重置和清空任务队列
    flushIndex = 0;
    queue.length = 0;
    // 执行后置任务队列
    flushPostFlushCbs(seen);
    isFlushing = false; // 重置队列执行状态
    currentFlushPromise = null; // 重置当前微任务为
    // 如果主任务队列、前置和后置任务队列还有没被清空，就继续递归执行
    if (
      queue.length ||
      pendingPreFlushCbs.length ||
      pendingPostFlushCbs.length
    ) {
      flushJobs(seen);
    }
  }
}

// 检查递归更新层级是否超过递归限制
function checkRecursiveUpdates(seen: CountMap, fn: SchedulerJob | SchedulerCb) {
  if (!seen.has(fn)) {
    seen.set(fn, 1);
  } else {
    const count = seen.get(fn)!;
    if (count > RECURSION_LIMIT) {
      throw new Error(`超过递归限制, 请自行检查`);
    } else {
      seen.set(fn, count + 1);
    }
  }
}
