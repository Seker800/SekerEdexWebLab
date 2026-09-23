---
title: Building a blog inside eDEX
summary: The content architecture behind the command deck.
publishedAt: 2026-09-18
tags:
  - engineering
  - design
---
# Building a blog inside eDEX

The blog keeps the single screen command deck and gives each region a useful role.

![The command deck regions](./command-deck.svg)

## Content flow

1. The build creates a validated content manifest from ordinary Markdown files and media.
2. The filesystem projects that manifest into folders and typed previews.
3. The command deck controller owns the selected article.
4. The reader resolves safe Markdown links against the same content tree.
5. The image viewer owns zoom, directory-local sequence navigation, and dismissal.

![The typed content flow](./content-flow.svg)

This keeps content data separate from DOM rendering and from the virtual filesystem adapter.
