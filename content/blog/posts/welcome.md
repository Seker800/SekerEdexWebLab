---
title: Welcome to the command deck
summary: Using the filesystem as a blog navigation model.
publishedAt: 2026-09-18
tags: notes, interface
---
# Welcome to the command deck

This folder is the content entrance for the future blog. Articles remain ordinary files, while the center panel provides a focused reading view.

## How it works

- Select a folder to browse its children.
- Select a Markdown file to read it in the center panel.
- Select an image to open the media viewer.

The terminal can still read the same source with `cat`, so navigation and content share one filesystem model.

## One content source

The article body lives in a Markdown file and enters the application through a checked build manifest. The filesystem, terminal command and reader consume that same document instead of maintaining parallel copies.

## Keyboard path

The reader body accepts focus so long documents can be scrolled with Page Down, Page Up, Home and End. Returning to the shell restores the terminal controls and their original accessibility state.

## Presentation

Markdown is only the authoring format. The visible document keeps the command deck's typography, borders, color hierarchy and file context rather than adopting an unrelated blog theme.

## Files remain inspectable

Every document is still a readable file in the sandbox. A visitor can browse to it, preview it, or use the terminal to inspect the same source. The formatted view is a presentation adapter over that file rather than a second copy of its contents.

## Runtime boundaries

Opening an article temporarily removes the hidden terminal controls from keyboard navigation. Closing it restores those controls without rebuilding the session, so command history and the current directory remain intact.

## Media boundaries

Images use a separate modal layer with its own focus boundary. The modal isolates the command deck while it is open and returns focus to the file that launched it when it closes.

## Build boundary

The build validates document metadata before the application can be published. Invalid or incomplete content fails early instead of leaking an ambiguous entry into the virtual filesystem.

## Long term direction

This arrangement keeps authoring, content validation, filesystem navigation and rendering in separate modules. A future route generator can consume the same manifest without teaching the filesystem adapter about page generation or storage.
