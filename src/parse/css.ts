import postcss from 'postcss';
import postcssLess from 'postcss-less';
import postcssSass from 'postcss-sass';
import postcssScss from 'postcss-scss';
import postcssStyl from 'postcss-styl';
import * as AST from '../ast';

const syntaxMap: Record<string, typeof postcssScss> = {
  css: postcss,
  scss: postcssScss,
  less: postcssLess,
  sass: postcssSass,
  stylus: postcssStyl,
};

export const isSupportedLang = (str: string) => !!syntaxMap[str];
export const getLangAttribute = (el: AST.VElement) => el.startTag.attributes.find((attr): attr is AST.VAttribute => !attr.directive && attr.key.rawName === 'lang')?.value?.value ?? 'css';

export const getCssDialectForFilename = (filename: string) => {
  switch (true) {
    case filename.endsWith('.scss'): return 'scss';
    case filename.endsWith('.sass'): return 'sass';
    case filename.endsWith('.less'): return 'less';
    case filename.endsWith('.css'): return 'css';
    case filename.endsWith('.styl'): return 'styl';
    default: return null;
  }
};

export const parseCss = (code: string, dialect: string): postcss.Root => (syntaxMap[dialect] ?? postcss).parse(code);
