# Stoner‑Framework VS Code Extension  

Advanced navigation, refactoring and _visual hints_ for projects that use the placeholders pattern.

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
|------------------|--------------|------------------|
| **`<!-- placeholder -->`<br>Highlighting** | Every placeholder is tinted in a color distinct from a normal HTML comment. | any `.html` from `/_pages` |
| **Inline diagnostics**<br>(errors / warnings) | While you edit **`_componentsMap.js`** the extension instantly checks for:<br>  • bad placeholder syntax (`<!-- name -->` required)<br>  • duplicate placeholders<br>  • missing **`dataFile`** or **`component`** files<br>  • placeholders that are **not used** in any HTML page | in `_componentsMap.js` |
| `<!-- placeholder -->`<br>**Safe Renaming** | Press <kbd>F2</kbd> on a placeholder to rename it everywhere (map & pages). | in `_componentsMap.js` and any `.html` from `/_pages` |
| **`16 usages`**<br>`<!-- placeholder -->` *CodeLens* | Shows how many times a placeholder appears; click to jump to all usages. | above each placeholder in `_componentsMap.js` and any `.html` from `/_pages` |
| **`open`** <br>`dataFile: '…'` *CodeLens* | Click to open the JSON file mapped to a placeholder. | above every `dataFile: '…'` in `_componentsMap.js` |
| **<kbd>Ctrl‑Click</kbd>** any <br>`<!-- placeholder -->` | On a page: go to the component source, its JSON, and the mapping entry.<br>On `_componentsMap.js`: list all HTML usages of that placeholder. | in `_componentsMap.js` and any `.html` from `/_pages` |

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
