export const EMPTY_OBJ = {};

export const isPrimary = (target) => typeof target === "string" || typeof target === "number" || typeof target === 'boolean';

export const isArray = target => Array.isArray(target);
