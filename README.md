## Work in Progress

#### A VS Code extension which provides advanced navigation and refactoring tools for `stoner-framework` projects

______________________________________

# Features:

- 🧩 **Component Navigation**  
  Ctrl+Click any component placeholder (e.g. `<!-- productsSection -->`) to:
  - Jump to component implementation file
  - Open linked JSON data file (when available)
  - Navigate to mapping definition in `_componentsMap.js`
<br>

- 🔄 **Cross-file Usage Tracking**  
  Find all HTML usages of a component directly from `_componentsMap.js` with:
  - Ctrl+Click on placeholder definitions shows all HTML references
  - Scope limited to project directory containing components map
<br>

- 🛡️ **Safe Refactoring**  
  Rename components with F2 to automatically:
  - Update all HTML occurrences
  - Synchronize `_componentsMap.js` definitions
  - Validate naming conventions (letters/numbers/underscores only)
<br>

- 🤖 **Smart Context Handling**  
  - Auto-detects project structure boundaries
  - Omits data file navigation for `_empty.json` mappings
  - Preserves relative paths when building output
<br>

- 🚀 **Workspace Optimization**  
  - Fast component resolution through cached mappings
  - Async processing for large projects
  - Regex-based pattern matching for reliability
<br>

______________________________________

# How to install it:

1. Download the [`stoner-framework-integration-0.1.0.vsix` file in the releases section](https://github.com/thothinnovations/stoner-framework-integration/releases/tag/latest)
<br>

2. Open a **VS Code** terminal inside the folder where you downloaded the file and install it with:
```
code --install-extension stoner-framework-integration-0.1.0.vsix
```
<br>

3. Restart **VS Code** and you are all set!
