import { it, expect } from 'vitest';
import { type CodemodPlugin, transform } from '../main';

const plugin: CodemodPlugin = {
  name: 'test',
  type: 'codemod',
  transform({ sfcAST, utils: { astHelpers, builders } }) {
    if (sfcAST) {
      const script = astHelpers.findFirst(sfcAST, { type: 'VElement', name: 'script' });

      script?.startTag.attributes.push(builders.vAttribute(builders.vIdentifier('setup'), null));

      sfcAST.children.push(
        builders.vElement(
          'style',
          builders.vStartTag([], false),
          [
            builders.vText('\n.red {\n  color: red;\n}\n'),
          ],
        ),
      );
    }
    return 1;
  },
};

it('', () => {
  const code = `
<script>
export default {}
</script>`;

  expect(transform(code, 'file.vue', [plugin]).code).toMatchInlineSnapshot(`
    "
    <script setup>
    export default {}
    </script>
    <style>
    .red {
      color: red;
    }
    </style>"
  `);
});
