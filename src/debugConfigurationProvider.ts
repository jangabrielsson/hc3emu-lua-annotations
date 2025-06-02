import * as vscode from 'vscode';

interface HC3EmuLaunchConfig {
    name: string;
    type: string;
    request: string;
    program?: string;
    args?: string[];
    arguments?: string[];
    cwd?: string;
    workingDirectory?: string;
    sourceBasePath?: string;
    listenPort?: number;
    stopOnEntry?: boolean;
    sourceEncoding?: string;
    interpreter?: string;
    listenPublicly?: boolean;
    env?: { [key: string]: string };
    console?: string;
    [key: string]: any;
}

interface HC3EmuLaunchJsonFormat {
    version: string;
    configurations: HC3EmuLaunchConfig[];
}

export class HC3EmuDebugConfigurationProvider implements vscode.DebugConfigurationProvider {
    static debugType = 'luaMobDebug';

    async provideDebugConfigurations(folder: vscode.WorkspaceFolder | undefined): Promise<vscode.DebugConfiguration[]> {
        console.log('HC3EmuDebugConfigProvider: provideDebugConfigurations called');
        const configs = await this.loadLaunchConfigsFromFile();
        console.log(`HC3EmuDebugConfigProvider: Providing ${configs.length} configurations`);
        return configs;
    }

    async resolveDebugConfiguration(folder: vscode.WorkspaceFolder | undefined, config: vscode.DebugConfiguration): Promise<vscode.DebugConfiguration | undefined> {
        console.log('HC3EmuDebugConfigProvider: resolveDebugConfiguration called', config);
        
        // If this is an empty configuration, provide a default one
        if (!config.type && !config.request && !config.name) {
            console.log('HC3EmuDebugConfigProvider: Providing default configuration');
            const configs = await this.loadLaunchConfigsFromFile();
            if (configs.length > 0) {
                return configs[0];
            }
        }
        
        return config;
    }

    private async loadLaunchConfigsFromFile(): Promise<vscode.DebugConfiguration[]> {
        console.log('HC3EmuDebugConfigProvider: Loading launch configs from file...');
        const discoveredConfigs: vscode.DebugConfiguration[] = [];
        const workspaceFolders = vscode.workspace.workspaceFolders;

        if (!workspaceFolders || workspaceFolders.length === 0) {
            console.log("HC3EmuDebugConfigProvider: No workspace folder open, cannot load hc3emu2launch.json.");
            return discoveredConfigs;
        }

        // Try multiple possible locations for the launch file
        const possiblePaths = [
            'hc3emu2launch.json',           // Root of workspace
            '../hc3emu2launch.json',        // Parent directory
            '../../hc3emu2launch.json'      // Grandparent directory
        ];

        let launchJsonUri: vscode.Uri | null = null;
        let launchJsonString: string = '';

        for (const relativePath of possiblePaths) {
            try {
                const candidateUri = vscode.Uri.joinPath(workspaceFolders[0].uri, relativePath);
                console.log(`HC3EmuDebugConfigProvider: Trying launch file at: ${candidateUri.fsPath}`);
                
                const fileContent = await vscode.workspace.fs.readFile(candidateUri);
                launchJsonString = Buffer.from(fileContent).toString('utf8');
                launchJsonUri = candidateUri;
                console.log(`HC3EmuDebugConfigProvider: Found launch file at: ${candidateUri.fsPath}`);
                break;
            } catch (error: any) {
                if (error.code === 'FileNotFound') {
                    console.log(`HC3EmuDebugConfigProvider: File not found at: ${vscode.Uri.joinPath(workspaceFolders[0].uri, relativePath).fsPath}`);
                } else {
                    console.error(`HC3EmuDebugConfigProvider: Error reading file at ${relativePath}:`, error);
                }
            }
        }

        if (!launchJsonUri) {
            console.log('HC3EmuDebugConfigProvider: No hc3emu2launch.json file found in any expected location');
            return discoveredConfigs;
        }

        try {
            console.log(`HC3EmuDebugConfigProvider: File content loaded, length: ${launchJsonString.length}`);
            
            const launchJson = JSON.parse(launchJsonString) as HC3EmuLaunchJsonFormat;
            console.log(`HC3EmuDebugConfigProvider: JSON parsed, found ${launchJson.configurations?.length || 0} configurations`);

            if (launchJson && launchJson.configurations && Array.isArray(launchJson.configurations)) {
                for (const config of launchJson.configurations) {
                    console.log(`HC3EmuDebugConfigProvider: Processing config: "${config.name}"`);
                    if (config.name && config.type && config.request) {
                        discoveredConfigs.push(config);
                        console.log(`HC3EmuDebugConfigProvider: Successfully added config: "${config.name}"`);
                    } else {
                        console.warn(`HC3EmuDebugConfigProvider: Skipping config due to missing required fields:`, config);
                    }
                }
            } else {
                console.warn('HC3EmuDebugConfigProvider: Invalid JSON structure or no configurations array found');
            }
        } catch (error: any) {
            console.error(`HC3EmuDebugConfigProvider: Error parsing JSON from ${launchJsonUri.fsPath}:`, error);
            if (error instanceof SyntaxError) {
                console.error('HC3EmuDebugConfigProvider: JSON syntax error:', error.message);
            }
        }
        
        console.log(`HC3EmuDebugConfigProvider: Returning ${discoveredConfigs.length} discovered configurations`);
        return discoveredConfigs;
    }
}
