/** Starting points, one per source type, plus a codemod that runs against them. */

const VUE = `<template>
  <div class="greeting">
    <MyButton v-if="visible" :label="label" @click="greet">
      {{ label }}
    </MyButton>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const visible = ref(true);
const label = ref('Say hello');

function greet() {
  console.log('hello');
}
</script>

<style lang="scss" scoped>
.greeting {
  color: red;

  .label {
    font-weight: bold;
  }
}
</style>
`;

const SCRIPT = `import { defineComponent } from 'vue';

export default defineComponent({
  name: 'MyComponent',

  data() {
    return {
      count: 0,
    };
  },

  methods: {
    increment() {
      this.count += 1;
    },
  },
});
`;

const JSX = `export const Button = (props) => (
  <button class="button" onClick={props.onClick}>
    {props.label}
  </button>
);
`;

const CSS = `.greeting {
  color: red;
  font-weight: bold;
}

@media (min-width: 640px) {
  .greeting {
    color: blue;
  }
}
`;

const SCSS = `$brand: red;

.greeting {
  color: $brand;

  .label {
    font-weight: bold;
  }
}
`;

const SASS = `$brand: red

.greeting
  color: $brand

  .label
    font-weight: bold
`;

const LESS = `@brand: red;

.greeting {
  color: @brand;

  .label {
    font-weight: bold;
  }
}
`;

export const SAMPLES: Record<string, string> = {
  vue: VUE,
  ts: SCRIPT,
  tsx: JSX,
  js: SCRIPT,
  jsx: JSX,
  css: CSS,
  scss: SCSS,
  sass: SASS,
  less: LESS,
};

export const SAMPLE_CODEMOD = `import { type CodemodPlugin } from 'vue-metamorph';

const plugin: CodemodPlugin = {
  type: 'codemod',
  name: 'rename-my-button',

  transform({ sfcAST, scriptASTs, styleASTs, utils: { traverseTemplateAST } }) {
    let count = 0;

    if (sfcAST) {
      traverseTemplateAST(sfcAST, {
        enterNode(node) {
          if (node.type === 'VElement' && node.rawName === 'MyButton') {
            node.rawName = 'AppButton';
            node.name = 'appbutton';
            count += 1;
          }
        },

        leaveNode() {
          // nothing to do on the way out
        },
      });
    }

    return count;
  },
};

export default plugin;
`;

export function sampleFor(sourceTypeId: string): string {
  return SAMPLES[sourceTypeId] ?? '';
}
