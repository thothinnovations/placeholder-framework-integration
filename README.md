# `placeholder-framework-integration` <br> VS Code Extension  

Advanced navigation, hints, diagnostics and refactoring for [**placeholder-framework**](https://www.npmjs.com/package/placeholder-framework) projects that use the `<!-- placeholder -->` pattern together with the  `componentsMap.js` file.

<br>


## 🛠️ Installation

1. Download the latest **`.vsix`** from the [releases page](https://github.com/thothinnovations/placeholder-framework-integration/releases/tag/latest).  
2. In a terminal run *(replacing `x.y.z` with the current version)*:  
   ```sh
   code --install-extension placeholder-framework-integration‑x.y.z.vsix
   ```  
3. Reload VS Code.

<br>

## ✨ What you get

| Feature | What it does | Where it applies |
|----------------------|--------------|------------------|
| **`<!-- placeholder -->`<br>Highlighting** | Every placeholder is tinted in a color distinct from a normal HTML comment. | any `.html` under `/_pages` |
| **Safe Renaming** | Press <kbd>F2</kbd> on a placeholder to rename it everywhere (map & pages). | in `componentsMap.js`<br>or any `.html` under `/_pages` |
| **<kbd>Ctrl‑Click</kbd> any<br>`<!-- placeholder -->`** | On `.html` pages it jumps to the component source, its JSON, and the mapping entry.<br>On `componentsMap.js` it lists all HTML usages of that placeholder. | in `componentsMap.js` and any `.html` under `/_pages` |
| **<kbd>Ctrl‑Click</kbd> any `/public` asset** | Underlines `/public/...` asset paths and turns them into links to the asset file. | any `.json` under `/_data` <br>any `.js` under `/_components` |
| **`component` \| `dataFile`**<br>*CodeLens* | Jump straight to the mapped component’s `.js` module or its `.json` data file (the second button is hidden when the mapping sets **`dataFile: ""`**). | above each placeholder in any `.html` under `/_pages` |
| **`{n usages}`**<br>*CodeLens* | Shows how many times a placeholder appears; click to jump to all usages. | above each placeholder in `componentsMap.js`<br>or any `.html` under `/_pages` |
| **`open`** <br> `dataFile`<br>*CodeLens* | Click to open the JSON file mapped to a placeholder. | above every `dataFile:` line in `componentsMap.js` |
| **`open`** <br> `component`<br>*CodeLens* | Click to open the JS file mapped to a placeholder. | above every `component:` line in `componentsMap.js` |
| **`{n mappings}`** CodeLens | Counts how many times the current `.json` data file or `.js` component file is referenced in **`componentsMap.js`**.<br>Click to view all mapping lines. | any `.json` under `/_data`<br>any `.js` under `/_components` |
| **Inline diagnostics** *(errors / warnings)* | When editing **`componentsMap.js`** the extension instantly checks for:<br>  • bad placeholder syntax<br>  • duplicate placeholders<br>  • unused placeholders<br>  • invalid `.json` format in **`dataFile`**<br>  • invalid **`component`** file structure<br>  • missing **`dataFile`** or **`component`** files | in `componentsMap.js` |
| **Inline diagnostics** *(errors / warnings)* | When editing any **`.js`** component file the extension instantly checks for:<br>  • unmapped components<br>  • missing `/public` asset files | any `.js` under `/_components` |
| **Inline diagnostics** *(errors)* | When editing any **`.json`** data file the extension instantly checks for:<br>  • missing `/public` asset files | any `.json` under `/_data` |

<br>

---

<br>

## 📄 The `componentsMap.js` file format

```js
module.exports = [
  {
    placeholder: "<!-- exampleSection -->",  // how you call it in /_pages/*.html
    dataFile: "exampleSection.json",         // relative to /_data  ("" if none)
    component: "exampleSection.js"           // relative to /_components (prefix with a leading "/" to nest folders)
  },
  // …more mappings
];
```

* All paths are **relative**; both the framework and the extension resolves them automatically.

<br>

## 🚀 Performance notes
* All HTML files are scanned **once**, then cached per workspace.
* Regex‑based search keeps things fast even in large code‑bases.
* Decorations and diagnostics are updated only for the active editor, minimising redraw cost.

<br>

## 🧩 Expected project structure
```
your‑project/
├─ componentsMap.js
├─ _components/
│   └─ someSection.js
├─ _data/
│   └─ someSection.json
└─ _pages/
    └─ index.html
```

*The extension auto‑detects `componentsMap.js` in any nested folder and scopes all work to that folder’s subtree only.*

<br>

---