# Stoner‑Framework VS Code Extension  

Advanced navigation, refactoring and _visual hints_ for projects that use the placeholders pattern.

<br>

---

## 🛠️ Installation

1. Download the latest **`.vsix`** from the [releases page](https://github.com/thothinnovations/stoner-framework-integration/releases/tag/latest).  
2. In a terminal run  
   ```sh
   code --install-extension stoner-framework-integration‑x.y.z.vsix
   ```  
3. Reload VS Code.

<br>

---

## ✨ What you get

| Visual / Command | What it does | Where it appears |
|------------------|--------------|------------------|
| **`<n> usages` counter (CodeLens)** | Click to see every HTML occurrence of a placeholder | • Above each `<!-- placeholder -->` in *.html*<br>• Above each `placeholder:` entry inside **_componentsMap.js** |
| **`open` dataFiles (CodeLens)** | Opens the JSON data file referenced by the mapped component. | After every `dataFile:` line in **_componentsMap.js** |
| **Highlighted placeholders** | Every `<!-- placeholder -->` comment in HTML gets its own themeable colour<br>(defaults to: orange / purple). | *.html* |
| **Ctrl‑Click navigation** | You can jump from an HTML placeholder to:<br>  • component JS file<br>  • data JSON file<br>  • its mapping in **_componentsMap.js** | *.html* |
| **Reverse navigation** | Ctrl‑Click a placeholder inside **_componentsMap.js** to list all HTML usages. | **_componentsMap.js** |
| **Safe Rename** | Press <kbd>F2</kbd> on a placeholder (HTML or map) to rename it everywhere—HTML files **and** `_componentsMap.js`. | *.html*, **_componentsMap.js** |

<br>

---

## 🚀 Performance notes
* All HTML files are scanned **once**, then cached per workspace.
* Regex‑based search keeps things fast even in large code‑bases.
* Decorations are updated only for the active editor, minimising redraw cost.

<br>

---

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
