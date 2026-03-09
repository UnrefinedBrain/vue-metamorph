import { describe, it, expect } from 'vitest';
import { getCssDialectForFilename, getLangAttribute, isSupportedLang, parseCss } from './css';
import { vElement, vStartTag, vAttribute, vIdentifier, vLiteral } from '../builders';

describe('getCssDialectForFilename', () => {
  it('should return scss for .scss files', () => {
    expect(getCssDialectForFilename('style.scss')).toBe('scss');
  });

  it('should return sass for .sass files', () => {
    expect(getCssDialectForFilename('style.sass')).toBe('sass');
  });

  it('should return less for .less files', () => {
    expect(getCssDialectForFilename('style.less')).toBe('less');
  });

  it('should return css for .css files', () => {
    expect(getCssDialectForFilename('style.css')).toBe('css');
  });

  it('should return stylus for .styl files', () => {
    expect(getCssDialectForFilename('style.styl')).toBe('stylus');
  });

  it('should return null for unsupported extensions', () => {
    expect(getCssDialectForFilename('file.js')).toBeNull();
    expect(getCssDialectForFilename('file.vue')).toBeNull();
    expect(getCssDialectForFilename('file.ts')).toBeNull();
  });

  it('should handle paths with directories', () => {
    expect(getCssDialectForFilename('src/components/style.scss')).toBe('scss');
  });
});

describe('isSupportedLang', () => {
  it('should return true for supported languages', () => {
    expect(isSupportedLang('css')).toBe(true);
    expect(isSupportedLang('scss')).toBe(true);
    expect(isSupportedLang('less')).toBe(true);
    expect(isSupportedLang('sass')).toBe(true);
    expect(isSupportedLang('stylus')).toBe(true);
  });

  it('should return false for unsupported languages', () => {
    expect(isSupportedLang('unknown')).toBe(false);
    expect(isSupportedLang('')).toBe(false);
    expect(isSupportedLang('postcss')).toBe(false);
  });
});

describe('getLangAttribute', () => {
  function makeStyleElement(lang?: string) {
    const attrs = lang ? [vAttribute(vIdentifier('lang'), vLiteral(lang))] : [];
    return vElement('style', vStartTag(attrs, false), []);
  }

  it('should return the lang attribute value', () => {
    expect(getLangAttribute(makeStyleElement('scss'))).toBe('scss');
    expect(getLangAttribute(makeStyleElement('less'))).toBe('less');
  });

  it('should default to css when no lang attribute', () => {
    expect(getLangAttribute(makeStyleElement())).toBe('css');
  });

  it('should ignore directive attributes', () => {
    // vAttribute creates non-directive attributes, so a style element
    // with only non-matching attributes should default to css
    const attrs = [vAttribute(vIdentifier('scoped'), null)];
    const el = vElement('style', vStartTag(attrs, false), []);
    expect(getLangAttribute(el)).toBe('css');
  });
});

describe('parseCss', () => {
  it('should parse basic CSS', () => {
    const root = parseCss('.foo { color: red; }', 'css');
    expect(root.type).toBe('root');
    expect(root.nodes).toHaveLength(1);
  });

  it('should parse SCSS', () => {
    const root = parseCss('.foo { $var: 1; color: $var; }', 'scss');
    expect(root.type).toBe('root');
  });

  it('should parse LESS', () => {
    const root = parseCss('.foo { @var: 1; color: @var; }', 'less');
    expect(root.type).toBe('root');
  });

  it('should fall back to postcss for unknown dialects', () => {
    const root = parseCss('.foo { color: red; }', 'unknown-dialect');
    expect(root.type).toBe('root');
  });
});
