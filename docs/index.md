---
# https://vitepress.dev/reference/default-theme-home-page
layout: home

hero:
  name: "vue-metamorph"
  tagline: "Codemod framework for Vue projects"
  image:
    src: /logo-small.png
  actions:
    - theme: brand
      text: Get started
      link: /guide/installation
    - theme: alt
      text: Playground
      link: /playground

features:
  - title: AST-based code manipulation
    icon: 🌲
    details: Make large-scale changes to your codebase reliably by mutating abstract syntax trees.
  - title: Support for many file types
    icon: 🗃️
    details: Transform Vue SFC, JavaScript, TypeScript, CSS, SCSS, Sass, Less, and Stylus files.
  - title: Built-in CLI
    icon: 🚀
    details: Run your codemods against many files with the built-in CLI, or call the codemod API directly.
  - title: Codemod scaffolding
    icon: 🧰
    details: Create a new codemod project with the included scaffolding tool.
---
