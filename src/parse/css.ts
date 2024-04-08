import postcss from 'postcss';
import postcssLess from 'postcss-less';
import postcssSass from 'postcss-sass';
import postcssScss from 'postcss-scss';
import postcssStyl from 'postcss-styl';

const syntaxMap: Record<string, typeof postcssScss> = {
  css: postcss,
  scss: postcssScss,
  less: postcssLess,
  sass: postcssSass,
  stylus: postcssStyl,
};

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
