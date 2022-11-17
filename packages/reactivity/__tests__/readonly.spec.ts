import { readonly, isReadonly, isProxy } from '@mini-vue/reactivity';
import { vi } from 'vitest';
describe('reactivity/readonly', () => {
  it("happy path", () => {
    // 不能set
    const original = { foo: 1, bar: { baz: 2 } };
    const wrapped = readonly(original);
    expect(wrapped).not.toBe(original);
    expect(original.foo).toBe(1);
    expect(isReadonly(wrapped)).toBe(true)
    expect(isReadonly(wrapped.bar)).toBe(true)
    expect(isProxy(wrapped)).toBe(true);
  })

  it("warn then call set", () => {
    console.warn = vi.fn();
    const user = readonly({
      age: 10
    });

    user.age = 11;
    expect(console.warn).toBeCalled();
  })
});
