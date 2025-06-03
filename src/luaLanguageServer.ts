import * as vscode from 'vscode';
import * as path from 'path';
import { luaGlobals } from './config/luaGlobals';

export async function configureLuaLanguageServer(context: vscode.ExtensionContext) {
    try {
        console.log('HC3Emu: Configuring Lua Language Server...');
        const config = vscode.workspace.getConfiguration();
        const libraryPath = path.join(context.extensionPath, 'hc3emu-library');
        
        // Set up library paths
        const existingLibrary = config.get<string[]>('Lua.workspace.library', []);
        if (!existingLibrary.includes(libraryPath)) {
            console.log(`HC3Emu: Adding library path: ${libraryPath}`);
            await config.update('Lua.workspace.library', 
                [...existingLibrary, libraryPath], 
                vscode.ConfigurationTarget.Global);
        }

        // Configure Lua settings with correct property names
        await config.update('Lua.completion.callSnippet', 'Replace', vscode.ConfigurationTarget.Global);
        console.log('HC3Emu: Set Lua completion call snippet');
        
        // Configure diagnostics using the imported luaGlobals array
        await config.update('Lua.diagnostics.globals', 
            luaGlobals, 
            vscode.ConfigurationTarget.Global);
        console.log(`HC3Emu: Set ${luaGlobals.length} Lua global variables:`, luaGlobals);
        
        console.log('HC3Emu: Lua Language Server configuration completed');
    } catch (error) {
        console.error('HC3Emu: Failed to configure Lua language server:', error);
        // Don't throw the error, just log it so the extension continues to work
    }
}
