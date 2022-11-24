import { isString, isArray, isObject } from '@mini-vue/shared';

export type NormalizedStyle = Record<string, string | number>

// 标准化style参数
export function normalizeStyle(value: unknown): NormalizedStyle | undefined {
  if (isArray(value)) {
    const res: NormalizedStyle = {};
    value.forEach(item => {
      const normalized = normalizeStyle(isString(item) ? parseStringStyle(item) : item);
      if (normalized) {
        for (const key in normalized) {
          res[key] = normalized[key];
        }
      }
    })
    return res;
  } else if (isObject(value)) {
    return value;
  }
}

// 正则匹配
const listDelimiterRE = /;(?![^(]*\))/g // 匹配分号和括号内的内容, 将"("开始, ")"结束中的内容全放到一起, 如果只有结尾), 则全部匹配
const propertyDelimiterRE = /:(.+)/ // 匹配值(:后的所有内容)

export function parseStringStyle(cssText: string): NormalizedStyle {
  const res: NormalizedStyle = {};
  cssText.split(listDelimiterRE).forEach(item => {
    if (item) {
      const tmp = item.split(propertyDelimiterRE);
      // 都转换为对象
      tmp.length > 1 && (res[tmp[0].trim()] = tmp[1].trim())
    }
  })
  return res;
}

// 转换为字符串class
export function normalizeClass(value: unknown): string {
  let res = '';
  if (isString(value)) {
    res = value;
  } else if (isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const normalized = normalizeClass(value[i]);
      if (normalized) {
        res += normalized + ' ';
      }
    }
  } else if (isObject(value)) {
    for (const key in value) {
      if (value[key]) {
        res += key + ' ';
      }
    }
  }
  // 去除空格
  return res.trim();
}
