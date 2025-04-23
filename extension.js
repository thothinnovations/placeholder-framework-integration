const vscode = require('vscode');
const path   = require('path');
const fs     = require('fs');


// ──────────────────────────────────────────────────────────────────────────
//  diagnostics collection for every _componentsMap.js validation
// ──────────────────────────────────────────────────────────────────────────
const placeholderDiagnostics =
      vscode.languages.createDiagnosticCollection('componentsPlaceholders');


// ──────────────────────────────────────────────────────────────────────────
//  diagnostics collection for missing  /public/…  assets inside JSON files
// ──────────────────────────────────────────────────────────────────────────
const publicAssetDiagnostics =
      vscode.languages.createDiagnosticCollection('jsonPublicAssets');


// ──────────────────────────────────────────────────────────────────────────
//  diagnostics collection for unmapped component files
// ──────────────────────────────────────────────────────────────────────────
const componentMappingDiagnostics =
      vscode.languages.createDiagnosticCollection('componentMappings');

      
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
        // Only activate for componentsMap.js
        if (path.basename(document.uri.fsPath) !== 'componentsMap.js') { return null; }

        // Detect placeholder line
        const line             = document.lineAt(position).text;
        const placeholderMatch = line.match(/placeholder:\s*["']<!--\s*([A-Za-z0-9_]+)\s*-->["']/);
        if (!placeholderMatch) { return null; }
        const placeholderName  = placeholderMatch[1];

        // Directory containing the map
        const componentsMapDir = path.dirname(document.uri.fsPath);

        // Search every *.html within that subtree
        const relativePattern  = new vscode.RelativePattern(componentsMapDir, '**/*.html');
        const htmlFiles        = await vscode.workspace.findFiles(relativePattern, '**/node_modules/**');
        const locations        = [];

        for (const uri of htmlFiles) {
            const doc  = await vscode.workspace.openTextDocument(uri);
            const text = doc.getText();
            const rx   = new RegExp(`<!--\\s*${placeholderName}\\s*-->`, 'g');

            let m;
            while ((m = rx.exec(text)) !== null) {
                const pos = doc.positionAt(m.index);
                locations.push(new vscode.Location(uri, pos));
            }
        }

        return locations.length ? locations : null;
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
        let isJsMapFile = false;

        //------------------------------------------------------------------
        // 1. Determine the context (map vs. html)
        //------------------------------------------------------------------
        if (document.languageId === 'javascript' &&
            path.basename(document.uri.fsPath) === 'componentsMap.js') {

            const line = document.lineAt(position).text;
            const match = line.match(/placeholder:\s*["']<!--\s*([A-Za-z0-9_]+)\s*-->["']/);
            if (!match) { return null; }

            const nameStart = line.indexOf(match[1]);
            const nameEnd   = nameStart + match[1].length;
            if (position.character < nameStart || position.character > nameEnd) { return null; }

            oldName          = match[1];
            componentsMapPath = document.uri.fsPath;
            isJsMapFile      = true;

        } else if (document.languageId === 'html') {

            const line = document.lineAt(position).text;
            const match = line.match(/<!--\s*([A-Za-z0-9_]+)\s*-->/);
            if (!match) { return null; }

            const nameStart = line.indexOf(match[1]);
            const nameEnd   = nameStart + match[1].length;
            if (position.character < nameStart || position.character > nameEnd) { return null; }

            oldName          = match[1];
            componentsMapPath = findComponentsMapPath(document.uri);
            if (!componentsMapPath) { return null; }

        } else { return null; }

        //------------------------------------------------------------------
        // 2. Validate new name
        //------------------------------------------------------------------
        if (!/^[A-Za-z0-9_]+$/.test(newName)) {
            vscode.window.showErrorMessage('Invalid component name. Use only letters, numbers and underscores.');
            return null;
        }

        const edit            = new vscode.WorkspaceEdit();
        const componentsMapUri = vscode.Uri.file(componentsMapPath);
        const componentsMapDir = path.dirname(componentsMapPath);

        //------------------------------------------------------------------
        // 3-a. Update map file itself
        //------------------------------------------------------------------
        if (isJsMapFile) {
            const range = document.getWordRangeAtPosition(position, /[A-Za-z0-9_]+/);
            if (range) { edit.replace(document.uri, range, newName); }
        } else {
            const mapText = fs.readFileSync(componentsMapPath, 'utf8');
            const mapDoc  = await vscode.workspace.openTextDocument(componentsMapUri);

            const rx      = new RegExp(`placeholder:\\s*["']<!--\\s*${oldName}\\s*-->["']`);
            const match    = rx.exec(mapText);
            if (match) {
                const start = match.index + match[0].indexOf(oldName);
                const end   = start + oldName.length;
                const startPos = mapDoc.positionAt(start);
                const endPos   = mapDoc.positionAt(end);
                edit.replace(componentsMapUri, new vscode.Range(startPos, endPos), newName);
            }
        }

        //------------------------------------------------------------------
        // 3-b. Update all HTML usages
        //------------------------------------------------------------------
        const relativePattern = new vscode.RelativePattern(componentsMapDir, '**/*.html');
        const htmlFiles       = await vscode.workspace.findFiles(relativePattern, '**/node_modules/**');

        for (const uri of htmlFiles) {
            const doc  = await vscode.workspace.openTextDocument(uri);
            const text = doc.getText();
            const rx   = new RegExp(`<!--\\s*${oldName}\\s*-->`, 'g');

            let m;
            while ((m = rx.exec(text)) !== null) {
                const start = m.index + m[0].indexOf(oldName);
                const end   = start + oldName.length;
                const startPos = doc.positionAt(start);
                const endPos   = doc.positionAt(end);
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

    async provideCodeLenses(document, token) {
        const isHtml = document.languageId === 'html';
        const isMap  = document.languageId === 'javascript' &&
                       path.basename(document.uri.fsPath) === 'componentsMap.js';

        if (!isHtml && !isMap) { return []; }

        // locate componentsMap.js
        const mapPath = isMap ? document.uri.fsPath : findComponentsMapPath(document.uri);
        if (!mapPath) { return []; }
        const mapDir  = path.dirname(mapPath);

        // gather all .html files once
        const htmlFiles = await vscode.workspace.findFiles(
            new vscode.RelativePattern(mapDir, '**/*.html'),
            '**/node_modules/**');
        const htmlDocs  = await Promise.all(htmlFiles.map(u => vscode.workspace.openTextDocument(u)));

        // parse map
        const { componentsMap, noDataValue } = parseComponentsMap(mapPath);

        const usageCache = new Map();
        const codeLenses = [];
        const text       = document.getText();

        //--------------------------------------------------
        // a)  "{n usages}"  CodeLens
        //--------------------------------------------------
        const placeholderRe = isHtml
            ? /<!--\s*([A-Za-z0-9_]+)\s*-->/g
            : /placeholder:\s*["']<!--\s*([A-Za-z0-9_]+)\s*-->["']/g;

        let m;
        while ((m = placeholderRe.exec(text)) !== null) {
            const name      = m[1];
            const pos       = document.positionAt(m.index);
            const lensRange = new vscode.Range(pos.line, 0, pos.line, 0);

            // count usages (cached per placeholder to avoid N² scans)
            let entry = usageCache.get(name);
            if (!entry) {
                entry = { count: 0, locations: [] };
                const htmlRe = new RegExp(`<!--\\s*${name}\\s*-->`, 'g');

                for (const hDoc of htmlDocs) {
                    const hTxt = hDoc.getText();
                    let hm;
                    while ((hm = htmlRe.exec(hTxt)) !== null) {
                        entry.count++;
                        entry.locations.push(new vscode.Location(hDoc.uri, hDoc.positionAt(hm.index)));
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

            //--------------------------------------------------
            // b)  "component" / "dataFile"  CodeLens  (HTML only)
            //--------------------------------------------------
            if (isHtml && componentsMap.has(name)) {
                const info       = componentsMap.get(name);
                const compAbs    = path.resolve(mapDir, info.componentPath);
                const dataAbs    = info.dataFile ? path.resolve(mapDir, info.dataFile) : '';

                if (fs.existsSync(compAbs)) {
                    codeLenses.push(new vscode.CodeLens(lensRange, {
                        title: 'component',
                        tooltip: 'Open component source',
                        command: 'vscode.open',
                        arguments: [ vscode.Uri.file(compAbs) ]
                    }));
                }
                if (info.dataFile !== noDataValue && info.dataFile && fs.existsSync(dataAbs)) {
                    codeLenses.push(new vscode.CodeLens(lensRange, {
                        title: 'data',
                        tooltip: 'Open component data file',
                        command: 'vscode.open',
                        arguments: [ vscode.Uri.file(dataAbs) ]
                    }));
                }
            }
        }

        //--------------------------------------------------
        // c)  "open:" lenses inside map (dataFile / component)
        //--------------------------------------------------
        if (isMap) {
            const mapText = document.getText();

            /* dataFile */
            const dataRe = /dataFile:\s*["']([^"']*)["']/g;
            let df;
            while ((df = dataRe.exec(mapText)) !== null) {
                const raw   = df[1].trim();
                if (raw === '') { continue; }
                const abs   = path.resolve(mapDir, '_data', raw);
                if (!fs.existsSync(abs)) { continue; }
                const pos       = document.positionAt(df.index);
                const lensRange = new vscode.Range(pos.line, 0, pos.line, 0);
                codeLenses.push(new vscode.CodeLens(lensRange, {
                    title: 'open:',
                    tooltip: 'Open mapped data file',
                    command: 'vscode.open',
                    arguments: [ vscode.Uri.file(abs) ]
                }));
            }

            /* component */
            const compRe = /component:\s*["']([^"']+)["']/g;
            let cp;
            while ((cp = compRe.exec(mapText)) !== null) {
                const raw   = cp[1].trim();
                const rel   = raw.startsWith('/') ? raw.slice(1) : raw;
                let abs     = path.resolve(mapDir, '_components', rel);
                if (!fs.existsSync(abs) && fs.existsSync(abs + '.js')) { abs += '.js'; }
                if (!fs.existsSync(abs)) { continue; }

                const pos       = document.positionAt(cp.index);
                const lensRange = new vscode.Range(pos.line, 0, pos.line, 0);
                codeLenses.push(new vscode.CodeLens(lensRange, {
                    title: 'open:',
                    tooltip: 'Open component module',
                    command: 'vscode.open',
                    arguments: [ vscode.Uri.file(abs) ]
                }));
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


// ============================================================================
//  DocumentLink provider  →  "/public/…"   links inside /_data/*.json
// ============================================================================
class JsonPublicAssetLinkProvider {
    /**
     * @param {vscode.TextDocument} document
     * @returns {vscode.DocumentLink[]}
     */
    provideDocumentLinks(document) {
        if (document.languageId !== 'json') { return []; }

        const mapPath = findComponentsMapPath(document.uri);
        if (!mapPath) { return []; }
        const projectDir = path.dirname(mapPath);

        const links   = [];
        const text    = document.getText();
        const rx      = /"([^"]*\/public\/[^"]+)"/g;

        let m;
        while ((m = rx.exec(text)) !== null) {
            const rawPath = m[1];
            if (!rawPath.startsWith('/public/')) { continue; }

            const abs   = path.resolve(projectDir, rawPath.slice(1));  // drop leading '/'
            const start = document.positionAt(m.index + 1);            // skip opening quote
            const end   = document.positionAt(m.index + 1 + rawPath.length);

            links.push(new vscode.DocumentLink(new vscode.Range(start, end), vscode.Uri.file(abs)));
        }
        return links;
    }
}


// ============================================================================
//  DocumentLink provider  →  "/public/…"   links inside JavaScript component files
// ============================================================================
class JsPublicAssetLinkProvider {
    /**
     * @param {vscode.TextDocument} document
     * @returns {vscode.DocumentLink[]}
     */
    provideDocumentLinks(document) {
        if (document.languageId !== 'javascript') { return []; }
        // only for JS files inside "/_components"
        if (!document.uri.fsPath.includes(`${path.sep}_components${path.sep}`)) { return []; }

        const componentsMapPath = findComponentsMapPath(document.uri);
        if (!componentsMapPath) { return []; }
        const projectDir = path.dirname(componentsMapPath);

        const links = [];
        const text = document.getText();
        const rx = /['"`]([^'"`]*\/public\/[^'"`]+)['"`]/g;

        let m;
        while ((m = rx.exec(text)) !== null) {
            const rawPath = m[1];
            if (!rawPath.startsWith('/public/')) { continue; }

            const abs = path.resolve(projectDir, rawPath.slice(1));
            const start = document.positionAt(m.index + 1);
            const end = document.positionAt(m.index + 1 + rawPath.length);
            links.push(new vscode.DocumentLink(new vscode.Range(start, end), vscode.Uri.file(abs)));
        }

        return links;
    }
}


// ============================================================================
//  CodeLens provider: "{n} mappings" on component .js files in /_components
// ============================================================================
class ComponentFileMappingsLensProvider {
    async provideCodeLenses(document, token) {
        // only for JS files inside "/_components"
        if (document.languageId !== 'javascript'
         || !document.uri.fsPath.includes(`${path.sep}_components${path.sep}`)) {
            return [];
        }

        const mapPath = findComponentsMapPath(document.uri);
        if (!mapPath) {
            return [];
        }
        const mapDir = path.dirname(mapPath);
        const { componentsMap } = parseComponentsMap(mapPath);

        const locations = [];
        let count = 0;

        for (const [placeholder, info] of componentsMap.entries()) {
            let compPath = path.resolve(mapDir, info.componentPath);
            if (!fs.existsSync(compPath) && fs.existsSync(compPath + '.js')) {
                compPath += '.js';
            }
            if (compPath === document.uri.fsPath) {
                count++;
                const pos = findPlaceholderPositionInComponentsMap(mapPath, placeholder);
                if (pos) {
                    locations.push(new vscode.Location(vscode.Uri.file(mapPath), pos));
                }
            }
        }

        if (count === 0) {
            return [];
        }

        const lensRange = new vscode.Range(0, 0, 0, 0);
        return [
            new vscode.CodeLens(
                lensRange,
                {
                    title: `${count} mappings`,
                    tooltip: 'Show mapping entries in _componentsMap.js',
                    command: 'editor.action.showReferences',
                    arguments: [ document.uri, new vscode.Position(0, 0), locations ]
                }
            )
        ];
    }
}


// ====================================================
// Shared Utility Functions
// ====================================================
function findComponentsMapPath(currentFileUri) {
    const currentPath     = currentFileUri.fsPath;
    let   currentDir      = path.dirname(currentPath);
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(currentFileUri);
    if (!workspaceFolder) { return null; }
    const root = workspaceFolder.uri.fsPath;

    while (currentDir.startsWith(root)) {
        const candidate = path.join(currentDir, 'componentsMap.js');
        if (fs.existsSync(candidate)) { return candidate; }
        currentDir = path.dirname(currentDir);
        if (currentDir === path.dirname(currentDir)) { break; }
    }
    return null;
}


/**
 * Parse the new componentsMap.js format.
 *   [
 *     { placeholder:"<!-- name -->", dataFile:"file.json", component:"file.js" },
 *     …
 *   ]
 *
 * Returns:
 *   {
 *     componentsMap : Map<string, { placeholderName, dataFile, componentPath }>,
 *     noDataValue   : ''           // empty string signals “no data”
 *   }
 */
function parseComponentsMap(componentsMapPath) {
    const text = fs.readFileSync(componentsMapPath, 'utf8');

    // one mapping object (allow comments, trailing commas, etc.)
    const rx = /{\s*placeholder:\s*["']<!--\s*([A-Za-z0-9_]+)\s*-->["']\s*,\s*dataFile:\s*["']([^"']*)["']\s*,\s*component:\s*["']([^"']+)["'][^}]*}/g;

    const entries     = [];
    let   m;
    while ((m = rx.exec(text)) !== null) {
        const placeholderName = m[1].trim();
        const dataFileRaw     = m[2].trim();              // may be ''
        const componentRaw    = m[3].trim();              // 'file.js' or '/dir/file.js'

        const dataFileRel = dataFileRaw === ''
            ? ''                                           // no-data
            : path.join('_data', dataFileRaw);

        const compRel = componentRaw.startsWith('/')
            ? path.join('_components', componentRaw.slice(1))
            : path.join('_components', componentRaw);

        entries.push({
            placeholderName,
            dataFile      : dataFileRel,
            componentPath : compRel
        });
    }

    return {
        componentsMap : new Map(entries.map(e => [ e.placeholderName, e ])),
        noDataValue   : ''          // empty string is the sentinel
    };
}


/**
 * Locate the exact position of a placeholder mapping line.
 */
function findPlaceholderPositionInComponentsMap(componentsMapPath, placeholderName) {
    const text  = fs.readFileSync(componentsMapPath, 'utf8');
    const lines = text.split('\n');
    const needle = `placeholder: "<!-- ${placeholderName} -->"`;

    for (let i = 0; i < lines.length; i++) {
        const col = lines[i].indexOf(needle);
        if (col !== -1) {
            return new vscode.Position(i, col);
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

    //----------------------------------------------------------------------
    // 1. Bad syntax, duplicates & unused placeholders
    //----------------------------------------------------------------------
    const seen        = new Map();
    const usedPlh     = new Set();

    // gather usages across all HTML first
    (function scanHtml(folder) {
        const entries = fs.readdirSync(folder, { withFileTypes: true });
        for (const e of entries) {
            if (e.name === 'node_modules') { continue; }
            const full = path.join(folder, e.name);
            if (e.isDirectory()) { scanHtml(full); }
            else if (e.isFile() && e.name.endsWith('.html')) {
                const txt = fs.readFileSync(full, 'utf8');
                const rx  = /<!--\s*([A-Za-z0-9_]+)\s*-->/g;
                let m; while ((m = rx.exec(txt)) !== null) { usedPlh.add(m[1]); }
            }
        }
    })(mapDir);

    const placeholderRx = /placeholder:\s*["']<!--\s*([A-Za-z0-9_]+)\s*-->["']/g;
    let   pm;
    while ((pm = placeholderRx.exec(text)) !== null) {
        const name   = pm[1];
        const line   = doc.positionAt(pm.index).line;
        const range  = doc.lineAt(line).range;

        // duplicate
        if (seen.has(name)) {
            diagnostics.push(new vscode.Diagnostic(
                range,
                `Placeholder "${name}" is already mapped.`,
                vscode.DiagnosticSeverity.Error));
        }
        seen.set(name, true);

        // unused
        if (!usedPlh.has(name)) {
            diagnostics.push(new vscode.Diagnostic(
                range,
                `The placeholder "<!-- ${name} -->" is not used in any .html file.`,
                vscode.DiagnosticSeverity.Warning));
        }
    }

    //----------------------------------------------------------------------
    // 2. Check dataFile & component existence / validity
    //----------------------------------------------------------------------
    const objRx = /{\s*placeholder:\s*["']<!--\s*[A-Za-z0-9_]+\s*-->["']\s*,\s*dataFile:\s*["']([^"']*)["']\s*,\s*component:\s*["']([^"']+)["'][^}]*}/g;
    let om;
    while ((om = objRx.exec(text)) !== null) {
        const dataRel = om[1].trim();           // '' allowed
        const compRel = om[2].trim();

        // compute positions
        const objStart  = om.index;
        const dataPos   = doc.positionAt(objStart + om[0].indexOf(dataRel));
        const compPos   = doc.positionAt(objStart + om[0].indexOf(compRel));
        const dataRange = doc.lineAt(dataPos.line).range;
        const compRange = doc.lineAt(compPos.line).range;

        // ----- dataFile
        if (dataRel !== '') {
            const dataAbs = path.resolve(mapDir, '_data', dataRel);
            if (!fs.existsSync(dataAbs)) {
                diagnostics.push(new vscode.Diagnostic(
                    dataRange, `dataFile "${dataRel}" not found.`, vscode.DiagnosticSeverity.Error));
            } else {
                try { JSON.parse(fs.readFileSync(dataAbs, 'utf8')); }
                catch { diagnostics.push(new vscode.Diagnostic(
                    dataRange, `dataFile "${dataRel}" contains invalid JSON.`, vscode.DiagnosticSeverity.Error)); }
            }
        }

        // ----- component
        const compAbs0 = compRel.startsWith('/')
            ? path.resolve(mapDir, '_components', compRel.slice(1))
            : path.resolve(mapDir, '_components', compRel);
        let   compAbs  = compAbs0;

        if (!fs.existsSync(compAbs) && fs.existsSync(compAbs + '.js')) { compAbs += '.js'; }

        if (!fs.existsSync(compAbs)) {
            diagnostics.push(new vscode.Diagnostic(
                compRange, `Component "${compRel}" not found.`, vscode.DiagnosticSeverity.Error));
        } else {
            const content = fs.readFileSync(compAbs, 'utf8');
            if (!/module\.exports\s*=/.test(content)) {
                diagnostics.push(new vscode.Diagnostic(
                    compRange, `Component "${compRel}" does not export anything.`, vscode.DiagnosticSeverity.Error));
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


// --------------------------------------------------------------------------
//  validate one  /_data/*.json  file for missing  /public/…  assets
// --------------------------------------------------------------------------
/**
 * @param {vscode.TextDocument} doc
 * @returns {vscode.Diagnostic[]}
 */
function validateJsonPublicAssets(doc) {
    if (doc.languageId !== 'json') { return []; }

    const mapPath = findComponentsMapPath(doc.uri);
    if (!mapPath) { return []; }
    const projectDir = path.dirname(mapPath);

    const diagnostics = [];
    const text        = doc.getText();
    const rx          = /"([^"]*\/public\/[^"]+)"/g;

    let m;
    while ((m = rx.exec(text)) !== null) {
        const rawPath = m[1];
        if (!rawPath.startsWith('/public/')) { continue; }

        const abs = path.resolve(projectDir, rawPath.slice(1));   // strip leading '/'

        if (!fs.existsSync(abs)) {
            const start = doc.positionAt(m.index + 1);            // inside the quotes
            const end   = doc.positionAt(m.index + 1 + rawPath.length);

            diagnostics.push(new vscode.Diagnostic(
                new vscode.Range(start, end),
                `Asset "${rawPath}" not found.`,
                vscode.DiagnosticSeverity.Error
            ));
        }
    }
    return diagnostics;
}


/**
 * @param {vscode.TextDocument} doc
 * @returns {vscode.Diagnostic[]}
 */
function validateJsPublicAssets(doc) {
    if (doc.languageId !== 'javascript' || !doc.uri.fsPath.includes(`${path.sep}_components${path.sep}`)) {
        return [];
    }

    const componentsMapPath = findComponentsMapPath(doc.uri);
    if (!componentsMapPath) {
        return [];
    }
    const projectDir = path.dirname(componentsMapPath);

    const diagnostics = [];
    const text = doc.getText();
    const rx = /['"`]([^'"`]*\/public\/[^'"`]+)['"`]/g;

    let m;
    while ((m = rx.exec(text)) !== null) {
        const rawPath = m[1];
        if (!rawPath.startsWith('/public/')) {
            continue;
        }

        const abs = path.resolve(projectDir, rawPath.slice(1)); // strip leading '/'
        const start = doc.positionAt(m.index + 1);
        const end = doc.positionAt(m.index + 1 + rawPath.length);

        if (!fs.existsSync(abs)) {
            diagnostics.push(new vscode.Diagnostic(
                new vscode.Range(start, end),
                `Asset "${rawPath}" not found.`,
                vscode.DiagnosticSeverity.Error
            ));
        }
    }

    return diagnostics;
}


/**
 * @param {vscode.TextDocument} doc
 * Emits a warning on the `module.exports` line if this component
 * is not referenced in _componentsMap.js.
 */
function refreshComponentMappingDiagnostics(doc) {
    // only for JS files inside "/_components"
    if (doc.languageId !== 'javascript'
     || !doc.uri.fsPath.includes(`${path.sep}_components${path.sep}`)) {
        componentMappingDiagnostics.delete(doc.uri);
        return;
    }

    const componentsMapPath = findComponentsMapPath(doc.uri);
    if (!componentsMapPath) {
        componentMappingDiagnostics.delete(doc.uri);
        return;
    }

    const mapDir = path.dirname(componentsMapPath);
    const { componentsMap } = parseComponentsMap(componentsMapPath);

    // collect all placeholders that point at this file
    const matches = [];
    for (const [placeholder, info] of componentsMap.entries()) {
        let compPath = path.resolve(mapDir, info.componentPath);
        // tolerate omitted “.js”
        if (!fs.existsSync(compPath) && fs.existsSync(compPath + '.js')) {
            compPath += '.js';
        }
        if (compPath === doc.uri.fsPath) {
            matches.push(placeholder);
        }
    }

    const diagnostics = [];
    if (matches.length === 0) {
        // find the first line with "module.exports"
        const lines = doc.getText().split('\n');
        for (let i = 0; i < lines.length; i++) {
            if (/module\.exports/.test(lines[i])) {
                const range = new vscode.Range(i, 0, i, lines[i].length);
                diagnostics.push(new vscode.Diagnostic(
                    range,
                    'Component has 0 mappings in _componentsMap.js',
                    vscode.DiagnosticSeverity.Warning
                ));
                break;
            }
        }
    }

    componentMappingDiagnostics.set(doc.uri, diagnostics);
}


// ====================================================
// Activation
// ====================================================
function activate(context) {
    //--------------------------------------------------
    // 1. providers & lenses
    //--------------------------------------------------
    context.subscriptions.push(
        vscode.languages.registerDefinitionProvider('html',       new ComponentDefinitionProvider()),
        vscode.languages.registerDefinitionProvider('javascript', new ComponentUsageProvider()),
        vscode.languages.registerDefinitionProvider('javascript', new MapUsageProvider()),
        vscode.languages.registerRenameProvider   ('html',        new ComponentRenameProvider()),
        vscode.languages.registerRenameProvider   ('javascript',  new ComponentRenameProvider()),

        vscode.languages.registerCodeLensProvider(
            { language: 'html', scheme: 'file' },
            new PlaceholderUsageHintsProvider()
        ),
        vscode.languages.registerCodeLensProvider(
            { language: 'javascript', scheme: 'file', pattern: `**/componentsMap.js` },
            new PlaceholderUsageHintsProvider()
        ),
        // "{n} mappings" lens on component .js files
        vscode.languages.registerCodeLensProvider(
            { language: 'javascript', scheme: 'file', pattern: '**/_components/**/*.js' },
            new ComponentFileMappingsLensProvider()
        ),
        // "{n} mappings" lens on /_data/*.json
        vscode.languages.registerCodeLensProvider(
            { language: 'json', scheme: 'file', pattern: '**/_data/**/*.json' },
            new DataFileMappingsLensProvider()
        ),
        // "/public/…" links inside JSON files
        vscode.languages.registerDocumentLinkProvider(
            { language: 'json', scheme: 'file', pattern: '**/_data/**/*.json' },
            new JsonPublicAssetLinkProvider()
        ),
        // "/public/…" links inside JS component files
        vscode.languages.registerDocumentLinkProvider(
            { language: 'javascript', scheme: 'file', pattern: '**/_components/**/*.js' },
            new JsPublicAssetLinkProvider()
        )
    );

    //--------------------------------------------------
    // 2. diagnostics wiring  (map-filename updated)
    //--------------------------------------------------
    function refreshMapDiagnostics(doc) {
        if (path.basename(doc.uri.fsPath) !== 'componentsMap.js') { return; }
        placeholderDiagnostics.set(doc.uri, validateComponentsMap(doc));
    }

    function refreshPublicAssetDiagnostics(doc) {
        if (doc.languageId === 'json' && doc.uri.fsPath.includes(`${path.sep}_data${path.sep}`)) {
            publicAssetDiagnostics.set(doc.uri, validateJsonPublicAssets(doc));
        } else if (doc.languageId === 'javascript' && doc.uri.fsPath.includes(`${path.sep}_components${path.sep}`)) {
            publicAssetDiagnostics.set(doc.uri, validateJsPublicAssets(doc));
        }
    }

    vscode.workspace.textDocuments.forEach(doc => {
        refreshMapDiagnostics(doc);
        refreshPublicAssetDiagnostics(doc);
        refreshComponentMappingDiagnostics(doc);
    });

    context.subscriptions.push(
        placeholderDiagnostics,
        publicAssetDiagnostics,
        componentMappingDiagnostics,

        vscode.workspace.onDidOpenTextDocument(doc => {
            refreshMapDiagnostics(doc);
            refreshPublicAssetDiagnostics(doc);
            refreshComponentMappingDiagnostics(doc);
        }),
        vscode.workspace.onDidChangeTextDocument(e => {
            refreshMapDiagnostics(e.document);
            refreshPublicAssetDiagnostics(e.document);
            refreshComponentMappingDiagnostics(e.document);
        }),
        vscode.workspace.onDidCloseTextDocument(doc => {
            placeholderDiagnostics.delete(doc.uri);
            publicAssetDiagnostics.delete(doc.uri);
            componentMappingDiagnostics.delete(doc.uri);
        })
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
