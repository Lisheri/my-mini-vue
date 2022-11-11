export class Dep {
  constructor(value) {
    this._val = value;
    this.effects = new Set();
  }

  // 收集依赖
  depend() {
    currentEffect && this.effects.add(currentEffect);
  }

  get value() {
    this.depend();
    return this._val;
  }

  set value(value) {
    if (value !== this._val) {
      this._val = value;
      this.notify();
    }
  }

  notify() {
    this.effects.forEach(effect => {
      effect?.();
    });
  }
}

let currentEffect = null;

export function effectWatch(fn) {
  currentEffect = fn;
  fn();
  currentEffect = null;
}

const targetMap = new WeakMap();

export function reactive(raw) {
  return new Proxy(raw, {
    get(target, key) {
      const dep = getDep(target, key);
      // 依赖收集
      dep.depend();
      // 获取当前值
      return Reflect.get(target, key);
    },
    set(target, key, value) {
      const dep = getDep(target, key);
      if (!dep) return;
      const result = Reflect.set(target, key, value);
      dep.notify();
      return result;
    }
  });
}
const getDep = (target, key) => {
  let depsMap = targetMap.get(target);
  if (!depsMap) {
    // 每一个target对应一个depsMap, 如果不存在, 则初始化一个新的depsMap, 并存入原始数据对象的map ———— targetMap中
    targetMap.set(target, (depsMap = new Map()));
  }
  let dep = depsMap.get(key);
  if (!dep) {
    // 这里同样有一个初始化的问题
    // 如果dep集合不存在, 则初始化一个新的dep集合并存入当前对象的depsMap中
    depsMap.set(key, (dep = new Dep()));
  }
  return dep;
};
