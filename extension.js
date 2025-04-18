const vscode = require('vscode');
const path   = require('path');
const fs     = require('fs');


// ──────────────────────────────────────────────────────────────────────────
//  diagnostics collection for every _componentsMap.js validation
// ──────────────────────────────────────────────────────────────────────────
const placeholderDiagnostics =
      vscode.languages.createDiagnosticCollection('componentsPlaceholders');


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
                const pos = doc.positionAt(match.index);
                locations.push(new vscode.Location(uri, pos));
            }
        }

        return locations.length > 0 ? locations : null;
    }
}

// ====================================================
// Component Rename Provider (Cross-file renaming)
// ====================================================
class ComponentRenameProvider {
    /* eslint-disable no-unused-vars */
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


// ========================================================================
//  Placeholder Usage Hints Provider
// ========================================================================
class PlaceholderUsageHintsProvider {
    constructor() {
        this._onDidChange          = new vscode.EventEmitter();
        this.onDidChangeCodeLenses = this._onDidChange.event;
    }

    // helper to resolve `dataFile: <expr>` to an absolute path
    _resolveDataFile(expr, documentText, mapDir) {
        // strip quotes / back‑ticks
        expr = expr.trim();
        const quote = expr[0];
        if ((quote === '`' || quote === '\'' || quote === '"') && expr[expr.length - 1] === quote) {
            expr = expr.slice(1, -1);
        }

        // fetch  dataDir  constant from the same file
        const dataDirMatch = documentText.match(/const\s+dataDir\s*=\s*`([^`]+)`/);
        const dataDir      = dataDirMatch ? dataDirMatch[1] : './_components/data';

        // handle  ${dataDir}  template substitution
        expr = expr.replace(/\$\{dataDir\}/g, dataDir);

        return path.resolve(mapDir, expr);
    }

    async provideCodeLenses(document, token) {
        const isHtml = document.languageId === 'html';
        const isMap  = document.languageId === 'javascript' &&
                       path.basename(document.uri.fsPath) === '_componentsMap.js';

        if (!isHtml && !isMap) { return []; }

        // 1. locate _componentsMap.js
        const mapPath = isMap ? document.uri.fsPath : findComponentsMapPath(document.uri);
        if (!mapPath) { return []; }
        const mapDir  = path.dirname(mapPath);

        // 2. gather every *.html
        const htmlFiles = await vscode.workspace.findFiles(
            new vscode.RelativePattern(mapDir, '**/*.html'),
            '**/node_modules/**');
        const htmlDocs  = await Promise.all(htmlFiles.map(uri => vscode.workspace.openTextDocument(uri)));

        // 2b. Parse the map once (needed for go‑to buttons)
        const { componentsMap, noDataValue } = parseComponentsMap(mapPath);

        // 3. iterate through the current document
        const usageCache  = new Map();
        const codeLenses  = [];
        const text        = document.getText();

        // a) "<n> usages"
        const placeholderRe = isHtml
            ? /<!--\s*([A-Za-z0-9_]+)\s*-->/g
            : /placeholder:\s*'<!--\s*([A-Za-z0-9_]+)\s*-->'/g;

        let m;
        while ((m = placeholderRe.exec(text)) !== null) {
            const name      = m[1];
            const pos       = document.positionAt(m.index);
            const lensRange = new vscode.Range(pos.line, 0, pos.line, 0);

            // cache counts so we only scan html once per placeholder
            let entry = usageCache.get(name);
            if (!entry) {
                entry = { count: 0, locations: [] };
                const htmlRe = new RegExp(`<!--\\s*${name}\\s*-->`, 'g');

                for (const hDoc of htmlDocs) {
                    const hTxt = hDoc.getText();
                    let hm;
                    while ((hm = htmlRe.exec(hTxt)) !== null) {
                        entry.count += 1;
                        const hPos = hDoc.positionAt(hm.index);
                        entry.locations.push(new vscode.Location(hDoc.uri, hPos));
                    }
                }
                usageCache.set(name, entry);
            }

            codeLenses.push(new vscode.CodeLens(
                lensRange,
                {
                    title: `${entry.count} usages`,
                    tooltip: 'Show all usages of this placeholder',
                    command: 'editor.action.showReferences',
                    arguments: [ document.uri, pos, entry.locations ]
                }
            ));

            // ----------------------------------------------------------------
            // NEW:   "component"   &   "dataFile"   (HTML only)
            // ----------------------------------------------------------------
            if (isHtml && componentsMap.has(name)) {
                const info = componentsMap.get(name);

                // component
                const absComponent = path.resolve(mapDir, info.componentPath);
                if (fs.existsSync(absComponent)) {
                    codeLenses.push(new vscode.CodeLens(
                        lensRange,
                        {
                            title: 'component',
                            tooltip: 'Open component source',
                            command: 'vscode.open',
                            arguments: [ vscode.Uri.file(absComponent) ]
                        }
                    ));
                }

                // dataFile    (skip when mapped with noData)
                if (info.dataFile !== noDataValue) {
                    const absData = path.resolve(mapDir, info.dataFile);
                    if (fs.existsSync(absData)) {
                        codeLenses.push(new vscode.CodeLens(
                            lensRange,
                            {
                                title: 'dataFile',
                                tooltip: 'Open JSON data file',
                                command: 'vscode.open',
                                arguments: [ vscode.Uri.file(absData) ]
                            }
                        ));
                    }
                }
            }
        }
        // b) "open:" CodeLens on both dataFile: <expr> and component: require(`…`)
        if (isMap) {
            /* ───────────── dataFile ───────────── */
            const dataFileRe = /dataFile:\s*([^,]+),/g;        // raw expression
            let df;
            while ((df = dataFileRe.exec(text)) !== null) {
                const rawExpr = df[1].trim();
                if (rawExpr === 'noData') { continue; }        // skip noData

                const absPath = this._resolveDataFile(rawExpr, text, mapDir);
                if (!fs.existsSync(absPath)) { continue; }

                const dfPos     = document.positionAt(df.index);
                const lensRange = new vscode.Range(dfPos.line, 0, dfPos.line, 0);

                codeLenses.push(new vscode.CodeLens(
                    lensRange,
                    {
                        title: 'open:',
                        tooltip: 'Open mapped data file',
                        command: 'vscode.open',
                        arguments: [ vscode.Uri.file(absPath) ]
                    }
                ));
            }

            /* ───────────── component ───────────── */
            const componentRe = /component:\s*require\(`([^`]+)`\)/g;
            let cm;
            while ((cm = componentRe.exec(text)) !== null) {
                const relPath = cm[1].trim();
                let absPath   = path.resolve(mapDir, relPath);

                // tolerate omitted “.js”
                if (!fs.existsSync(absPath)) {
                    if (fs.existsSync(absPath + '.js')) {
                        absPath += '.js';
                    } else {
                        continue;    // file truly missing
                    }
                }

                const cmPos     = document.positionAt(cm.index);
                const lensRange = new vscode.Range(cmPos.line, 0, cmPos.line, 0);

                codeLenses.push(new vscode.CodeLens(
                    lensRange,
                    {
                        title: 'open:',
                        tooltip: 'Open component module',
                        command: 'vscode.open',
                        arguments: [ vscode.Uri.file(absPath) ]
                    }
                ));
            }
        }

