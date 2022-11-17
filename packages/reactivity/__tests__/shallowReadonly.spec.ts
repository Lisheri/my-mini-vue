import { isReadonly, shallowReadonly, isProxy } from '@mini-vue/reactivity';

describe('reactivity/shallowReadonly', () => {
  it('should not make non-reactive properties reactive', () => {
    // shallow 表示只有表层是一个响应式对象, 内部不是
    // shallowReadonly表示表层是一个readonly, 内部不是
    const props = shallowReadonly({ n: { foo: 1 } });
    expect(isReadonly(props)).toBe(true);
    expect(isReadonly(props.n)).toBe(false);
    expect(isProxy(props)).toBe(true);
  });
  it('should call console.warn when set', () => {
    console.warn = vi.fn();
    const user = shallowReadonly({
      age: 10
    });

    user.age = 11;
    expect(console.warn).toHaveBeenCalled();
  });
});
