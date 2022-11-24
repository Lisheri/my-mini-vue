export * from './slotFlags';
import { makeMap } from './makeMap';
const hasOwnProperty = Object.prototype.hasOwnProperty;
export const hasOwn = (
  val: object,
  key: string | symbol
): key is keyof typeof val => hasOwnProperty.call(val, key);

export const isArray = Array.isArray;
export const isMap = (val: unknown): val is Map<any, any> =>
  toTypeString(val) === '[object Map]';
export const isSet = (val: unknown): val is Set<any> =>
  toTypeString(val) === '[object Set]';

export const isDate = (val: unknown): val is Date => val instanceof Date;
export const isFunction = (val: unknown): val is Function =>
  typeof val === 'function';
export const isString = (val: unknown): val is string =>
  typeof val === 'string';
export const isSymbol = (val: unknown): val is symbol =>
  typeof val === 'symbol';
export const isObject = (val: unknown): val is Record<any, any> =>
  val !== null && typeof val === 'object';

export const isPromise = <T = any>(val: unknown): val is Promise<T> => {
  return isObject(val) && isFunction(val.then) && isFunction(val.catch);
};

export const objectToString = Object.prototype.toString;
export const toTypeString = (value: unknown): string =>
  objectToString.call(value);

export const toRawType = (value: unknown): string => {
  // extract "RawType" from strings like "[object RawType]"
  return toTypeString(value).slice(8, -1);
};
export const EMPTY_OBJ: { readonly [key: string]: any } = {};
export const EMPTY_ARR = [];

export const NOOP = () => {};

/**
 * Always return false.
 */
export const NO = () => false;

const onRE = /^on[^a-z]/;
export const isOn = (key: string) => onRE.test(key);

export const def = (obj: object, key: string | symbol, value: any) => {
  Object.defineProperty(obj, key, {
    configurable: true,
    enumerable: false,
    value
  });
};

export const isIntegerKey = (key: unknown) =>
  isString(key) &&
  key !== 'NaN' &&
  key[0] !== '-' &&
  '' + parseInt(key, 10) === key;

// 判断两个值是否相等, 过滤NaN
export const hasChanged = (value: any, oldValue: any): boolean =>
  value !== oldValue && (value === value || oldValue === oldValue);

export const extend = Object.assign;

// 缓存字符串数据
const cacheStringFunction = <T extends (str: string) => string>(fn: T): T => {
  const cache: Record<string, string> = Object.create(null);
  return ((str: string) => {
    const hit = cache[str];
    return hit || (cache[str] = fn(str));
  }) as any;
};

const camelizeRE = /-(\w)/g;
// 短横线转驼峰
export const camelize = cacheStringFunction((str: string): string => {
  return str.replace(camelizeRE, (_, c) => (c ? c.toUpperCase() : ''));
});

// 执行数组中的所有函数
export const invokeArrayFns = (fns: Function[], arg?: any) => {
  for (let i = 0; i < fns.length; i++) {
    fns[i](arg);
  }
};

// 判断是否为onUpdate开头
export const isModelListener = (key: string): boolean =>
  key.startsWith('onUpdate:');

// 判断是否为key, ref等内建属性, 同时过滤空字符串
export const isReservedProp = /*#__PURE__*/ makeMap(
  // 首位逗号用于处理空字符串
  ',key,ref,' +
    'onVnodeBeforeMount,onVnodeMounted,' +
    'onVnodeBeforeUpdate,onVnodeUpdated,' +
    'onVnodeBeforeUnmount,onVnodeUnmounted'
);