        return codeLenses;
    }
}


// ============================================================================
// dataFile mappings CodeLens  ("{n} mappings" on /_data/*.json )
// ============================================================================
class DataFileMappingsLensProvider {
    async provideCodeLenses(document, token) {
        // 1. only for JSON files inside "/_data"
        if (document.languageId !== 'json') { return []; }
        const fsPath = document.uri.fsPath;
        if (!fsPath.includes(`${path.sep}_data${path.sep}`)) { return []; }

        // 2. locate _componentsMap.js
        const mapPath = findComponentsMapPath(document.uri);
        if (!mapPath) { return []; }
        const mapDir = path.dirname(mapPath);

        // 3. parse the map and collect matches
        const { componentsMap } = parseComponentsMap(mapPath);
        const matching = [];

        for (const [placeholder, info] of componentsMap.entries()) {
            const absData = path.resolve(mapDir, info.dataFile);
            if (absData === fsPath) {
                matching.push(placeholder);
            }
        }

        if (matching.length === 0) { return []; }

        // 4. build locations → each placeholder's mapping line
        const locations = matching
            .map(name => {
                const pos = findPlaceholderPositionInComponentsMap(mapPath, name);
                return pos ? new vscode.Location(vscode.Uri.file(mapPath), pos) : null;
            })
            .filter(Boolean);

        const lensRange = new vscode.Range(0, 0, 0, 0);   // always very top of the JSON
        return [
            new vscode.CodeLens(
                lensRange,
                {
                    title: `${matching.length} mappings`,
                    tooltip: 'Show mapping entries in _componentsMap.js',
                    command: 'editor.action.showReferences',
                    arguments: [ document.uri, new vscode.Position(0, 0), locations ]
                }
            )
        ];
    }
}


