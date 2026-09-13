import postcss from 'postcss';
import postcssLess from 'postcss-less';
import postcssSass from 'postcss-sass';
import postcssScss from 'postcss-scss';
import postcssStyl from 'postcss-styl';

export const syntaxMap: Record<string, typeof postcssScss> = {
  css: postcss,
  scss: postcssScss,
  less: postcssLess,
  sass: postcssSass,
  stylus: postcssStyl,
};

export const isSupportedLang = (str: string) => !!syntaxMap[str];

/**
 * Describes the element structurally rather than as `AST.VElement`, so that it also accepts a
 * vue-eslint-parser element, which is a separate but identically shaped type.
 */
interface ElementWithAttributes {
  startTag: {
    attributes: ReadonlyArray<
      | { directive: true }
      | {
          directive: false;
          key: { rawName: string };
          value: { value: string } | null;
        }
    >;
  };
}

export const getLangAttribute = (el: ElementWithAttributes) => {
  for (const attr of el.startTag.attributes) {
    if (!attr.directive && attr.key.rawName === 'lang') {
      return attr.value?.value ?? 'css';
    }
  }

  return 'css';
};

export const getCssDialectForFilename = (filename: string) => {
  switch (true) {
    case filename.endsWith('.scss'):
      return 'scss';
    case filename.endsWith('.sass'):
      return 'sass';
    case filename.endsWith('.less'):
      return 'less';
    case filename.endsWith('.css'):
      return 'css';
    case filename.endsWith('.styl'):
      return 'stylus';
    default:
      return null;
  }
};

export const parseCss = (code: string, dialect: string): postcss.Root =>
  (syntaxMap[dialect] ?? postcss).parse(code);
