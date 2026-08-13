/**
 * The source types the explorer understands, which is exactly the set
 * vue-metamorph itself dispatches on: `transform()` picks its pipeline from
 * the file name, so the file name is the only control the explorer needs.
 */

export type EditorLanguage = 'vue' | 'javascript' | 'typescript' | 'css';

export type SourceType = {
  id: string;
  label: string;
  /** Passed to `transform()`, and what selects the parser. */
  filename: string;
  language: EditorLanguage;
};

export const SOURCE_TYPES: SourceType[] = [
  { id: 'vue', label: 'Vue SFC', filename: 'component.vue', language: 'vue' },
  { id: 'ts', label: 'TypeScript', filename: 'module.ts', language: 'typescript' },
  { id: 'tsx', label: 'TypeScript + JSX', filename: 'module.tsx', language: 'typescript' },
  { id: 'js', label: 'JavaScript', filename: 'module.js', language: 'javascript' },
  { id: 'jsx', label: 'JavaScript + JSX', filename: 'module.jsx', language: 'javascript' },
  { id: 'css', label: 'CSS', filename: 'styles.css', language: 'css' },
  { id: 'scss', label: 'SCSS', filename: 'styles.scss', language: 'css' },
  { id: 'sass', label: 'Sass', filename: 'styles.sass', language: 'css' },
  { id: 'less', label: 'Less', filename: 'styles.less', language: 'css' },
];

export const DEFAULT_SOURCE_TYPE = SOURCE_TYPES[0]!;

export function findSourceType(id: string | undefined): SourceType {
  return SOURCE_TYPES.find((type) => type.id === id) ?? DEFAULT_SOURCE_TYPE;
}
