### `0.5.0` ‑ 2025‑04‑19
#### Added
- **Clickable `/public` asset path links**  
  - Any `/public/...` paths in `.js` component files or `.json` dataFiles are underlined and become clickable links (Ctrl‑Click) to open the asset file.

<br>

- **CodeLens: `{n} mappings` for any `.js` component file**  
  Displays how many times the current `.js` component file is referenced in **`_componentsMap.js`** and, when clicked, lists every mapping line
  
<br>

- **Inline diagnostics** *(errors / warnings)*
  - The extension now displays a warning if a component is not being mapped anywhere in `_componentsMap.js`
  - When editing a `.js` component file or a `.json` dataFile, any `/public/...` path that does not resolve to an existing file produces an inline error on that line.

#### Changed
- **package.json activationEvents** now includes `onLanguage:json` so the extension activates immediately when opening `.json` files.

---

### `0.4.6` ‑ 2025‑04‑18
#### Added
- **CodeLens: `{n} mappings` for any `.json` dataFile**  
  Displays how many times the current JSON file is referenced in **`_componentsMap.js`** and, when clicked, lists every mapping line.<br>

- **CodeLens: `open` for any `component:` entry in `_componentsMap.js`**  
  Opens the corresponding `.js` file for the component.<br>

- **CodeLens on HTML placeholders**  
  In addition to *“{n} usages”*, each `<!-- placeholder -->` inside an HTML file now gets:  
  - **`component`** – opens the mapped component’s `.js` module.  
  - **`dataFile`** – opens the mapped `.json` file (omitted when the mapping uses `noData`).

- **Inline diagnostics errors** 
  While editing **`_componentsMap.js`** the extension now checks:
  - If the `dataFile:` contains valid `.json` data.
  - If the `component:` properly exports a function.


#### Fixed
- **Missing buttons / false “No component found” error**  
  A fragile regex in `parseComponentsMap()` failed when a `dataFile:` line contained an inline `//` comment, causing the corresponding placeholder (e.g. `bottlesSection_vsl`) to be skipped.  
  The pattern was rewritten to tolerate comments and whitespace, restoring the *component* and *dataFile* buttons and eliminating the error.

---

### `0.4.2` ‑ 2025‑04‑17
#### Added
- **Live placeholder validation for `_componentsMap.js`**  
  - **Syntax checker** – raises an error when a `placeholder:` value does not **start** with `<!-- ` *or* does not **end** with ` -->`.  
  - **Duplicate checker** – raises an “already in use” error when the same placeholder name is declared more than once.  
  - **Missing‑file checker** – raises a “file not found” error when:  
    - a `dataFile:` path does not resolve to an existing file (ignored for `noData`), or  
    - a `component:` path does not resolve to an existing module file.  
  - **Unused‑component checker** – raises a **warning** when a `placeholder:` is mapped but not referenced in any `.html` page.  
- New diagnostic collection **`componentsPlaceholders`**, refreshed automatically on file open, change, or close.  
- First‑run validation of all already‑opened `_componentsMap.js` documents during extension activation.

#### Changed
- Extension activation now registers event listeners (`onDidOpenTextDocument`, `onDidChangeTextDocument`, `onDidCloseTextDocument`) to keep diagnostics in sync.
