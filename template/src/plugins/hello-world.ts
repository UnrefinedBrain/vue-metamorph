import { CodemodPlugin } from 'vue-metamorph';

export const helloWorldCodemod: CodemodPlugin = {
  type: 'codemod',
  name: 'hello-world',
  transform(scriptASTs, _templateAST, _filename, { traverseScriptAST, astHelpers }) {
    let transformCount = 0;

    if (scriptASTs[0]) {
      traverseScriptAST(scriptASTs[0], {
        visitLiteral(path) {
          if (typeof path.node.value === 'string') {
            path.node.value = 'Hello, world!';
            transformCount++;
          }

          this.traverse(path);
        },
      });

      // or, using the findAll helper
      astHelpers
        .findAll(scriptASTs[0], { type: 'Literal' })
        .forEach((literal) => {
          if (typeof literal.value === 'string') {
            literal.value = 'Hello, world!';
            transformCount++;
          }
        });
    }

    return transformCount;
  },
};
