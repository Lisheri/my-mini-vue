import { ReactiveEffectOptions } from '@mini-vue/reactivity'
type InvalidateCbRegistrator = (cb: () => void) => void;

export type WatchCallback<V = any, OV = any> = (
  value: V,
  oldValue: OV,
  onInvalidate: InvalidateCbRegistrator
) => any;

export interface WatchOptionsBase {
  flush?: 'pre' | 'post' | 'sync';
  onTrack?: ReactiveEffectOptions['onTrack'];
  onTrigger?: ReactiveEffectOptions['onTrigger'];
}

export interface WatchOptions<Immediate = boolean> extends WatchOptionsBase {
  immediate?: Immediate;
  deep?: boolean;
}
