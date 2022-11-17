import { reactive, effect, stop } from '@mini-vue/reactivity';
import { vi } from 'vitest';
describe('reactivity/effect', () => {
  it('happy path1', () => {
    const user = reactive({
      age: 10
    });
    let nextAge;
    effect(() => {
      nextAge = user.age + 1;
    });
    expect(nextAge).toBe(11);

    // 更新
    user.age = 100;
    expect(nextAge).toBe(101);
  });

  it('foo', () => {
    let foo = 10;
    const runner = effect(() => {
      foo++;
      return 'foo';
    });

    expect(foo).toBe(11);
    const r = runner();
    expect(foo).toBe(12);
    expect(r).toBe('foo');
  });

  it('scheduler', () => {
    // effect第二个参数给了一个scheduler的fn
    // effect第一次执行的时候还会执行fn
    // 当响应式对象触发派发更新时, 不会执行fn, 而是执行scheduler
    // 主动执行effect返回的run函数, 才会执行fn
    let runner: any, dummy;
    const scheduler = vi.fn((_runner) => {
      runner = _runner;
    });
    const obj = reactive({ foo: 1 });
    effect(
      () => {
        dummy = obj.foo;
      },
      { scheduler }
    );
    expect(scheduler).not.toHaveBeenCalled();
    expect(dummy).toBe(1);
    // 派发更新
    obj.foo++;
    // scheduler 被执行了一次
    expect(scheduler).toHaveBeenCalledTimes(1);
    // effect函数还是没有被执行
    expect(dummy).toBe(1);
    // 执行effect函数
    runner();
    // effect被执行
    expect(dummy).toBe(2);
  });

  it('stop', () => {
    let dummy
    const obj = reactive({ prop: 1 })
    const runner = effect(() => {
      dummy = obj.prop
    })
    obj.prop = 2
    expect(dummy).toBe(2)
    // 停止响应式函数
    stop(runner)
    obj.prop++;
    expect(dummy).toBe(2)

    // stopped effect should still be manually callable
    runner()
    expect(dummy).toBe(3)
  })

  it("onStop", () => {
    const obj = reactive({
      foo: 1,
    });
    const onStop = vi.fn();
    let dummy;
    const runner = effect(
      () => {
        dummy = obj.foo;
      },
      {
        onStop,
      }
    );
    stop(runner);
    expect(onStop).toBeCalledTimes(1);
  });
});