// =================================================================
// Map Usage Provider (component function -> _componentsMap Usages)
// =================================================================
class MapUsageProvider {
    provideDefinition(document, position) {
        const line = document.lineAt(position).text;
        // Match both function exports and variable exports
        const exportMatch = line.match(/module\.exports\s*=\s*(?:function\s+(\w+)|(\w+))/);
        if (!exportMatch) return null;

        const functionName = exportMatch[1] || exportMatch[2];
        if (!functionName) return null;

        // Check if the click is on the function/variable name
        const functionNameIndex = line.indexOf(functionName);
        if (position.character < functionNameIndex || position.character > functionNameIndex + functionName.length) {
            return null;
        }

        const currentFilePath = document.uri.fsPath;
        const componentsMapPath = findComponentsMapPath(document.uri);
        if (!componentsMapPath) return null;

        const componentsMapDir = path.dirname(componentsMapPath);
        const { componentsMap } = parseComponentsMap(componentsMapPath);

        // Find entries that reference the current component file
        const entriesUsingCurrentFile = Array.from(componentsMap.values()).filter(entry => {
            const resolvedPath = path.resolve(componentsMapDir, entry.componentPath);
            return resolvedPath === currentFilePath;
        });

        if (entriesUsingCurrentFile.length === 0) return null;

        // Find positions of each require statement in componentsMap.js
        const componentsMapText = fs.readFileSync(componentsMapPath, 'utf8');
        const locations = [];

        entriesUsingCurrentFile.forEach(entry => {
            const escapedPath = entry.componentPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const requireRegex = new RegExp(`require\\(\\\`${escapedPath}\\\`\\)`, 'g');
            let match;

            while ((match = requireRegex.exec(componentsMapText)) !== null) {
                const pos = offsetToPosition(componentsMapText, match.index);
                locations.push(new vscode.Location(vscode.Uri.file(componentsMapPath), pos));
            }
        });

        return locations.length > 0 ? locations : null;
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
    const noData = (text.match(/const noData\s*=\s*`([^`]+)`/) || [])[1];
    const noDataValue = noData ? path.resolve(path.dirname(componentsMapPath), noData) :
                                 path.join(dataDir, '_empty.json');

    // Regex to match one mapping object – robust to inline comments
    //   { placeholder:'<!-- name -->', … dataFile: … , … component: require(`…`) … }
    //
    // Anything up to the next closing brace is allowed between the fields.
    const componentRegex =
        /{\s*[^}]*?placeholder:\s*'<!--\s*([A-Za-z0-9_]+)\s*-->'[^}]*?dataFile:\s*([^,]+),[^}]*?component:\s*require\(`([^`]+)`\)[^}]*?}/gs;

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

// Converts text offset to Position:
function offsetToPosition(text, offset) {
    let line = 0;
    let totalChars = 0;
    const lines = text.split('\n');
    for (; line < lines.length; line++) {
        const lineLength = lines[line].length + 1; // +1 for newline
        if (totalChars + lineLength > offset) break;
        totalChars += lineLength;
    }
    const character = offset - totalChars;
    return new vscode.Position(line, character);
}


// ──────────────────────────────────────────────────────────────────────────
//  validator for _componentsMap.js:
//     • bad placeholder syntax
//     • duplicate placeholders
//     • missing dataFile
//     • missing component file
//     • unused component
// ──────────────────────────────────────────────────────────────────────────
/**
 * @param {vscode.TextDocument} doc
 * @returns {vscode.Diagnostic[]}
 */
function validateComponentsMap(doc) {
    const text        = doc.getText();
    const mapDir      = path.dirname(doc.uri.fsPath);
    const diagnostics = [];

    // helper – gather every *.html file (sync, excluding node_modules)
    function _gatherHtmlFilesSync(dir, list = []) {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            if (entry.name === 'node_modules') continue;
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                _gatherHtmlFilesSync(full, list);
            } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.html')) {
                list.push(full);
            }
        }
        return list;
    }

    // build set of placeholder usages across all html pages
    const usedPlaceholders = (() => {
        const set = new Set();
        const htmlFiles = _gatherHtmlFilesSync(mapDir);
        const rx = /<!--\s*([A-Za-z0-9_]+)\s*-->/g;
        for (const file of htmlFiles) {
            const content = fs.readFileSync(file, 'utf8');
            let m;
            while ((m = rx.exec(content)) !== null) {
                set.add(m[1]);
            }
        }
        return set;
    })();

    // ------------------------------
    // 1. placeholder syntax / dups / unused
    // ------------------------------
    const seenNames = new Map();
    const placeholderRx = /placeholder:\s*(['"`])([^'"`]+)\1/g;

    let pm;
    while ((pm = placeholderRx.exec(text)) !== null) {
        const fullValue        = pm[2];
        const nameOnly         = fullValue.replace(/<!--\s*|\s*-->/g, '').trim();
        const valueStartOffset = pm.index + pm[0].indexOf(fullValue);
        const valueLineRange   = doc.lineAt(doc.positionAt(valueStartOffset).line).range;

        // syntax
        if (!(fullValue.startsWith('<!-- ') && fullValue.endsWith(' -->'))) {
            diagnostics.push(new vscode.Diagnostic(
                valueLineRange,
                'Placeholder must start with "<!-- " and end with " -->".',
                vscode.DiagnosticSeverity.Error
            ));
        }

        // duplicate
        if (seenNames.has(nameOnly)) {
            diagnostics.push(new vscode.Diagnostic(
                valueLineRange,
                `Placeholder "${nameOnly}" is already in use.`,
                vscode.DiagnosticSeverity.Error
            ));
        } else {
            seenNames.set(nameOnly, true);
        }

        // unused
        if (!usedPlaceholders.has(nameOnly)) {
            diagnostics.push(new vscode.Diagnostic(
                valueLineRange,
                `The placeholder "<!-- ${nameOnly} -->" is not being used in any .html page.`,
                vscode.DiagnosticSeverity.Warning
            ));
        }
    }

    // -------------------------------------------------
    // 2. dataFile / component file existence checks
    // -------------------------------------------------
    const objRx =
      /{\s*placeholder:\s*'<!--\s*[A-Za-z0-9_]+\s*-->',\s*dataFile:\s*([^,]+),\s*component:\s*require\(`([^`]+)`\)/gs;

    // capture dataDir & noData for substitutions
    const dataDir      = (text.match(/const\s+dataDir\s*=\s*`([^`]+)`/) || [])[1] || './_components/data';
    const noDataIdent  = (text.match(/const\s+noData\s*=\s*`([^`]+)`/) || [])[1] || 'noData';

    let om;
    while ((om = objRx.exec(text)) !== null) {
        const dataExpr       = om[1].trim();
        const componentRel   = om[2];

        //------------------------------------------------
        // locate positions
        const objStart       = om.index;
        const objFragment    = om[0];

        const dataOffset     = objStart + objFragment.indexOf(dataExpr);
        const dataLineRange  = doc.lineAt(doc.positionAt(dataOffset).line).range;

        const compOffset     = objStart + objFragment.indexOf(componentRel);
        const compLineRange  = doc.lineAt(doc.positionAt(compOffset).line).range;

        //------------------------------------------------
        // dataFile validation
        if (dataExpr !== 'noData' && !dataExpr.includes(noDataIdent)) {
            let val = dataExpr;
            const q  = val[0];
            if ((q === '`' || q === '\'' || q === '"') && val[val.length - 1] === q) {
                val = val.slice(1, -1);
            }
            val = val.replace(/\$\{dataDir\}/g, dataDir);
            const absData = path.resolve(mapDir, val);

            if (!fs.existsSync(absData)) {
                diagnostics.push(new vscode.Diagnostic(
                    dataLineRange,
                    `dataFile "${val}" not found.`,
                    vscode.DiagnosticSeverity.Error
                ));
            } else {
                // New: Check if JSON is valid
                try {
                    const content = fs.readFileSync(absData, 'utf8');
                    JSON.parse(content);
                } catch (e) {
                    diagnostics.push(new vscode.Diagnostic(
                        dataLineRange,
                        `dataFile "${val}" contains invalid JSON.`,
                        vscode.DiagnosticSeverity.Error
                    ));
                }
            }
        }

        //------------------------------------------------
        // component file validation
        let compAbs = path.resolve(mapDir, componentRel);
        const compExists = (fs.existsSync(compAbs) || fs.existsSync(compAbs + '.js'));
        if (!compExists) {
            diagnostics.push(new vscode.Diagnostic(
                compLineRange,
                `Component file "${componentRel}" not found.`,
                vscode.DiagnosticSeverity.Error
            ));
        } else {
            // New: Check if component exports a function
            const actualPath = fs.existsSync(compAbs) ? compAbs : compAbs + '.js';
            const content = fs.readFileSync(actualPath, 'utf8');
            const exportsFunction = /module\.exports\s*=\s*(function\b|\([^)]*\)\s*=>)/.test(content);
            if (!exportsFunction) {
                diagnostics.push(new vscode.Diagnostic(
                    compLineRange,
                    `Component file "${componentRel}" does not export a valid function.`,
                    vscode.DiagnosticSeverity.Error
                ));
            }
        }
    }

    return diagnostics;
}


