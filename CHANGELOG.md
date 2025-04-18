### `0.4.2` ‑ 2025‑04‑18
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
