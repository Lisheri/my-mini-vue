import type { Data, ConcreteComponent } from './component';
import type { AppContext } from './apiCreateApp';
import type { ComponentOptions } from './componentOptions';
import {
  isFunction,
  extend,
  EMPTY_ARR,
  EMPTY_OBJ,
  isArray,
  isString,
  camelize,
  isObject,
  hasOwn
} from '@mini-vue/shared';
type DefaultFactory<T> = (props: Data) => T | null | undefined;

// 标识boolean类型的prop, 后续需要添加特别的默认值
const enum BooleanFlags {
  shouldCast,
  shouldCastTrue
}
interface PropOptions<T = any, D = T> {
  type?: PropType<T> | true | null;
  required?: boolean;
  default?: D | DefaultFactory<D> | null | undefined | object;
  validator?(value: unknown): boolean;
}
type NormalizedProp =
  | null
  | (PropOptions & {
      [BooleanFlags.shouldCast]?: boolean;
      [BooleanFlags.shouldCastTrue]?: boolean;
    });

// 将用户传入的props转换为标准化的props后的标准props类型约束
export type NormalizedProps = Record<string, NormalizedProp>;
export type NormalizedPropsOptions = [NormalizedProps, string[]] | [];
// props
export type PropType<T> = PropConstructor<T> | PropConstructor<T>[];

type PropConstructor<T = any> =
  | { new (...args: any[]): T & {} }
  | { (): T }
  | PropMethod<T>;

type PropMethod<T, TConstructor = any> = T extends (...args: any) => any // 带有参数的函数
  ? { new (): TConstructor; (): T; readonly prototype: TConstructor } // 像构造器一样创造函数
  : never; // 无

export type ComponentPropsOptions<P = Data> =
  | ComponentObjectPropsOptions<P>
  | string[];

export type ComponentObjectPropsOptions<P = Data> = {
  [K in keyof P]: Prop<P[K]> | null;
};

export type Prop<T, D = T> = PropOptions<T, D> | PropType<T>;

// 通过类型构造函数判断传入的类型
const getType = (ctor: Prop<any>): string => {
  // 匹配所有以function 开头的 一个或多个字母、数字、下划线, 包含所有选项, 包含不用function的
  const match = ctor && ctor.toString().match(/^\s*function (\w+)/);
  // 这里取匹配值的后者
  return match ? match[1] : ""
}

const isSameType = (a: Prop<any>, b: Prop<any>) => {
  return getType(a) === getType(b);
}

// 获取类型序列, 因为会存在 [String, Boolean, Array]这样的情况, 包含多个类型
const getTypeIndex = (
  // 当前prop类型
  prop: Prop<any>,
  // 期望值
  expectedTypes: PropType<any> | void | null | true
) => {
  if (isArray(expectedTypes)) {
    for (let i = 0; i < expectedTypes.length; i++) {
      if (isSameType(expectedTypes[i], prop)) {
        return i;
      }
    }
  } else if (isFunction(prop)) {
    return isSameType(prop, expectedTypes as Prop<any>) ? 0 : -1;
  }
  // 不存在
  return -1;
}

// 校验props属性名
const validatePropName = (key: string) => {
  if (key?.[0] !== '$') {
    return true;
  } else {
    console.warn(`当前prop属性名称无效, ${key}是保留属性, 不可使用!`);
    return false;
  }
};

// Props标准化配置
export function normalizePropsOptions(
  comp: ConcreteComponent,
  appContext: AppContext,
  asMixin = false // 标识处理mixin或extends属性, 默认为false
): NormalizedPropsOptions {
  if (comp.__props) {
    // 1. 获取缓存, 若存在缓存, 则直接使用标准化后的缓存结果
    return comp.__props;
  }
  // 获取用户传入的props
  const raw = comp.props;
  // 存储props的最终转换值, 均为对象类型, 如: props: {a: {type: String, default: '1'}}
  const normalized: NormalizedPropsOptions[0] = {};
  // 存储所有转换后的prop键名
  let needCastKeys: NormalizedPropsOptions[1] = [];
  // 处理mixins和extends类型的标识
  let hasExtends = false;
  if (!isFunction(comp)) {
    // ? 非函数组件处理mixins和extends
    // 继承合并mixins或者extends属性中的props
    const extendProps = (raw: ComponentOptions) => {
      // 标识为已处理
      hasExtends = true;
      // 递归获取mixins或者extends中处理后的props和处理过的key
      const [props, keys] = normalizePropsOptions(raw, appContext, true);
      // 继承mixins或extends属性上处理后的props
      extend(normalized, props);
      // 存在keys都需要装进 needCastKeys
      if (keys) needCastKeys = needCastKeys!.concat(keys);
    };
    // 处理全局mixins
    if (!asMixin && appContext.mixins.length) {
      appContext.mixins.forEach(extendProps);
    }
    // 处理当前组件的extends
    if (comp.extends) {
      extendProps(comp.extends);
    }
    // 处理组件的mixins
    if (comp.mixins) {
      comp.mixins.forEach(extendProps);
    }
  }

  if (!raw && !hasExtends) {
    // 表示当前组件没有props需要处理
    return (comp.__props = EMPTY_ARR as any);
  }
  if (isArray(raw)) {
    // ? 处理数组类型的props
    raw.forEach((key) => {
      if (!isString(key)) {
        console.warn(
          `当前传入的prop: ${key}不是一个字符串, 若props为数组, 则应是Array<string>`
        );
      }
      // 处理键名为驼峰类型
      const normalizedKey = camelize(key);
      // 校验键名
      if (validatePropName(normalizedKey)) {
        // 给默认值
        normalizedKey[normalizedKey] = EMPTY_OBJ;
      }
    });
  } else if (raw) {
    // 处理对象
    if (!isObject(raw)) {
      console.warn('props设置不合法');
    }
    for (const key in raw) {
      // 标准化属性名
      const normalizedKey = camelize(key);
      if (validatePropName(normalizedKey)) {
        // 获取选项
        const opt = raw[key];
        // 类型为数组或者函数的说明此时props的值仅设置类型
        const prop: NormalizedProp = (normalized[normalizedKey] =
          isArray(opt) || isFunction(opt) ? { type: opt } : opt);
        if (prop) {
          // ? 存在prop
          // TODO 这里需要识别出带有boolean类型的prop, 后续标准化默认值时, 需要为boolean类型的prop设置特殊默认值, 包括boolean和string同时存在的情况
          const booleanIndex = getTypeIndex(Boolean, prop.type);
          const stringIndex = getTypeIndex(String, prop.type);
          // 存在Boolean类型
          prop[BooleanFlags.shouldCast] = booleanIndex > -1;
          // 存在Boolean类型, 且Boolean在String之前或者不存在String
          prop[BooleanFlags.shouldCastTrue] = stringIndex < 0 || booleanIndex < stringIndex;
          if (booleanIndex > -1 || hasOwn(prop, 'default')) {
            // Boolean类型或者存在default的类型后续都要特殊处理默认值
            needCastKeys = needCastKeys.concat(normalizedKey);
          }
        }
      }
    }
  }
  // 赋值给comp.__props做缓存并返回
  return (comp.__props = [normalized, needCastKeys]);
}
