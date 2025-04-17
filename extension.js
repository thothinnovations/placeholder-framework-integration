const vscode = require('vscode');
const path = require('path');
const fs = require('fs');

// ====================================================
// Component Definition Provider (HTML -> Components)
// ====================================================
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

// ====================================================
// Component Usage Provider (ComponentsMap -> HTML usages)
// ====================================================
class ComponentUsageProvider {
    async provideDefinition(document, position) {
        // Only activate for _componentsMap.js
        if (path.basename(document.uri.fsPath) !== '_componentsMap.js') return null;

        // Detect placeholder line
        const line = document.lineAt(position).text;
        const placeholderMatch = line.match(/placeholder:\s*'<!--\s*([A-Za-z0-9_]+)\s*-->/);
        if (!placeholderMatch) return null;
        const placeholderName = placeholderMatch[1];

        // Get the directory containing _componentsMap.js
        const componentsMapDir = path.dirname(document.uri.fsPath);
        
        // Create search pattern relative to componentsMap directory
        const relativePattern = new vscode.RelativePattern(
            componentsMapDir,
            '**/*.html'
        );

        const htmlFiles = await vscode.workspace.findFiles(relativePattern, '**/node_modules/**');
        const locations = [];

        for (const uri of htmlFiles) {
            const doc = await vscode.workspace.openTextDocument(uri);
            const text = doc.getText();
            const regex = new RegExp(`<!--\\s*${placeholderName}\\s*-->`, 'g');
            
            let match;
            while ((match = regex.exec(text)) !== null) {
                const position = doc.positionAt(match.index);
                locations.push(new vscode.Location(uri, position));
            }
        }

        return locations.length > 0 ? locations : null;
    }
}

// ====================================================
// Component Rename Provider (Cross-file renaming)
// ====================================================
class ComponentRenameProvider {
    // eslint-disable-next-line no-unused-vars
    async provideRenameEdits(document, position, newName, token) {
        let oldName;
        let componentsMapPath;
        let isJSFile = false;

        // Determine context
        if (document.languageId === 'javascript' && 
            path.basename(document.uri.fsPath) === '_componentsMap.js') {
            // Handle rename in componentsMap.js
            const line = document.lineAt(position).text;
            const placeholderMatch = line.match(/placeholder:\s*'<!--\s*([A-Za-z0-9_]+)\s*-->/);
            if (!placeholderMatch) return null;
            
            const nameStart = line.indexOf(placeholderMatch[1]);
            const nameEnd = nameStart + placeholderMatch[1].length;
            if (position.character < nameStart || position.character > nameEnd) return null;
            
            oldName = placeholderMatch[1];
            componentsMapPath = document.uri.fsPath;
            isJSFile = true;
        } else if (document.languageId === 'html') {
            // Handle rename in HTML file
            const line = document.lineAt(position).text;
            const placeholderMatch = line.match(/<!--\s*([A-Za-z0-9_]+)\s*-->/);
            if (!placeholderMatch) return null;
            
            const nameStart = line.indexOf(placeholderMatch[1]);
            const nameEnd = nameStart + placeholderMatch[1].length;
            if (position.character < nameStart || position.character > nameEnd) return null;
            
            oldName = placeholderMatch[1];
            componentsMapPath = findComponentsMapPath(document.uri);
            if (!componentsMapPath) return null;
        } else {
            return null;
        }

        // Verify new name format
        if (!/^[A-Za-z0-9_]+$/.test(newName)) {
            vscode.window.showErrorMessage('Invalid component name. Use only letters, numbers and underscores.');
            return null;
        }

        const edit = new vscode.WorkspaceEdit();
        const componentsMapUri = vscode.Uri.file(componentsMapPath);
        const componentsMapDir = path.dirname(componentsMapPath);

        // 1. Update componentsMap.js (fixed section)
        if (isJSFile) {
            // Rename in JS file directly
            const range = document.getWordRangeAtPosition(position, /([A-Za-z0-9_]+)/);
            if (range) {
                edit.replace(document.uri, range, newName);
            }
        } else {
            // Find and update placeholder in componentsMap.js
            const { componentsMap } = parseComponentsMap(componentsMapPath);
            const entry = componentsMap.get(oldName);
            if (!entry) return null;

            // Read the actual componentsMap.js content
            const mapText = fs.readFileSync(componentsMapPath, 'utf8');
            const placeholderRegex = new RegExp(`placeholder:\\s*'<!--\\s*${oldName}\\s*-->'`);
            const match = placeholderRegex.exec(mapText);
            
            if (match) {
                const start = match.index + match[0].indexOf(oldName);
                const end = start + oldName.length;
                
                // Get correct positions from componentsMap.js document
                const mapDoc = await vscode.workspace.openTextDocument(componentsMapUri);
                const startPos = mapDoc.positionAt(start);
                const endPos = mapDoc.positionAt(end);
                
                edit.replace(componentsMapUri, new vscode.Range(startPos, endPos), newName);
            }
        }

        // 2. Update all HTML files
        const relativePattern = new vscode.RelativePattern(componentsMapDir, '**/*.html');
        const htmlFiles = await vscode.workspace.findFiles(relativePattern, '**/node_modules/**');
        
        for (const uri of htmlFiles) {
            const doc = await vscode.workspace.openTextDocument(uri);
            const text = doc.getText();
            const regex = new RegExp(`<!--\\s*${oldName}\\s*-->`, 'g');
            
            let match;
            while ((match = regex.exec(text)) !== null) {
                const start = match.index + match[0].indexOf(oldName);
                const end = start + oldName.length;
                const startPos = doc.positionAt(start);
                const endPos = doc.positionAt(end);
                edit.replace(uri, new vscode.Range(startPos, endPos), newName);
            }
        }

        return edit;
    }
}

// ====================================================
// Shared Utility Functions
// ====================================================
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
        if (currentDir === path.dirname(currentDir)) break;
    }
    return null;
}

function parseComponentsMap(componentsMapPath) {
    const text = fs.readFileSync(componentsMapPath, 'utf8');

    // Extract dataDir and noData
    const dataDir = (text.match(/const dataDir\s*=\s*`([^`]+)`/) || [])[1] || './_components/data';
    const noData = (text.match(/const noData\s*=\s*`\$\{dataDir\}\/([^`]+)`/) || [])[1];
    const noDataValue = path.join(dataDir, noData || '_empty.json');

    // Regex to match components in the array structure
    const componentRegex = /{\s*placeholder:\s*'<!--\s*([A-Za-z0-9_]+)\s*-->',\s*dataFile:\s*(.*?),\s*component:\s*require\(`(.*?)`\)/gs;
    const entries = [];
    let match;

    while ((match = componentRegex.exec(text)) !== null) {
        const placeholderName = match[1];
        let dataFileExpr = match[2].trim();
        const componentPath = match[3];

        // Resolve dataFile (handle template literals and variables)
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

// ====================================================
// Activation
// ====================================================
function activate(context) {
    context.subscriptions.push(
        vscode.languages.registerDefinitionProvider('html', new ComponentDefinitionProvider()),
        vscode.languages.registerDefinitionProvider('javascript', new ComponentUsageProvider()),
        vscode.languages.registerRenameProvider('html', new ComponentRenameProvider()),
        vscode.languages.registerRenameProvider('javascript', new ComponentRenameProvider())
    );
}

module.exports = { activate };