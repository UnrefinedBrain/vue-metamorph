import postcss from 'postcss';
import postcssLess from 'postcss-less';
import postcssSass from 'postcss-sass';
import postcssScss from 'postcss-scss';

const syntaxMap: Record<string, typeof postcssScss> = {
  css: postcss,
  scss: postcssScss,
  less: postcssLess,
  sass: postcssSass,
}

export const parseCss = (code: string, dialect: string): postcss.Root => {
  return (syntaxMap[dialect] ?? postcss).parse(code);
};
