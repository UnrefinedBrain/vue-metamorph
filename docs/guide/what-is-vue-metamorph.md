# What is vue-metamorph?

vue-metamorph is a codemod framework for JavaScript, TypeScript, and Vue files. It gives you a
way to make large-scale changes to a codebase reliably, by manipulating abstract syntax trees
(ASTs).

## Basics

vue-metamorph is designed around the concept of plugins. There are two types of plugins:
**codemod plugins** and **manual migration plugins**.

A codemod plugin manipulates an AST to change the source code that the AST was parsed from. A
manual migration plugin finds and reports AST nodes that need human attention.

## Comparison to regular expressions

Regular expressions are a powerful find-and-replace tool, but they aren't always a good fit for
modifying source code. Differences in formatting, such as whitespace or extra parentheses, make
regex-based code transformation difficult and unreliable. Because codemods work with the grammar
of the language, they handle these stylistic differences for you.

## Comparison to jscodeshift

Like [jscodeshift](https://github.com/facebook/jscodeshift), vue-metamorph wraps
[recast](https://github.com/benjamn/recast). However, recast and jscodeshift work only with
ESTree-based ASTs, so vue-metamorph adds a similar mechanism for working with the `<template>`
AST in a Vue single-file component (SFC).

## Comparison to vue-codemod

[vue-codemod](https://github.com/vuejs/vue-codemod) is an experimental project that implements
codemods for upgrading Vue projects from Vue 2 to Vue 3. It also wraps jscodeshift and recast,
but it doesn't provide a way to manipulate source code entirely through ASTs. It includes some
utilities for text-based operations, but it doesn't offer a recast-like experience for the
entire SFC.

## Motivation

Applying the same change over and over to a large set of files is common work, and regular
expressions aren't always a reliable way to do it. A codemod changes code based on the grammar
of the language instead of on text patterns, so you can make accurate changes across a large
number of files with little effort.

vue-metamorph exists to make those large-scale changes practical in Vue codebases.
