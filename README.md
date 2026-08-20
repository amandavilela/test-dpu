# Declarative Partial Updates Demo

This little fixtures demo (`test-dpu`) was built as part of ["Less JS, more platform: A hands-on test of Declarative Partial Updates" post](https://amandavilela.me/blog/declarative-partial-updates-hands-on-test/) to demonstrate **Declarative Partial Updates (DPU)** usage. 

It renders the next 5 Brasileirão Série A fixtures as ticket-style
cards. Skeleton placeholders are shown immediately, then each fixture is
"streamed" into its card at a staggered interval, either from the real
[football-data.org](https://www.football-data.org/) API or from generated
sample data.

This PoC covers both halves of DPU: the new HTML insertion/streaming methods
(`streamHTML()`) and the declarative out-of-order patching pattern
(`<?start>`/`<?end>` markers plus `<template for>`). There's no JS fallback,
it's a native-only demo, so without browser support the fixtures stay as
placeholders.

## Running locally

```sh
bun bun-serve.js
```

Then open `http://localhost:4040`.
