import * as vscode from 'vscode';
import * as path from 'path';
import { luaGlobals } from './config/luaGlobals';

export async function configureLuaLanguageServer(context: vscode.ExtensionContext) {
    try {
        const config = vscode.workspace.getConfiguration('Lua');
        const libraryPath = path.join(context.extensionPath, 'hc3emu-library');
        
        await config.update('workspace.library', [libraryPath], vscode.ConfigurationTarget.Workspace);
        await config.update('completion.callSnippet', 'Replace', vscode.ConfigurationTarget.Global);
        await config.update('Lua.diagnostics.enable', true, vscode.ConfigurationTarget.Global);
        await config.update('Lua.diagnostics.globals', luaGlobals, vscode.ConfigurationTarget.Global);
    } catch (error) {
        console.error('Failed to configure Lua language server:', error);
    }
}
