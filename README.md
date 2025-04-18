# `stoner-framework` VS Code Extension  

Advanced navigation, hints, diagnostics and refactoring for `stoner-framework` projects using the `<!-- placeholder -->` pattern.

<br>

## 🛠️ Installation

1. Download the latest **`.vsix`** from the [releases page](https://github.com/thothinnovations/stoner-framework-integration/releases/tag/latest).  
2. In a terminal run  
   ```sh
   code --install-extension stoner-framework-integration‑x.y.z.vsix
   ```  
3. Reload VS Code.

<br>

## ✨ What you get

| Feature | What it does | Where it applies |
|----------------------|--------------|------------------|
| **`<!-- placeholder -->` Highlighting** | Every placeholder is tinted in a color distinct from a normal HTML comment. | any `.html` from `/_pages` |
| **Inline diagnostics** *(errors / warnings)* | While you edit **`_componentsMap.js`** the extension instantly checks for:<br>  • bad placeholder syntax (`<!-- ` and ` -->` are required)<br>  • duplicate placeholders<br>  • missing **`dataFile`** or **`component`** files<br>  • placeholders that are **not used** in any HTML page | in `_componentsMap.js` |
| **Safe Renaming** | Press <kbd>F2</kbd> on a placeholder to rename it everywhere (map & pages). | in `_componentsMap.js` and any `.html` from `/_pages` |
| **`16 usages`** CodeLens | Shows how many times a placeholder appears; click to jump to all usages. | above each placeholder in `_componentsMap.js` and any `.html` from `/_pages` |
| **`component` / `dataFile`** CodeLens | Jump straight to the mapped component’s `.js` module or its `.json` data file (the second button is hidden when the mapping uses **`noData`**). | above each placeholder in `.html` files |
| **`open`** CodeLens on `dataFile:` | Click to open the JSON file mapped to a placeholder. | above every `dataFile:` entry in `_componentsMap.js` |
| **`open`** CodeLens on `component:` | Click to open the JS file mapped to a placeholder. | above every `component:` entry in `_componentsMap.js` |
| **`{n mappings}`** CodeLens | Counts how many times the current JSON file is referenced in **`_componentsMap.js`**; click to view all mapping lines. | any `.json` under `/_data` |
| **<kbd>Ctrl‑Click</kbd> any `<!-- placeholder -->`** | On a page: go to the component source, its JSON, and the mapping entry.<br>On `_componentsMap.js`: list all HTML usages of that placeholder. | in `_componentsMap.js` and any `.html` from `/_pages` |

<br>

---

<br>

## 🚀 Performance notes
* All HTML files are scanned **once**, then cached per workspace.
* Regex‑based search keeps things fast even in large code‑bases.
* Decorations and diagnostics are updated only for the active editor, minimising redraw cost.

<br>

## 🧩 Expected project structure
```
your‑project/
├─ _componentsMap.js
├─ _components/
│   └─ data/
│       └─ someSection.json
│   └─ someSection.js
└─ _pages/
    └─ index.html
```

*The extension auto‑detects `_componentsMap.js` in any nested folder and scopes all work to that folder’s subtree only.*

<br>

---