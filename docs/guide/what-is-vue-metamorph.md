# What is vue-metamorph?

vue-metamorph is a codemod framework for JavaScript, TypeScript, and Vue files. It provides a way to reliably make large-scale changes to a codebase by manipulating Abstract Syntax Trees.

## The Basics

vue-metamorph is designed around the concept of plugins. There are two types of plugins: **codemod plugins** and **manual migration plugins**.

A codemod plugin can mutate and manipulate an AST to make changes to the source code it was parsed from. A manual migration plugin can find and report on AST nodes that require human attention.

## Comparison to Regex

While regex is a very powerful find-and-replace tool, it might not be the best choice for modifying source code if your use case goes beyond simple changes. Differences in formatting such as whitespace or unnecessary parentheses can make regex-based code transformation difficult and unreliable. Since codemods work with the grammar of the language, these sorts of stylistic code differences are handled seamlessly and reliably.

## Comparison to jscodeshift

Similar to [jscodeshift](https://github.com/facebook/jscodeshift), vue-metamorph provides a wrapper around [recast](https://github.com/benjamn/recast). However, since recast and jscodeshift are limited to working only with ESTree-based ASTs, vue-metamorph also provides a similar mechanism for working the the `<template>` AST in a Vue SFC.

## Comparison to vue-codemod

[vue-codemod](https://github.com/vuejs/vue-codemod) is an experimental project that implements codemods for upgrading Vue projects from Vue 2 to Vue 3. While it also wraps jscodeshift/recast, it also didn't provide a way to manipulate source code entirely through ASTs. vue-codemod provides some utilities for working with text-based operations, but doesn't come full circle to provide a recast-like experience for the entire SFC.

## 💡 Motivation

Somewhat often, we find ourselves needing to make the same changes over and over and over again to a large set of files in a codebase. No matter how good your regex skills are, sometimes regex is just not up to the job.

That's where codemods come in. A codemod allows us to make changes based on the grammar of the language we're working in, instead of simple text patterns like with regex. With a codemod, we can easily and accurately make changes to a large number of files with minimal effort.

vue-metamorph was created to facilitate those sorts of large-scale changes in Vue codebases.
