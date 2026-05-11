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
    const node = builders.vDirectiveKey(builders.vIdentifier('foo', 'foo'));

    expect(stringify(node)).toBe('v-foo');
  });

  it('should print with no shorthand, with a static argument', () => {
    const node = builders.vDirectiveKey(builders.vIdentifier('foo'), builders.vIdentifier('bar'));

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
    const node = builders.vDirectiveKey(builders.vIdentifier('foo'), builders.vIdentifier('bar'), [
      builders.vIdentifier('baz'),
      builders.vIdentifier('qux'),
    ]);

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

    expect(stringify(node)).toBe('"foo"');
  });

  it('should escape double quotes in the value', () => {
    const node = builders.vLiteral('she said "hi"');

    // Without escaping the printer emits `"she said "hi""` which closes the
    // attribute prematurely and produces invalid HTML.
    expect(stringify(node)).toBe('"she said &quot;hi&quot;"');
  });

  it('should escape ampersands before quotes', () => {
    const node = builders.vLiteral('a & b "c"');

    expect(stringify(node)).toBe('"a &amp; b &quot;c&quot;"');
  });
});

describe('VAttribute', () => {
  describe('VDirective', () => {
    it('should print an attribute without a value', () => {
      const node = builders.vDirective(
        builders.vDirectiveKey(builders.vIdentifier('foo'), null),
        null,
      );

      expect(stringify(node)).toBe('v-foo');
    });

    it('should print an attribute with a value', () => {
      const node = builders.vDirective(
        builders.vDirectiveKey(builders.vIdentifier('foo')),
        builders.vExpressionContainer(b.identifier('bar')),
      );

      expect(stringify(node)).toBe('v-foo="bar"');
    });
  });

  describe('VAttribute', () => {
    it('should print an attribute without a value', () => {
      const node = builders.vAttribute(builders.vIdentifier('foo'), null);

      expect(stringify(node)).toBe('foo');
    });

    it('should print an attribute with a value', () => {
      const node = builders.vAttribute(builders.vIdentifier('foo'), builders.vLiteral('bar'));

      expect(stringify(node)).toBe('foo="bar"');
    });

    it('should escape quotes in a VLiteral attribute value', () => {
      const node = builders.vAttribute(
        builders.vIdentifier('title'),
        builders.vLiteral('she said "hi"'),
      );

      expect(stringify(node)).toBe('title="she said &quot;hi&quot;"');
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
      builders.vStartTag(
        [
          builders.vDirective(
            builders.vDirectiveKey(builders.vIdentifier('if')),
            builders.vExpressionContainer(b.identifier('someCondition')),
          ),
        ],
        true,
      ),
      [],
    );

    expect(stringify(node)).toBe('<div v-if="someCondition" />');
  });

  it('should print a void element', () => {
    const node = builders.vElement(
      'br',
      builders.vStartTag(
        [
          builders.vDirective(
            builders.vDirectiveKey(builders.vIdentifier('if')),
            builders.vExpressionContainer(b.identifier('someCondition')),
          ),
        ],
        true,
      ),
      [],
    );

    expect(stringify(node)).toBe('<br v-if="someCondition">');
  });

  it('should print an element with children', () => {
    const node = builders.vElement('Foo', builders.vStartTag([], false), [
      builders.vElement('span', builders.vStartTag([], false), [builders.vText('Hello')]),
    ]);

    expect(stringify(node)).toBe('<Foo><span>Hello</span></Foo>');
  });
});

describe('VFilterSequenceExpression', () => {
  it('should print filter args', () => {
    const filter = builders.vFilterSequenceExpression(b.identifier('myValue'), [
      builders.vFilter(b.identifier('myFilter'), [b.identifier('arg1'), b.identifier('arg2')]),
      builders.vFilter(b.identifier('myOtherFilter'), []),
    ]);

    expect(stringify(filter)).toBe('myValue | myFilter(arg1, arg2) | myOtherFilter');
  });
});

describe('VText with leading comment', () => {
  it('should print the comment before the text', () => {
    const comment = builders.htmlComment(' before ');
    const node = builders.vText('hello', comment);
    expect(stringify(node)).toBe('<!-- before -->hello');
  });
});

describe('VDocumentFragment', () => {
  it('should stringify all children', () => {
    const doc = builders.vDocumentFragment([
      builders.vElement('div', builders.vStartTag([], false), [builders.vText('A')]),
      builders.vElement('span', builders.vStartTag([], false), [builders.vText('B')]),
    ]);
    expect(stringify(doc)).toBe('<div>A</div><span>B</span>');
  });

  it('should stringify an empty fragment', () => {
    const doc = builders.vDocumentFragment([]);
    expect(stringify(doc)).toBe('');
  });
});

describe('VForExpression', () => {
  it('should stringify a single-variable v-for', () => {
    const node = builders.vForExpression([b.identifier('item')], b.identifier('items'));
    expect(stringify(node)).toBe('item in items');
  });

  it('should stringify a multi-variable v-for with parentheses', () => {
    const node = builders.vForExpression(
      [b.identifier('item'), b.identifier('index')],
      b.identifier('items'),
    );
    expect(stringify(node)).toBe('(item, index) in items');
  });
});

describe('VOnExpression', () => {
  it('should stringify a v-on expression with a body', () => {
    const node = builders.vOnExpression([
      b.expressionStatement(b.callExpression(b.identifier('doSomething'), [])),
    ]);
    expect(stringify(node)).toBe('doSomething();');
  });

  it('should stringify a v-on expression with an empty body', () => {
    const node = builders.vOnExpression([]);
    expect(stringify(node)).toBe('');
  });

  it('should stringify a v-on expression with multiple statements', () => {
    const node = builders.vOnExpression([
      b.expressionStatement(b.callExpression(b.identifier('a'), [])),
      b.expressionStatement(b.callExpression(b.identifier('b'), [])),
    ]);
    expect(stringify(node)).toBe('a(); b();');
  });
});

describe('VSlotScopeExpression', () => {
  it('should stringify a slot scope with params', () => {
    const node: import('./ast').VSlotScopeExpression = {
      type: 'VSlotScopeExpression',
      params: [b.identifier('slotProps')],
      // @ts-expect-error Parent not set
      parent: undefined,
    };
    expect(stringify(node)).toBe('slotProps');
  });

  it('should stringify a slot scope with no params', () => {
    const node: import('./ast').VSlotScopeExpression = {
      type: 'VSlotScopeExpression',
      params: [],
      // @ts-expect-error Parent not set
      parent: undefined,
    };
    expect(stringify(node)).toBe('');
  });
});

describe('VGenericExpression', () => {
  it('should stringify generic params', () => {
    const param = b.tsTypeParameter('T');
    param.constraint = b.tsStringKeyword();
    const node: import('./ast').VGenericExpression = {
      type: 'VGenericExpression',
      params: [param],
      rawParams: ['T extends string'],
      // @ts-expect-error Parent not set
      parent: undefined,
    };
    expect(stringify(node)).toContain('T');
  });
});

describe('VExpressionContainer', () => {
  it('should stringify a null expression as empty', () => {
    const node = builders.vExpressionContainer(null);
    expect(stringify(node)).toBe('');
  });

  it('should stringify a VForExpression child', () => {
    const forExpr = builders.vForExpression([b.identifier('item')], b.identifier('items'));
    const container = builders.vExpressionContainer(forExpr);
    expect(stringify(container)).toBe('item in items');
  });

  it('should stringify a VFilterSequenceExpression child', () => {
    const filter = builders.vFilterSequenceExpression(b.identifier('val'), [
      builders.vFilter(b.identifier('upper'), []),
    ]);
    const container = builders.vExpressionContainer(filter);
    expect(stringify(container)).toBe('val | upper');
  });

  it('should stringify a regular expression using recast', () => {
    const container = builders.vExpressionContainer(
      b.binaryExpression('+', b.identifier('a'), b.identifier('b')),
    );
    expect(stringify(container)).toBe('a + b');
  });
});

describe('VElement with expression container children', () => {
  it('should wrap expression containers in {{ }}', () => {
    const node = builders.vElement('span', builders.vStartTag([], false), [
      builders.vText('Hello '),
      builders.vExpressionContainer(b.identifier('name')),
    ]);
    expect(stringify(node)).toBe('<span>Hello {{ name }}</span>');
  });

  it('should print leading comment before expression container', () => {
    const comment = builders.htmlComment(' expr ');
    const node = builders.vElement('span', builders.vStartTag([], false), [
      builders.vExpressionContainer(b.identifier('x'), comment),
    ]);
    expect(stringify(node)).toBe('<span><!-- expr -->{{ x }}</span>');
  });
});

describe('VStartTag as void element', () => {
  it('should not print the slash for a void element even if selfClosing=true', () => {
    const node = builders.vElement(
      'input',
      builders.vStartTag(
        [builders.vAttribute(builders.vIdentifier('type'), builders.vLiteral('text'))],
        true,
      ),
      [],
    );
    // void elements don't get the '/' even when selfClosing is true
    expect(stringify(node)).toBe('<input type="text">');
  });
});

describe('VEndTag with leading comment', () => {
  it('should print the leading comment', () => {
    const comment = builders.htmlComment(' end comment ');
    const endTag = builders.vEndTag(comment);
    expect(stringify(endTag)).toBe('<!-- end comment -->');
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
      builders.htmlComment(' 2 ', builders.htmlComment(' 3 ')),
    );

    expect(stringifyHtmlComment(comment)).toBe('<!-- 3 --><!-- 2 --><!-- 1 -->');
  });

  it('should throw if the comment value contains a comment terminator', () => {
    const comment = builders.htmlComment(' --> dangerous ');

    expect(() => stringifyHtmlComment(comment)).toThrowError(/comment terminator/);
  });

  it('should throw if the comment value contains the alternate `--!>` terminator', () => {
    const comment = builders.htmlComment(' --!> dangerous ');

    expect(() => stringifyHtmlComment(comment)).toThrowError(/comment terminator/);
  });

  it('should allow bare double-dash inside a comment value', () => {
    const comment = builders.htmlComment(' -- hello -- ');

    expect(stringifyHtmlComment(comment)).toBe('<!-- -- hello -- -->');
  });
});