// ----------------------------------------------------
//  Decoration:  highlight  <!-- placeholderName -->
// ----------------------------------------------------
const placeholderDecoration = vscode.window.createTextEditorDecorationType({
    color: new vscode.ThemeColor('componentsPlaceholder.foreground')
});

function updatePlaceholderDecorations(editor) {
    if (!editor || editor.document.languageId !== 'html') { return; }

    const ranges = [];
    const regex  = /<!--\s*[A-Za-z0-9_]+\s*-->/g;
    const text   = editor.document.getText();
    let m;
    while ((m = regex.exec(text)) !== null) {
        const start = editor.document.positionAt(m.index);
        const end   = editor.document.positionAt(m.index + m[0].length);
        ranges.push(new vscode.Range(start, end));
    }
    editor.setDecorations(placeholderDecoration, ranges);
}



// ====================================================
// Activation
// ====================================================
function activate(context) {
    //--------------------------------------------------
    // 1. providers & lenses
    //--------------------------------------------------
    context.subscriptions.push(
        vscode.languages.registerDefinitionProvider('html',        new ComponentDefinitionProvider()),
        vscode.languages.registerDefinitionProvider('javascript',  new ComponentUsageProvider()),
        vscode.languages.registerDefinitionProvider('javascript',  new MapUsageProvider()),
        vscode.languages.registerRenameProvider   ('html',        new ComponentRenameProvider()),
        vscode.languages.registerRenameProvider   ('javascript',  new ComponentRenameProvider()),

        vscode.languages.registerCodeLensProvider(
            { language: 'html', scheme: 'file' },
            new PlaceholderUsageHintsProvider()
        ),
        vscode.languages.registerCodeLensProvider(
            { language: 'javascript', scheme: 'file', pattern: '**/_componentsMap.js' },
            new PlaceholderUsageHintsProvider()
        ),
        // NEW:  "{n} mappings" lens on /_data/*.json
        vscode.languages.registerCodeLensProvider(
            { language: 'json', scheme: 'file', pattern: '**/_data/**/*.json' },
            new DataFileMappingsLensProvider()
        )
    );

    //--------------------------------------------------
    // 2. validation wiring  (_componentsMap.js)
    //--------------------------------------------------
    function refreshDiagnostics(doc) {
        if (path.basename(doc.uri.fsPath) !== '_componentsMap.js') { return; }
        placeholderDiagnostics.set(doc.uri, validateComponentsMap(doc));
    }

    vscode.workspace.textDocuments.forEach(refreshDiagnostics);

    context.subscriptions.push(
        placeholderDiagnostics,
        vscode.workspace.onDidOpenTextDocument(refreshDiagnostics),
        vscode.workspace.onDidChangeTextDocument(e => refreshDiagnostics(e.document)),
        vscode.workspace.onDidCloseTextDocument(doc => placeholderDiagnostics.delete(doc.uri))
    );

    //--------------------------------------------------
    // 3. placeholder highlight init + events
    //--------------------------------------------------
    updatePlaceholderDecorations(vscode.window.activeTextEditor);

    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(updatePlaceholderDecorations),
        vscode.workspace.onDidChangeTextDocument(e => {
            const ed = vscode.window.activeTextEditor;
            if (ed && e.document === ed.document && ed.document.languageId === 'html') {
                updatePlaceholderDecorations(ed);
            }
        })
    );
}

module.exports = { activate };
