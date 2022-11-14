// 自定义渲染器, 可以通过不同的createElement创建不同平台的节点
function createElement(tag) {
  return document.createElement(tag)
}

function pathProps(el, key, prevValue, nextValue) {
  if (prevValue === nextValue) return; 
  el.setAttribute(key, nextValue);
}

function insert(el, parentNode) {
  parentNode.append(el);
}

function createTextNode(text) {
  return document.createTextNode(text);
}

export function mountElement(vnode, container) {
  const { tag, props, children } = vnode
  // tag
  // - 创建节点
  const el = createElement(tag);

  // - 处理props
  for (const key in props) {
    // 设置属性
    pathProps(el, key, null, props[key]);
  }
  // - 处理children
  // string | array
  if (typeof children === "string") {
    insert(createTextNode(children), el);
  } else if (Array.isArray(children)) {
    children.forEach(vnode => {
      mountElement(vnode, el);
    })
  }
  // insert
  insert(el, container);
}
