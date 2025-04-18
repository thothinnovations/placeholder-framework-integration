### `0.4.6` ‑ 2025‑04‑18
#### Added
- **CodeLens: `{n} mappings` for any `.json` dataFile**  
  Displays how many times the current JSON file is referenced in **`_componentsMap.js`** and, when clicked, lists every mapping line.
<br>

- **CodeLens: `open` for any `component:` entry in `_componentsMap.js`**  
  Opens the corresponding `.js` file for the component.
<br>

- **CodeLens on HTML placeholders**  
  In addition to *“{n} usages”*, each `<!-- placeholder -->` inside an HTML file now gets:  
  - **`component`** – opens the mapped component’s `.js` module.  
  - **`dataFile`** – opens the mapped `.json` file (omitted when the mapping uses `noData`).  

#### Fixed
- **Missing buttons / false “No component found” error**  
  A fragile regex in `parseComponentsMap()` failed when a `dataFile:` line contained an inline `//` comment, causing the corresponding placeholder (e.g. `bottlesSection_vsl`) to be skipped.  
  The pattern was rewritten to tolerate comments and whitespace, restoring the *component* and *dataFile* buttons and eliminating the error.

---

### `0.4.2` ‑ 2025‑04‑17
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
