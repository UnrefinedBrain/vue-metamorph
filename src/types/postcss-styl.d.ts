declare module 'postcss-styl' {
  import * as postcss from 'postcss';

  export const parse: postcss.Parser<postcss.Root>;
  export const stringify: postcss.Stringifier;
}
