import type {
  Data,
  ConcreteComponent,
  ComponentInternalInstance
} from './component';
import type { AppContext } from './apiCreateApp';
import type { ComponentOptions } from './componentOptions';
import { setCurrentInstance } from './component';
import { isEmitListener } from './componentEmits';
import {
  isFunction,
  extend,
  EMPTY_ARR,
  EMPTY_OBJ,
  isArray,
  isString,
  camelize,
  isObject,
  isReservedProp,
  hasOwn,
  hyphenate
} from '@mini-vue/shared';
import { toRaw, shallowReadonly } from '@mini-vue/reactivity';
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
  return match ? match[1] : '';
};

const isSameType = (a: Prop<any>, b: Prop<any>) => {
  return getType(a) === getType(b);
};

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
};

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
  // ? needCastKeys是用来給props设置一下默认字段和布尔字段的，使其标准化一些。
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
          prop[BooleanFlags.shouldCastTrue] =
            stringIndex < 0 || booleanIndex < stringIndex;
          if (booleanIndex > -1 || hasOwn(prop, 'default')) {
            // Boolean类型 或者 存在default的类型 的key都要添加到needCastKeys中, 后续特殊处理
            needCastKeys = needCastKeys.concat(normalizedKey);
          }
        }
      }
    }
  }
  // 赋值给comp.__props做缓存并返回
  return (comp.__props = [normalized, needCastKeys]);
}

// ? attrs和props的本质区别是，如果instance.type.props存在，
// ? 当遍历vnode.props的时候，赋值給propss得方式为键key存在于instance.type.props中的，
// ? 如果键key不存在于instance.type.props 且instance.type.emit没有用到该属性，则赋值給attrs。
// ? 换句话说, attrs是被instance.type.props所过滤的vnode.props。

/**
 *
 * @param instance 当前组件实例
 * @param rawProps 组件props入参
 * @param isStateful 是否为状态组件
 */
export function initProps(
  instance: ComponentInternalInstance,
  rawProps: Data | null,
  isStateful: number // ? 通过shapeFlags进行位运算, 其结果是number类型
) {
  // 初始化时, props为空对象
  const props: Data = {};
  const attrs: Data = {};
  setFullProps(instance, rawProps, props, attrs);
  if (isStateful) {
    // props是一个不可被修改的属性, 但是props.xx触发时, 需要收集依赖, 这里使用 shallowReadonly
    // TODO 在Vue3中, 这里使用的是 shallowReactive, 修改props中内容时, 是在set中做的拦截, 并仅限于开发环境
    instance.props = shallowReadonly(props);
  } else {
    if (!instance.type.props) {
      // 函数组件如果都是attrs, 那么attrs作为props
      instance.props = attrs;
    } else {
      // 函数式组件无状态
      instance.props = props;
    }
  }
  // 添加attrs
  instance.attrs = attrs;
}

/**
 * 区分props和attrs, 初始化和更新时, 都需要处理props和attrs
 * @param instance 当前实例
 * @param rawProps 组件props入参(最新值)
 * @param props 需要处理的props(当前值)
 * @param attrs 需要处理的attrs(当前值)
 */
function setFullProps(
  instance: ComponentInternalInstance,
  rawProps: Data | null,
  props: Data,
  attrs: Data
) {
  // 获取标准化后的组件props配置以及需要处理默认值的所有属性集合 needCastKeys
  const [options, needCastKeys] = instance.propsOptions;
  if (rawProps) {
    for (const key in rawProps) {
      const value = rawProps[key]; // 当前值
      if (isReservedProp(key)) {
        // 不需要处理ref等内建属性
        continue;
      }
      // 获取标准化后的key
      let camelKey;
      if (options && hasOwn(options, (camelKey = camelize(key)))) {
        // 将标准化完成的字段名赋值回props
        props[camelKey] = value;
      } else if (!isEmitListener(instance.emitsOptions, key)) {
        // 这里还要过滤不是emits的属性, 最后将所有不是emits也不是props的属性, 添加到attrs上
        attrs[key] = value;
      }
    }
  }
  // 处理默认值
  if (needCastKeys && needCastKeys?.length) {
    // 避免响应式属性互相干扰
    const rawCurrentProps = toRaw(props);
    needCastKeys.forEach((key) => {
      props[key] = resolvePropValue(
        options!,
        props,
        key,
        rawCurrentProps[key],
        instance
      );
    });
  }
}

/**
 * 处理组件默认值, 根据传入props和组件设置的default对props进行初始化赋值
 * @param options 标准化后的props配置项集合
 * @param props 当前接收的props
 * @param key props属性名
 * @param value props的属性值
 * @param instance 当前实例
 * @return value 合并默认值后的props入参属性值
 */
function resolvePropValue(
  options: NormalizedProps,
  props: Data,
  key: string,
  value: unknown,
  instance: ComponentInternalInstance
) {
  // 获取当前字段在组件中的props配置
  const opt = options[key];
  if (opt != null) {
    const hasDefault = hasOwn(opt, 'default');
    if (hasDefault && value === undefined) {
      // 获取默认值
      const defaultValue = opt.default;
      if (opt.type !== Function && isFunction(defaultValue)) {
        // 防止设置默认值的过程中有获取上下文数据
        setCurrentInstance(instance);
        // 执行默认函数
        value = defaultValue(props);
        // 还原, 在执行setup时再次设置instance, 防止其他组件继续初始化props
        setCurrentInstance(null);
      } else {
        value = defaultValue;
      }
    }
    // 处理boolean
    if (opt[BooleanFlags.shouldCast]) {
      if (hasOwn(props, key) && !hasDefault) {
        // 如果没有传入当前字段, 并且没有默认值, 那么直接设置为false
        value = false;
      } else if (opt[BooleanFlags.shouldCastTrue] && value === '') {
        // value传的空字符串且
        value = true;
      }
    }
  }
  return value;
}

/**
 * 组件props属性更新
 * @param instance 当前实例
 * @param rawProps 新的props
 * @param rawPrevProps 旧的props
 */
export function updateProps(
  instance: ComponentInternalInstance,
  rawProps: Data | null,
  rawPrevProps: Data | null
) {
  // props内部内容通过指针浅拷贝更新后会响应到instance上
  const { props, attrs } = instance;
  // 解响应式
  const rawCurrentProps = toRaw(props);
  const [options] = instance.propsOptions;
  // TODO 接入patchFlags, 以优化FULL_PROPS更新的情况, 后续带入patchFlags再处理
  // 更新props
  setFullProps(instance, rawProps, props, attrs);
  // 处理动态props
  let kebabKey: string;
  for (const key in rawCurrentProps) {
    if (
      !rawProps ||
      // 驼峰(优先判断驼峰, 不满足就不用转短横线了)
      (!hasOwn(rawProps, key) &&
        // 短横线
        ((kebabKey = hyphenate(key)) === key || !hasOwn(rawProps, kebabKey)))
    ) {
      // 有需要删除或更新的key
      if (options) {
        if (
          rawPrevProps &&
          (rawPrevProps[key] !== undefined ||
            rawPrevProps[kebabKey!] !== undefined)
        ) {
          // 新的值没有, 旧的值有, 则需要更新一个默认值进来
          props[key] = resolvePropValue(
            options,
            rawProps || EMPTY_OBJ,
            key,
            undefined,
            instance
          );
        }
      } else {
        // 没有options直接删除
        delete props[key];
      }
    }
  }
}
