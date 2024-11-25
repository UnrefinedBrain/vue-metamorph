import { describe, expect, it } from 'vitest';
import { builders as b } from 'ast-types-x';
import * as builders from './builders';
import { stringify, stringifyHtmlComment } from './stringify';

describe('VEndTag', () => {
  it('should print an empty string', () => {
    expect(stringify(builders.vEndTag())).toBe('');
  });
});

describe('VDirectiveKey', () => {
  it('should print with no shorthand', () => {
    const node = builders.vDirectiveKey(
      builders.vIdentifier('foo', 'foo'),
    );

    expect(stringify(node)).toBe('v-foo');
  });

  it('should print with no shorthand, with a static argument', () => {
    const node = builders.vDirectiveKey(
      builders.vIdentifier('foo'),
      builders.vIdentifier('bar'),
    );

    expect(stringify(node)).toBe('v-foo:bar');
  });

  it('should print with no shorthand, with a computed argument', () => {
    const node = builders.vDirectiveKey(
      builders.vIdentifier('foo'),
      builders.vExpressionContainer(b.identifier('bar')),
    );

    expect(stringify(node)).toBe('v-foo:[bar]');
  });

  it('should print with a static argument and modifiers', () => {
    const node = builders.vDirectiveKey(
      builders.vIdentifier('foo'),
      builders.vIdentifier('bar'),
      [
        builders.vIdentifier('baz'),
        builders.vIdentifier('qux'),
      ],
    );

    expect(stringify(node)).toBe('v-foo:bar.baz.qux');
  });

  describe.each([
    ['bind', ':'],
    ['on', '@'],
    ['slot', '#'],
  ])('v-%s shorthand', (name, rawName) => {
    it('should print with a static argument', () => {
      const node = builders.vDirectiveKey(
        builders.vIdentifier(name, rawName),
        builders.vIdentifier('foo'),
      );

      expect(stringify(node)).toBe(`${rawName}foo`);
    });

    it('should print with a computed argument', () => {
      const node = builders.vDirectiveKey(
        builders.vIdentifier(name, rawName),
        builders.vExpressionContainer(b.identifier('bar')),
      );

      expect(stringify(node)).toBe(`${rawName}[bar]`);
    });
  });
});

describe('VText', () => {
  it('should print the value', () => {
    const node = builders.vText('foo bar');

    expect(stringify(node)).toBe('foo bar');
  });
});

describe('VIdentifier', () => {
  it('should print the value', () => {
    const node = builders.vIdentifier('foo');

    expect(stringify(node)).toBe('foo');
  });
});

describe('VLiteral', () => {
  it('should print the value', () => {
    const node = builders.vLiteral('foo');

    expect(stringify(node)).toBe('foo');
  });
});

describe('VAttribute', () => {
  describe('VDirective', () => {
    it('should print an attribute without a value', () => {
      const node = builders.vDirective(
        builders.vDirectiveKey(
          builders.vIdentifier('foo'),
          null,
        ),
        null,
      );

      expect(stringify(node)).toBe('v-foo');
    });

    it('should print an attribute with a value', () => {
      const node = builders.vDirective(
        builders.vDirectiveKey(
          builders.vIdentifier('foo'),
        ),
        builders.vExpressionContainer(
          b.identifier('bar'),
        ),
      );

      expect(stringify(node)).toBe('v-foo="bar"');
    });
  });

  describe('VAttribute', () => {
    it('should print an attribute without a value', () => {
      const node = builders.vAttribute(
        builders.vIdentifier('foo'),
        null,
      );

      expect(stringify(node)).toBe('foo');
    });

    it('should print an attribute with a value', () => {
      const node = builders.vAttribute(
        builders.vIdentifier('foo'),
        builders.vLiteral('bar'),
      );

      expect(stringify(node)).toBe('foo="bar"');
    });
  });
});

describe('VStartTag', () => {
  it('should print the attributes', () => {
    const node = builders.vStartTag(
      [
        builders.vAttribute(builders.vIdentifier('foo'), builders.vLiteral('bar')),
        builders.vDirective(builders.vDirectiveKey(builders.vIdentifier('baz')), null),
      ],
      false,
    );

    expect(stringify(node)).toBe(' foo="bar" v-baz');
  });

  it('should print a slash at the end if selfClosing=true', () => {
    const node = builders.vStartTag(
      [
        builders.vAttribute(builders.vIdentifier('foo'), builders.vLiteral('bar')),
        builders.vDirective(builders.vDirectiveKey(builders.vIdentifier('baz')), null),
      ],
      true,
    );

    expect(stringify(node)).toBe(' foo="bar" v-baz /');
  });
});

describe('VElement', () => {
  it('should print a self-closing element', () => {
    const node = builders.vElement(
      'div',
      builders.vStartTag([
        builders.vDirective(
          builders.vDirectiveKey(builders.vIdentifier('if')),
          builders.vExpressionContainer(
            b.identifier('someCondition'),
          ),
        ),
      ], true),
      [],
    );

    expect(stringify(node)).toBe('<div v-if="someCondition" />');
  });

  it('should print a void element', () => {
    const node = builders.vElement(
      'br',
      builders.vStartTag([
        builders.vDirective(
          builders.vDirectiveKey(builders.vIdentifier('if')),
          builders.vExpressionContainer(
            b.identifier('someCondition'),
          ),
        ),
      ], true),
      [],
    );

    expect(stringify(node)).toBe('<br v-if="someCondition">');
  });

  it('should print an element with children', () => {
    const node = builders.vElement(
      'Foo',
      builders.vStartTag([], false),
      [
        builders.vElement(
          'span',
          builders.vStartTag([], false),
          [builders.vText('Hello')],
        ),
      ],
    );

    expect(stringify(node)).toBe('<Foo><span>Hello</span></Foo>');
  });
});

describe('VFilterSequenceExpression', () => {
  it('should print filter args', () => {
    const filter = builders.vFilterSequenceExpression(
      b.identifier('myValue'),
      [
        builders.vFilter(b.identifier('myFilter'), [b.identifier('arg1'), b.identifier('arg2')]),
        builders.vFilter(b.identifier('myOtherFilter'), []),
      ],
    );

    expect(stringify(filter)).toBe('myValue | myFilter(arg1, arg2) | myOtherFilter');
  });
});

describe('HtmlComment', () => {
  it('should print an empty string if null', () => {
    expect(stringifyHtmlComment(null)).toBe('');
  });

  it('should print a single comment', () => {
    const comment = builders.htmlComment(' A comment ');
    expect(stringifyHtmlComment(comment)).toBe('<!-- A comment -->');
  });

  it('should print all comments', () => {
    const comment = builders.htmlComment(
      ' 1 ',
      builders.htmlComment(
        ' 2 ',
        builders.htmlComment(' 3 '),
      ),
    );

    expect(stringifyHtmlComment(comment)).toBe('<!-- 3 --><!-- 2 --><!-- 1 -->');
  });
});
