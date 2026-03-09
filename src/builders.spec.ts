import { describe, it, expect } from 'vitest';
import {
  setParents,
  vAttribute,
  vDirective,
  vDirectiveKey,
  vDocumentFragment,
  vEndTag,
  vElement,
  vExpressionContainer,
  vForExpression,
  vIdentifier,
  vLiteral,
  vStartTag,
  vText,
  vOnExpression,
  vFilterSequenceExpression,
  vFilter,
  htmlComment,
} from './builders';
import { builders } from 'ast-types-x';

describe('builders', () => {
  describe('vIdentifier', () => {
    it('should create a VIdentifier with name and rawName equal', () => {
      const node = vIdentifier('click');
      expect(node).toEqual({
        type: 'VIdentifier',
        name: 'click',
        rawName: 'click',
        parent: undefined,
      });
    });

    it('should create a VIdentifier with a different rawName', () => {
      const node = vIdentifier('bind', ':');
      expect(node.name).toBe('bind');
      expect(node.rawName).toBe(':');
    });
  });

  describe('vLiteral', () => {
    it('should create a VLiteral node', () => {
      const node = vLiteral('hello');
      expect(node).toEqual({
        type: 'VLiteral',
        parent: undefined,
        value: 'hello',
      });
    });
  });

  describe('vAttribute', () => {
    it('should create a non-directive attribute with a value', () => {
      const node = vAttribute(vIdentifier('class'), vLiteral('my-class'));
      expect(node.type).toBe('VAttribute');
      expect(node.directive).toBe(false);
      expect(node.key.name).toBe('class');
      expect(node.value!.value).toBe('my-class');
    });

    it('should create a boolean attribute with null value', () => {
      const node = vAttribute(vIdentifier('disabled'), null);
      expect(node.directive).toBe(false);
      expect(node.value).toBeNull();
    });
  });

  describe('vDirective', () => {
    it('should create a directive node', () => {
      const key = vDirectiveKey(vIdentifier('if'));
      const value = vExpressionContainer(builders.identifier('show'));
      const node = vDirective(key, value);
      expect(node.type).toBe('VAttribute');
      expect(node.directive).toBe(true);
      expect(node.key.type).toBe('VDirectiveKey');
    });

    it('should create a directive with null value', () => {
      const key = vDirectiveKey(vIdentifier('else'));
      const node = vDirective(key, null);
      expect(node.directive).toBe(true);
      expect(node.value).toBeNull();
    });
  });

  describe('vDirectiveKey', () => {
    it('should create a key with defaults', () => {
      const node = vDirectiveKey(vIdentifier('if'));
      expect(node.argument).toBeNull();
      expect(node.modifiers).toEqual([]);
    });

    it('should create a key with argument and modifiers', () => {
      const node = vDirectiveKey(vIdentifier('on'), vIdentifier('click'), [vIdentifier('prevent')]);
      expect(node.name.name).toBe('on');
      expect(node.argument?.type).toBe('VIdentifier');
      expect(node.modifiers).toHaveLength(1);
      expect(node.modifiers[0]!.name).toBe('prevent');
    });
  });

  describe('vStartTag', () => {
    it('should create a self-closing start tag', () => {
      const node = vStartTag([], true);
      expect(node.type).toBe('VStartTag');
      expect(node.selfClosing).toBe(true);
      expect(node.attributes).toEqual([]);
      expect(node.leadingComment).toBeNull();
    });

    it('should create a start tag with a leading comment', () => {
      const comment = htmlComment(' my comment ');
      const node = vStartTag([], false, comment);
      expect(node.leadingComment).toBe(comment);
    });
  });

  describe('vEndTag', () => {
    it('should create an end tag with no comment', () => {
      const node = vEndTag();
      expect(node.type).toBe('VEndTag');
      expect(node.leadingComment).toBeNull();
    });

    it('should create an end tag with a leading comment', () => {
      const comment = htmlComment(' end ');
      const node = vEndTag(comment);
      expect(node.leadingComment).toBe(comment);
    });
  });

  describe('vElement', () => {
    it('should create an element with end tag', () => {
      const tag = vStartTag([], false);
      const node = vElement('div', tag, []);
      expect(node.type).toBe('VElement');
      expect(node.name).toBe('div');
      expect(node.rawName).toBe('div');
      expect(node.endTag).not.toBeNull();
      expect(node.namespace).toBe('http://www.w3.org/1999/xhtml');
    });

    it('should create a self-closing element with no end tag', () => {
      const tag = vStartTag([], true);
      const node = vElement('MyComponent', tag, []);
      expect(node.endTag).toBeNull();
    });

    it('should create a void element with no end tag', () => {
      const tag = vStartTag([], false);
      const node = vElement('br', tag, []);
      expect(node.endTag).toBeNull();
    });

    it('should preserve children in the built node', () => {
      const child1 = vText('hello');
      const child2 = vElement('span', vStartTag([], true), []);
      const tag = vStartTag([], false);
      const node = vElement('div', tag, [child1, child2]);
      expect(node.children).toHaveLength(2);
      expect(node.children[0]).toBe(child1);
      expect(node.children[1]).toBe(child2);
    });

    it('should accept a custom namespace', () => {
      const tag = vStartTag([], false);
      const node = vElement('circle', tag, [], 'http://www.w3.org/2000/svg');
      expect(node.namespace).toBe('http://www.w3.org/2000/svg');
    });
  });

  describe('vText', () => {
    it('should create a text node', () => {
      const node = vText('hello world');
      expect(node.type).toBe('VText');
      expect(node.value).toBe('hello world');
      expect(node.leadingComment).toBeNull();
    });

    it('should create a text node with a leading comment', () => {
      const comment = htmlComment(' before text ');
      const node = vText('hello', comment);
      expect(node.leadingComment).toBe(comment);
    });
  });

  describe('vExpressionContainer', () => {
    it('should create a container with an expression', () => {
      const expr = builders.identifier('foo');
      const node = vExpressionContainer(expr);
      expect(node.type).toBe('VExpressionContainer');
      expect(node.expression).toBe(expr);
      expect((node as unknown as { references: unknown[] }).references).toEqual([]);
      expect(node.leadingComment).toBeNull();
    });

    it('should create a container with a leading comment', () => {
      const comment = htmlComment(' expr ');
      const node = vExpressionContainer(null, comment);
      expect(node.expression).toBeNull();
      expect(node.leadingComment).toBe(comment);
    });
  });

  describe('vForExpression', () => {
    it('should create a v-for expression', () => {
      const left = [builders.identifier('item')];
      const right = builders.identifier('items');
      const node = vForExpression(left, right);
      expect(node.type).toBe('VForExpression');
      expect(node.left).toBe(left);
      expect(node.right).toBe(right);
    });
  });

  describe('vOnExpression', () => {
    it('should create a v-on expression', () => {
      const body = [builders.expressionStatement(builders.identifier('doSomething'))];
      const node = vOnExpression(body);
      expect(node.type).toBe('VOnExpression');
      expect(node.body).toBe(body);
    });
  });

  describe('vFilterSequenceExpression', () => {
    it('should create a filter sequence', () => {
      const expr = builders.identifier('value');
      const filters = [vFilter(builders.identifier('capitalize'), [])];
      const node = vFilterSequenceExpression(expr, filters);
      expect(node.type).toBe('VFilterSequenceExpression');
      expect(node.expression).toBe(expr);
      expect(node.filters).toHaveLength(1);
    });
  });

  describe('vFilter', () => {
    it('should create a filter with no arguments', () => {
      const callee = builders.identifier('uppercase');
      const node = vFilter(callee, []);
      expect(node.type).toBe('VFilter');
      expect(node.callee).toBe(callee);
      expect(node.arguments).toEqual([]);
    });

    it('should create a filter with arguments', () => {
      const callee = builders.identifier('truncate');
      const args = [builders.literal(10)];
      const node = vFilter(callee, args);
      expect(node.arguments).toHaveLength(1);
    });
  });

  describe('vDocumentFragment', () => {
    it('should create a document fragment', () => {
      const child = vText('hello');
      const node = vDocumentFragment([child]);
      expect(node.type).toBe('VDocumentFragment');
      expect(node.children).toHaveLength(1);
    });
  });

  describe('htmlComment', () => {
    it('should create a comment node', () => {
      const node = htmlComment(' my comment ');
      expect(node.type).toBe('HtmlComment');
      expect(node.value).toBe(' my comment ');
      expect(node.leadingComment).toBeNull();
      expect(node.range).toEqual([-1, -1]);
    });

    it('should create a comment with a leading comment', () => {
      const leading = htmlComment(' first ');
      const node = htmlComment(' second ', leading);
      expect(node.leadingComment).toBe(leading);
    });
  });

  describe('setParents', () => {
    it('should set parent references on all children', () => {
      const text = vText('hello');
      const tag = vStartTag([], false);
      const el = vElement('div', tag, [text]);
      const doc = vDocumentFragment([el]);

      setParents(doc);

      expect(el.parent).toBe(doc);
      expect(tag.parent).toBe(el);
      expect(text.parent).toBe(el);
    });

    it('should set parent on nested elements', () => {
      const innerText = vText('inner');
      const innerTag = vStartTag([], false);
      const inner = vElement('span', innerTag, [innerText]);
      const outerTag = vStartTag([], false);
      const outer = vElement('div', outerTag, [inner]);
      const doc = vDocumentFragment([outer]);

      setParents(doc);

      expect(inner.parent).toBe(outer);
      expect(innerText.parent).toBe(inner);
    });

    it('should set parent on attributes', () => {
      const attr = vAttribute(vIdentifier('class'), vLiteral('red'));
      const tag = vStartTag([attr], false);
      const el = vElement('div', tag, []);
      const doc = vDocumentFragment([el]);

      setParents(doc);

      expect(attr.parent).toBe(tag);
      expect(attr.key.parent).toBe(attr);
    });
  });
});
