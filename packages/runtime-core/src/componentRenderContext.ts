import { ComponentInternalInstance } from './component';

export let currentRenderingInstance: ComponentInternalInstance | null = null;

export function setCurrentRenderingInstance(instance: ComponentInternalInstance | null): void {
  currentRenderingInstance = instance;
}

