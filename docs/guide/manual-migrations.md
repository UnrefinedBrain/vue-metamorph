# Manual migrations

Some code changes can't be automated reliably and need human attention. To find the places in
your source code that need such a change, write a manual migration plugin.

The vue-metamorph CLI runs manual migration plugins *after* it runs codemod plugins.

::: danger

Don't mutate the AST in a manual migration. vue-metamorph passes the same AST object to every
manual migration plugin, so a mutation can cause later plugins to report incorrect results.

:::


```ts twoslash
import { ManualMigrationPlugin } from 'vue-metamorph';

const migrateVueEmitter: ManualMigrationPlugin = {
  type: 'manual',
  name: 'Migrate vue event emitter',
  find({
    scriptASTs,
    sfcAST,
    filename,
    report,
    utils: { traverseScriptAST }
  }) {
    for (const scriptAST of scriptASTs) {
      traverseScriptAST(scriptAST, {
        visitCallExpression(path) {
          // find calls to the $on(), $off(), and $once() functions
          if (path.node.callee.type === 'MemberExpression'
            && path.node.callee.property.type === 'Identifier'
            && ['$on', '$off', '$once'].includes(path.node.callee.property.name)) {

            // to report a manual migration for a node, call report()
            // with the node and a message
            report(path.node.callee, 'Migrate the event emitter methods');
          }
          this.traverse(path);
        }
      });
    }
  }
}

```

For this manual migration plugin, the CLI output is similar to the following:


```
path/to/my/file.js 4:1-4:12
Migrate the event emitter methods

1 | import MyComponent from './MyComponent.vue';
2 |
3 | const instance = new MyComponent();
4 | instance.$on('click', () => { console.log('clicked'); });
  | ^^^^^^^^^^^^
5 |
6 | // ...
7 |

```
