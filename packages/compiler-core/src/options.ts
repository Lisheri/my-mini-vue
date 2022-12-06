import { NodeTransform } from "./transform";

/**
 * options定义
 */
interface SharedTransformCodegenOptions {
  /**
   * Transform expressions like {{ foo }} to `_ctx.foo`.
   * If this option is false, the generated code will be wrapped in a
   * `with (this) { ... }` block.
   * - This is force-enabled in module mode, since modules are by default strict
   * and cannot use `with`
   * @default mode === 'module'
   */
  prefixIdentifiers?: boolean;
  /**
   * Compile the function for inlining inside setup().
   * This allows the function to directly access setup() local bindings.
   */
  inline?: boolean;
  /**
   * Indicates that transforms and codegen should try to output valid TS code
   */
  isTS?: boolean;
  /**
   * Filename for source map generation.
   * Also used for self-recursive reference in templates
   * @default 'template.vue.html'
   */
  filename?: string;
}

export interface TransformOptions extends SharedTransformCodegenOptions {
  // 用于每一个ast节点的转换的数组
  nodeTransforms?: NodeTransform[];
}

export interface CodegenOptions extends SharedTransformCodegenOptions {
  mode?: 'module' | 'function'
  // sourceMap?: boolean
  // scopeId?: string | null
  // optimizeImports?: boolean
  // runtimeModuleName?: string
  // runtimeGlobalName?: string
}
