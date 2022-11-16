import { reactive, effect } from '@mini-vue/reactivity';
describe("effect", () => {
  it("happy path1", () => {
    const user = reactive({
      age: 10
    });
    let nextAge;
    effect(() => {
      nextAge = user.age + 1;
    })
    expect(nextAge).toBe(11);

    // 更新
    user.age = 100;
    expect(nextAge).toBe(101);
  })
});
