<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/logo-dark.svg" />
    <img src="assets/logo-light.svg" alt="Oculis" width="320" />
  </picture>
</p>

<p align="center">
  <b>Open is the only verb.</b><br />
  A minimalist, read-only Markdown viewer. Opinionated, GitHub by default.
</p>

---

No editing. No formatting. No saving. Oculis opens Markdown and renders it the way GitHub does.

## What it does

- GitHub Flavored Markdown, alerts, footnotes, heading anchors
- Syntax highlighting by [@pierre/highlights](https://diffs.com/highlights)
- Mermaid diagrams by [Pele](https://pele.run/)
- Light and dark, following the system
- Live reload that keeps your scroll position
- Relative images, and `.md` links open in place

## Run

```sh
bun install
bun run start            # empty window, drop a file in
bun run start README.md  # open a file
bun run dist             # build an installer
```

## Keys

| Key | Action |
| --- | --- |
| `Ctrl+O` | Open |
| `Ctrl+R` | Reload |
| `Ctrl+=` `Ctrl+-` `Ctrl+0` | Zoom |
| `F11` | Full screen |
| `Alt` | Show the menu |
