import { EMPTY_OBJ, isPrimary, isArray } from './shared/index.js'

// 自定义渲染器, 可以通过不同的createElement创建不同平台的节点
function createElement(tag) {
  return document.createElement(tag);
}

function removeChild(el, parent) {
  parent.removeChild(el);
}

function patchProp(el, key, prevValue, nextValue) {
  if (prevValue === nextValue) return;
  if (!nextValue) {
    el.removeAttribute(key);
  } else {
    el.setAttribute(key, nextValue);
  }
}

function insert(el, parentNode) {
  parentNode.append(el);
}

function createTextNode(text) {
  return document.createTextNode(text);
}

export function mountElement(vnode, container) {
  const { tag, props, children } = vnode;
  // tag
  // - 创建节点
  const el = (vnode.el = createElement(tag));

  // - 处理props
  for (const key in props) {
    // 设置属性
    patchProp(el, key, null, props[key]);
  }
  // - 处理children
  // string | array
  if (typeof children === "string" || typeof children === "number") {
    insert(createTextNode(children), el);
  } else if (Array.isArray(children)) {
    children.forEach(vnode => {
      mountElement(vnode, el);
    });
  }
  // insert
  insert(el, container);
}

const patchProps = (el, n2, oldProps, newProps) => {
  if (newProps !== oldProps) {
    for (const key in newProps) {
      const next = newProps[key]
      const prev = oldProps[key]
      // 处理第一种情况, 新的存在, 但是老的不存在, 直接添加
      if (next !== prev) {
        // 更新props
        patchProp(el, key, prev, next);
      }
    }
    // 处理第二种情况, 新的不存在, 但是老的存在
    if (oldProps !== EMPTY_OBJ) {
      for (const key in oldProps) {
        // 在oldProps中存在, 但是在newProps中不存在
        if (!(key in newProps)) {
          // 更新props
          patchProp(el, key, oldProps[key], null);
        }
      }
    }
  }
};

const updateChildren = (n1, n2, el) => {
  // 暴力diff
  const newChildren = n2.children;
  const oldChildren = n1.children;
  if (isPrimary(newChildren)) {
    if (isArray(oldChildren) || (isPrimary(oldChildren) && newChildren !== oldChildren)) {
      el.innerText = newChildren;
    }
  } else if (isArray(newChildren)) {
    if (isPrimary(oldChildren)) {
      el.innerText = '';
      newChildren.forEach(vnode => {
        mountElement(vnode, el);
      })
    } else if (isArray(oldChildren)) {
      // diff核心(爆破法)
      const length = Math.min(newChildren.length, oldChildren.length);
      for (let i = 0; i < length; i++) {
        const newVNode = newChildren[i];
        const oldVNode = oldChildren[i];
        // 更新差异
        diff(oldVNode, newVNode);
      }
      // 新的有多的, 直接新增
      if (newChildren.length > length) {
        for (let i = length; i < newChildren.length; i++) {
          const vnode = newChildren[i];
          mountElement(vnode, el);
        }
      }

      // 老的有剩余, 剩下的删除
      if (oldChildren.length > length) {
        for (let i = length; i < oldChildren.length; i++) {
          const vnode = oldChildren[i];
          removeChild(vnode.el, el);
        }
      }
    }
  }
}

export function diff(n1, n2) {
  const el = (n2.el = n1.el);
  // + 1. 处理tag
  if (n1.tag !== n2.tag) {
    // 替换tag
    n1.el.replaceWith(createElement(n2.tag));
  } else {
    // + 2. 处理props
    //  - (1). 新的有, 老的没有, 直接添加
    //  - (2). 新的没有, 老的有, 直接删除
    const newProps = n2.props || EMPTY_OBJ;
    const oldProps = n1.props || EMPTY_OBJ;
    console.info(n1.props, n2.props)
    patchProps(el, n2, oldProps, newProps);
  }
  // 3. 处理children
  updateChildren(n1, n2, el);
}
