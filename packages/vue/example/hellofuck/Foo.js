import { h, renderSlot } from '../../lib/guide-mini-vue.esm.js';

export const Foo = {
  emits: ['dispatch'],
  props: {
    num: {
      type: Number,
      default: 0
    }
  },
  setup(props, { emit, slots }) {
    const handleClickBtn = (e) => {
      e.stopPropagation();
      emit('dispatch', props.num+1);
    }
    const name = 'fuck you name';
    return () => h('div', {
      class: 'fuck1'
    }, [
      renderSlot(slots, 'header', {
        name
      }),
      h('span', props.num),
      h('div'),
      renderSlot(slots, 'footer'),
      h('button', {
        onClick: handleClickBtn
      }, '老子今天要触发emit'),
    ])
  }
}
