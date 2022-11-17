import { reactive, isReactive, isProxy } from '@mini-vue/reactivity';
describe("reactive", () => {
  it("happy path", () => {
    const original = { foo: 1 };
    const observed = reactive(original);
    // 不相等
    expect(observed).not.toBe(original);
    expect(observed.foo).toBe(1);
    expect(isReactive(observed)).toBe(true);
    expect(isProxy(observed)).toBe(true);
  })
})