const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

/**
 * Activates the extension.
 * Registers a definition provider for HTML files that detects HTML comment placeholders
 * (e.g., <!-- thankYouPage -->) and provides definition links for navigating to:
 *   - The mapped component file
 *   - The mapped component’s data file (if applicable)
 *   - The mapping entry in _componentsMap.js
 */
function activate(context) {
  // The definition provider will be used for files with the "html" language.
  const provider = {
    provideDefinition(document, position) {
      const lineText = document.lineAt(position.line).text;
      // This regex will match HTML comments of the form: <!-- placeholderName -->
      const regex = /<!--\s*([A-Za-z0-9_]+)\s*-->/g;
      let match;
      while ((match = regex.exec(lineText)) !== null) {
        const fullMatch = match[0];
        const placeholder = match[1];
        const matchStart = match.index;
        const matchEnd = match.index + fullMatch.length;
        // Only run if the cursor is within the match
        if (position.character >= matchStart && position.character <= matchEnd) {
          // Get the workspace root (assumes a single-root workspace)
          const workspaceFolders = vscode.workspace.workspaceFolders;
          if (!workspaceFolders || workspaceFolders.length === 0) {
            return null;
          }
          const workspaceRoot = workspaceFolders[0].uri.fsPath;
          const compMapPath = path.join(workspaceRoot, '_componentsMap.js');
          if (!fs.existsSync(compMapPath)) {
            return null;
          }
          // Clear the require cache to pick up fresh changes in _componentsMap.js
          delete require.cache[require.resolve(compMapPath)];
          let compMap;
          try {
            compMap = require(compMapPath);
          } catch (err) {
            vscode.window.showErrorMessage('Error loading _componentsMap.js: ' + err);
            return null;
          }
          const config = compMap[placeholder];
          if (!config) {
            // No mapping found for this placeholder.
            return null;
          }

          // Read the entire _componentsMap.js file content
          let compMapContent;
          try {
            compMapContent = fs.readFileSync(compMapPath, 'utf8');
          } catch (err) {
            vscode.window.showErrorMessage('Error reading _componentsMap.js: ' + err);
            return null;
          }

          // Extract the component file path by finding the require statement for the component.
          // This regex finds a pattern like:
          //   thankYouPage: { ... component: require(`./_components/thankYouPage.js`),
          // or with single/double quotes.
          const compRegex = new RegExp(
            placeholder + '\\s*:\\s*{[\\s\\S]*?require\\(([`\'"])(.*?)\\1\\)',
            'm'
          );
          const compMatch = compMapContent.match(compRegex);
          if (!compMatch || compMatch.length < 3) {
            vscode.window.showErrorMessage('Could not resolve component file for placeholder: ' + placeholder);
            return null;
          }
          const componentRelativePath = compMatch[2];
          const componentFilePath = path.join(path.dirname(compMapPath), componentRelativePath);

          // Compute the data file absolute path.
          const dataFileRelativePath = config.dataFile;
          const dataFilePath = path.join(path.dirname(compMapPath), dataFileRelativePath);

          // Find the line in _componentsMap.js that contains the mapping entry.
          const compMapLines = compMapContent.split(/\r?\n/);
          let mappingLine = 0;
          for (let i = 0; i < compMapLines.length; i++) {
            if (compMapLines[i].includes(`placeholder: '<!-- ${placeholder} -->'`)) {
              mappingLine = i;
              break;
            }
          }

          // Build the definition links list.
          // Each object here will become an option in the definition (peek) view.
          const locations = [];

          // Option 1: Go to component file.
          locations.push({
            targetUri: vscode.Uri.file(componentFilePath),
            targetRange: new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 0)),
            tooltip: "Go to component file"
          });

          // Option 2: Go to component's data.
          // Skip this option if the data file is the _empty.json file.
          if (!dataFilePath.endsWith('_empty.json')) {
            locations.push({
              targetUri: vscode.Uri.file(dataFilePath),
              targetRange: new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 0)),
              tooltip: "Go to component's data"
            });
          }

          // Option 3: Go to component mapping.
          locations.push({
            targetUri: vscode.Uri.file(compMapPath),
            targetRange: new vscode.Range(new vscode.Position(mappingLine, 0), new vscode.Position(mappingLine, 0)),
            tooltip: "Go to component mapping"
          });

          return locations;
        }
      }
      return null;
    }
  };

  // Register the definition provider for HTML files.
  context.subscriptions.push(
    vscode.languages.registerDefinitionProvider({ scheme: 'file', language: 'html' }, provider)
  );
}

/**
 * Deactivate the extension.
 */
function deactivate() {}

module.exports = {
  activate,
  deactivate
};
