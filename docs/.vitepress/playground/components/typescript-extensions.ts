/**
 * CodeMirror extensions that put the TypeScript language service behind the
 * codemod editor: squiggles for diagnostics, completions on `.` and on demand,
 * and types on hover.
 */

import { type Completion, autocompletion } from '@codemirror/autocomplete';
import { type Diagnostic as LintDiagnostic, linter } from '@codemirror/lint';
import type { Extension } from '@codemirror/state';
import { hoverTooltip } from '@codemirror/view';
import type { CodemodLanguageService } from '../core/language-service';

/** TypeScript's completion kinds mapped onto the ones CodeMirror styles. */
const COMPLETION_KINDS: Record<string, string> = {
  // Re-exports, which most of vue-metamorph's surface is.
  alias: 'function',
  class: 'class',
  const: 'variable',
  constructor: 'method',
  enum: 'enum',
  'enum member': 'constant',
  function: 'function',
  getter: 'property',
  interface: 'interface',
  keyword: 'keyword',
  let: 'variable',
  'local class': 'class',
  'local function': 'function',
  'local var': 'variable',
  method: 'method',
  module: 'namespace',
  parameter: 'variable',
  'primitive type': 'type',
  property: 'property',
  setter: 'property',
  type: 'type',
  var: 'variable',
};

export function typescriptExtensions(service: CodemodLanguageService): Extension[] {
  return [
    linter(
      (view): LintDiagnostic[] => {
        service.update(view.state.doc.toString());

        return service.getDiagnostics().map((diagnostic) => ({
          from: diagnostic.from,
          to: Math.max(diagnostic.to, diagnostic.from + 1),
          severity: diagnostic.severity,
          message: diagnostic.message,
        }));
      },
      { delay: 400 },
    ),

    autocompletion({
      override: [
        (context) => {
          const word = context.matchBefore(/[\w$]+/);
          const afterDot = context.matchBefore(/\.\s*/);

          if (!word && !afterDot && !context.explicit) {
            return null;
          }

          service.update(context.state.doc.toString());

          const entries = service.getCompletions(context.pos);
          if (entries.length === 0) {
            return null;
          }

          const options: Completion[] = entries.map((entry) => ({
            label: entry.label,
            type: COMPLETION_KINDS[entry.kind] ?? 'variable',
            boost: entry.sortText.startsWith('0') ? 1 : 0,
            info: () =>
              entry.detail().then((detail) => {
                if (!detail) {
                  return null;
                }
                const node = document.createElement('div');
                node.className = 'cm-completion-info';
                node.textContent = detail;
                return node;
              }),
          }));

          return { from: word?.from ?? context.pos, options };
        },
      ],
    }),

    hoverTooltip((view, position) => {
      service.update(view.state.doc.toString());

      const info = service.getQuickInfo(position);
      if (!info) {
        return null;
      }

      return {
        pos: info.from,
        end: info.to,
        create() {
          const dom = document.createElement('div');
          dom.className = 'cm-quick-info';

          const signature = document.createElement('pre');
          signature.textContent = info.signature;
          dom.append(signature);

          if (info.documentation) {
            const documentation = document.createElement('p');
            documentation.textContent = info.documentation;
            dom.append(documentation);
          }

          return { dom };
        },
      };
    }),
  ];
}
