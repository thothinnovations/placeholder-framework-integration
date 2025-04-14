const vscode = require('vscode');
const path = require('path');
const fs = require('fs');

class ComponentDefinitionProvider {
    provideDefinition(document, position) {
        const line = document.lineAt(position).text;
        const placeholderMatch = line.match(/<!--\s*([A-Za-z0-9_]+)\s*-->/);
        if (!placeholderMatch) return null;
        const placeholderName = placeholderMatch[1];

        const componentsMapPath = findComponentsMapPath(document.uri);
        if (!componentsMapPath) {
            vscode.window.showErrorMessage('_componentsMap.js not found.');
            return null;
        }

        try {
            const { componentsMap, noDataValue } = parseComponentsMap(componentsMapPath);
            const componentInfo = componentsMap.get(placeholderName);
            if (!componentInfo) {
                vscode.window.showInformationMessage(`No component found for placeholder '${placeholderName}'.`);
                return null;
            }

            const locations = [];
            const componentsMapDir = path.dirname(componentsMapPath);

            // Component File Location
            const componentFullPath = path.resolve(componentsMapDir, componentInfo.componentPath);
            if (fs.existsSync(componentFullPath)) {
                locations.push(new vscode.Location(
                    vscode.Uri.file(componentFullPath),
                    new vscode.Position(0, 0)
                ));
            }

            // Data File Location (if not _empty.json)
            const dataFileFullPath = path.resolve(componentsMapDir, componentInfo.dataFile);
            if (componentInfo.dataFile !== noDataValue && fs.existsSync(dataFileFullPath)) {
                locations.push(new vscode.Location(
                    vscode.Uri.file(dataFileFullPath),
                    new vscode.Position(0, 0)
                ));
            }

            // Mapping Location in componentsMap.js
            const mappingPos = findPlaceholderPositionInComponentsMap(componentsMapPath, placeholderName);
            if (mappingPos) {
                locations.push(new vscode.Location(
                    vscode.Uri.file(componentsMapPath),
                    mappingPos
                ));
            }

            return locations;
        } catch (error) {
            vscode.window.showErrorMessage(`Error parsing _componentsMap.js: ${error}`);
            return null;
        }
    }
}

function findComponentsMapPath(currentFileUri) {
    const currentPath = currentFileUri.fsPath;
    let currentDir = path.dirname(currentPath);
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(currentFileUri);
    if (!workspaceFolder) return null;
    const root = workspaceFolder.uri.fsPath;

    while (currentDir.startsWith(root)) {
        const candidate = path.join(currentDir, '_componentsMap.js');
        if (fs.existsSync(candidate)) return candidate;
        currentDir = path.dirname(currentDir);
        if (currentDir === path.dirname(currentDir)) break; // Prevent loop
    }
    return null;
}

function parseComponentsMap(componentsMapPath) {
    const text = fs.readFileSync(componentsMapPath, 'utf8');

    // Extract dataDir and noData
    const dataDir = (text.match(/const dataDir\s*=\s*`([^`]+)`/) || [])[1] || './_components/data';
    const noData = (text.match(/const noData\s*=\s*`\$\{dataDir\}\/([^`]+)`/) || [])[1];
    const noDataValue = path.join(dataDir, noData || '_empty.json');

    // Extract components
    const componentRegex = /(\w+):\s*{\s*placeholder:\s*'<!--\s*(\w+)\s*-->',\s*dataFile:\s*(.*?),\s*component:\s*require\(`(.*?)`\)/gs;
    const entries = [];
    let match;

    while ((match = componentRegex.exec(text)) !== null) {
        const placeholderName = match[2];
        let dataFileExpr = match[3].trim();
        const componentPath = match[4];

        // Resolve dataFile
        let dataFile = dataFileExpr === 'noData' ? noDataValue
            : dataFileExpr.replace(/\$\{dataDir\}/g, dataDir).replace(/^`|`$/g, '');

        entries.push({ placeholderName, componentPath, dataFile });
    }

    const componentsMap = new Map(entries.map(e => [e.placeholderName, e]));
    return { componentsMap, noDataValue };
}

function findPlaceholderPositionInComponentsMap(componentsMapPath, placeholderName) {
    const text = fs.readFileSync(componentsMapPath, 'utf8');
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(`placeholder: '<!-- ${placeholderName} -->'`)) {
            return new vscode.Position(i, lines[i].indexOf(`placeholder: '<!-- ${placeholderName} -->'`));
        }
    }
    return null;
}

function activate(context) {
    context.subscriptions.push(
        vscode.languages.registerDefinitionProvider('html', new ComponentDefinitionProvider())
    );
}

module.exports = { activate };