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
| **`<!-- placeholder -->`<br>Highlighting** | Every placeholder gets highlighted with a color distinct from an usual `.html` comment. | any `.html` from `/_pages` |
| `<!-- placeholder -->`<br>**Safe Renaming** | Press <kbd>F2</kbd> on a placeholder to rename it everywhere. | in `_componentsMap.js` and any `.html` from `/_pages` |
| **`16 usages`**<br>`<!-- placeholder -->` *CodeLens counter* | Click to see every usage of a placeholder | above each placeholder in `_componentsMap.js` and any `.html` from `/_pages` |
| **`open`** <br>`dataFile: '...`<br>*CodeLens command* | Opens the JSON data file referenced by the mapped component. | above every `dataFile: '...` in `_componentsMap.js` |
| **<kbd>Ctrl‑Click</kbd>** any <br>`<!-- placeholder -->` | On a `.html` page to see the:<br>  • component `.js` file<br>  • mapped `.json` file<br>  • mapping in `_componentsMap.js` | any `.html` from `/_pages` |
|  | In `_componentsMap.js` to:<br>   • list all `.html` usages. | in `_componentsMap.js` |


<br>

---

<br>

## 🚀 Performance notes
* All HTML files are scanned **once**, then cached per workspace.
* Regex‑based search keeps things fast even in large code‑bases.
* Decorations are updated only for the active editor, minimising redraw cost.

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
