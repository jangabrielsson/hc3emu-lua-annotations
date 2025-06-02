import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

// Interface matching the structure of configurations in hc3emu2launch.json
interface LuaMobDebugLaunchConfig extends vscode.DebugConfiguration {
    // Properties from hc3emu2launch.json for luaMobDebug
    workingDirectory?: string;
    sourceBasePath?: string;
    listenPort?: number;
    stopOnEntry?: boolean;
    sourceEncoding?: string;
    interpreter?: string;
    arguments?: string[];
    listenPublicly?: boolean;
    // Standard DebugConfiguration properties like 'name', 'type', 'request' are inherited
    // 'program' is not used by this specific luaMobDebug config, but good to be aware of
}

// Interface for the overall structure of hc3emu2launch.json
interface Hc3emu2LaunchJsonFormat {
    version: string;
    configurations: LuaMobDebugLaunchConfig[];
}

export class HC3EmuLuaMobDebugConfigurationProvider implements vscode.DebugConfigurationProvider {

    /**
     * This method is called when VS Code needs to provide debug configurations.
     * For example, when the user opens the "Run and Debug" view and no launch.json exists,
     * or when they click "Add Configuration..." in an existing launch.json.
     *
     * It reads configurations directly from 'hc3emu2launch.json' if it exists in the workspace root.
     */
    provideDebugConfigurations(folder: vscode.WorkspaceFolder | undefined, token?: vscode.CancellationToken): vscode.ProviderResult<vscode.DebugConfiguration[]> {
        const launchJsonPath = folder ? path.join(folder.uri.fsPath, 'hc3emu2launch.json') : undefined;
        let providedConfigs: LuaMobDebugLaunchConfig[] = [];

        if (launchJsonPath && fs.existsSync(launchJsonPath)) {
            try {
                const content = fs.readFileSync(launchJsonPath, 'utf8');
                const json = JSON.parse(content) as Hc3emu2LaunchJsonFormat;
                
                // Filter for configurations that are of type 'luaMobDebug' and add them
                if (json.configurations && Array.isArray(json.configurations)) {
                    providedConfigs = json.configurations.filter(c => c.type === 'luaMobDebug');
                }
            } catch (e) {
                console.error(`Error reading or parsing hc3emu2launch.json: ${e}`);
                vscode.window.showErrorMessage(`Error reading or parsing hc3emu2launch.json. See console for details.`);
                // Return empty or a default, user-friendly config if parsing fails
                return [
                    {
                        name: "Error: Could not load from hc3emu2launch.json",
                        type: "luaMobDebug", // Or a generic type
                        request: "launch",
                        // Add minimal properties to make it a valid, though non-functional, entry
                    }
                ];
            }
        }

        if (providedConfigs.length > 0) {
            return providedConfigs;
        } else {
            // If hc3emu2launch.json is not found, or contains no luaMobDebug configurations,
            // you could provide a default placeholder or an empty array.
            // For this request, we only provide what's in the file.
            // If the file is missing/empty, the user won't see these specific configurations 
            // when creating a launch.json for the first time via this provider.
            // They would need to manually copy them or ensure hc3emu2launch.json is present.
            vscode.window.showInformationMessage('hc3emu2launch.json not found or no luaMobDebug configurations defined. Please create it with your luaMobDebug configurations.');
            return []; 
        }
    }

    /**
     * Massage a debug configuration just before a debug session is started.
     * For this provider, we assume the configurations from hc3emu2launch.json are complete
     * and don't need further modification. However, you could add defaults here if needed.
     */
    resolveDebugConfiguration(folder: vscode.WorkspaceFolder | undefined, config: vscode.DebugConfiguration, token?: vscode.CancellationToken): vscode.ProviderResult<vscode.DebugConfiguration> {
        // If the configuration is coming from our provider (i.e., it was read from hc3emu2launch.json)
        // and it's of type luaMobDebug, we can assume it's already correctly formatted.
        if (config.type === 'luaMobDebug') {
            // You could add/override specific properties here if necessary
            // For example, ensuring a port if not set, though luaMobDebug likely has its own defaults.
            // config.listenPort = config.listenPort || 8172;
        }
        
        // If launch.json is missing or empty, and the user tries to run an unnamed configuration
        // for a Lua file, you *could* try to provide a default on-the-fly. 
        // However, the main goal here is to serve from hc3emu2launch.json.
        if (!config.type && !config.request && !config.name) {
            const editor = vscode.window.activeTextEditor;
            if (editor && editor.document.languageId === 'lua') {
                // This is an opportunity to suggest a default configuration if the user
                // tries to F5 without a launch.json. We will return a config that 
                // matches the structure of hc3emu2launch.json.
                // This specific config might not be in hc3emu2launch.json but is a sensible default.
                // For the strict request of only providing from the file, this part could be removed.
                vscode.window.showInformationMessage('No launch configuration selected. You can add one from hc3emu2launch.json or create a launch.json.');
                // Returning undefined will likely cause VS Code to prompt the user to create a launch.json.
                return undefined; 
            }
        }

        return config; // Return the configuration, possibly modified.
    }
}
