# Manual Migrations

Sometimes, a code change is needed that cannot be easily or reliably automated and requires human attention. For finding such places in our source code, vue-metamorph provides an interface for this.

The vue-metamorph CLI runs manual migration plugins *after* running codemod plugins.

::: danger

Do not mutate the AST in manual migrations! vue-metamorph passes the same AST object to each manual migration plugin, so any mutations may cause incorrect results from later plugins.

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
          // find calls to $on(), $off(), $once() functions
          if (path.node.callee.type === 'MemberExpression'
            && path.node.callee.property.type === 'Identifier'
            && ['$on', '$off', '$once'].includes(path.node.callee.property.name)) {

            // To show a manual migration result for a node, call `report()` and pass the node and a message
            report(path.node.callee, 'Migrate the event emitter methods');
          }
          this.traverse(path);
        }
      });
    }
  }
}

```

The CLI output for this manual migration plugin might look like:


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

---

