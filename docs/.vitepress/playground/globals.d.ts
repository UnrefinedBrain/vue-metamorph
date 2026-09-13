/**
 * @fileoverview The playground publishes the selected node on `window` so that you can
 * inspect it from the browser console, the way AST Explorer does.
 */
declare global {
  interface Window {
    $node?: unknown;
  }
}

export {};
