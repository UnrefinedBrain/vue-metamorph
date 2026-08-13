/**
 * Loads the codemod editor's language service in the browser.
 *
 * TypeScript and the declaration files are a few megabytes between them, so
 * this module is only ever reached through a dynamic import, once the codemod
 * pane is actually open.
 */

import { TYPE_FILES } from 'virtual:vue-metamorph-types';
import {
  type CodemodLanguageService,
  createCodemodLanguageService,
} from './create-language-service';

export type { CodemodLanguageService } from './create-language-service';

let pending: Promise<CodemodLanguageService | null> | null = null;

/**
 * Loads TypeScript and the declaration files, once per page. Resolves to null
 * when the declarations are not available, which happens if the docs are
 * served without building the package first.
 */
export function loadCodemodLanguageService(): Promise<CodemodLanguageService | null> {
  pending ??= (async () => {
    if (!TYPE_FILES) {
      return null;
    }

    const ts = (await import('typescript')).default;
    return createCodemodLanguageService(ts, TYPE_FILES);
  })();

  return pending;
}
