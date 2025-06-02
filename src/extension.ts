import * as vscode from 'vscode';
import { configureLuaLanguageServer } from './luaLanguageServer';
import { HC3EmuTaskProvider } from './taskProvider';
import { HC3EmuDebugConfigurationProvider } from './debugConfigurationProvider';

export async function activate(context: vscode.ExtensionContext) {
    try {
        console.log('HC3Emu extension: Starting activation...');
        const disposables: vscode.Disposable[] = [];
        
        // Register task provider
        console.log('HC3Emu extension: Registering task provider...');
        const taskProvider = vscode.tasks.registerTaskProvider(
            HC3EmuTaskProvider.taskType, 
            new HC3EmuTaskProvider()
        );
        disposables.push(taskProvider);
        console.log(`HC3Emu extension: Task provider registered for type: ${HC3EmuTaskProvider.taskType}`);
        
        // Register debug configuration provider
        console.log('HC3Emu extension: Registering debug configuration provider...');
        const debugConfigProvider = vscode.debug.registerDebugConfigurationProvider(
            HC3EmuDebugConfigurationProvider.debugType,
            new HC3EmuDebugConfigurationProvider()
        );
        disposables.push(debugConfigProvider);
        console.log(`HC3Emu extension: Debug config provider registered for type: ${HC3EmuDebugConfigurationProvider.debugType}`);
        
        // Register command to install debug configurations
        console.log('HC3Emu extension: Registering debug config installation command...');
        const installDebugConfigCommand = vscode.commands.registerCommand(
            'hc3emu.installDebugConfigs',
            async () => {
                console.log('HC3Emu: Install debug configurations command called');
                try {
                    await installDebugConfigurations();
                    vscode.window.showInformationMessage('HC3Emu debug configurations installed successfully!');
                } catch (error) {
                    console.error('Failed to install debug configurations:', error);
                    vscode.window.showErrorMessage(`Failed to install debug configurations: ${error}`);
                }
            }
        );
        disposables.push(installDebugConfigCommand);
        console.log('HC3Emu extension: Debug config installation command registered');

        context.subscriptions.push(...disposables);

        // Configure Lua language server
        console.log('HC3Emu extension: Configuring Lua language server...');
        await configureLuaLanguageServer(context).catch(err => {
            console.error('Failed to configure Lua language server:', err);
        });

        // Handle errors
        process.on('uncaughtException', (error) => {
            console.error('Uncaught Exception:', error);
        });

        process.on('unhandledRejection', (error) => {
            console.error('Unhandled Rejection:', error);
        });

    } catch (error) {
        console.error('Extension activation failed:', error);
        throw error; // Re-throw to notify VS Code of activation failure
    }
}

export function deactivate() {
    // Cleanup
    try {
        // Add any cleanup code here
    } catch (error) {
        console.error('Extension deactivation failed:', error);
    }
}

async function installDebugConfigurations(): Promise<void> {
    console.log('HC3Emu: installDebugConfigurations() called');
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        console.log('HC3Emu: No workspace folder open');
        throw new Error('No workspace folder open');
    }

    const workspaceFolder = workspaceFolders[0];
    console.log(`HC3Emu: Using workspace folder: ${workspaceFolder.uri.fsPath}`);
    
    // Load configurations from hc3emu2launch.json
    const possiblePaths = [
        'hc3emu2launch.json',
        '../hc3emu2launch.json',
        '../../hc3emu2launch.json'
    ];

    let hc3LaunchConfigs: any[] = [];
    
    for (const relativePath of possiblePaths) {
        try {
            const launchUri = vscode.Uri.joinPath(workspaceFolder.uri, relativePath);
            console.log(`HC3Emu: Trying to read launch config from: ${launchUri.fsPath}`);
            const fileContent = await vscode.workspace.fs.readFile(launchUri);
            const launchJson = JSON.parse(Buffer.from(fileContent).toString('utf8'));
            
            if (launchJson.configurations && Array.isArray(launchJson.configurations)) {
                hc3LaunchConfigs = launchJson.configurations;
                console.log(`HC3Emu: Found ${hc3LaunchConfigs.length} configurations in ${launchUri.fsPath}`);
                break;
            }
        } catch (error: any) {
            console.log(`HC3Emu: Could not read from ${relativePath}: ${error.message}`);
            // Continue to next path
        }
    }

    if (hc3LaunchConfigs.length === 0) {
        console.log('HC3Emu: No configurations found in any hc3emu2launch.json file');
        throw new Error('No configurations found in hc3emu2launch.json');
    }

    console.log('HC3Emu: Found configurations:', hc3LaunchConfigs.map(c => c.name));

    // Get or create .vscode/launch.json
    const vscodeDir = vscode.Uri.joinPath(workspaceFolder.uri, '.vscode');
    const launchJsonUri = vscode.Uri.joinPath(vscodeDir, 'launch.json');
    console.log(`HC3Emu: Target launch.json path: ${launchJsonUri.fsPath}`);
    
    let existingLaunch: any = {
        version: "0.2.0",
        configurations: []
    };

    try {
        // Try to read existing launch.json
        const existingContent = await vscode.workspace.fs.readFile(launchJsonUri);
        existingLaunch = JSON.parse(Buffer.from(existingContent).toString('utf8'));
        console.log('HC3Emu: Found existing launch.json with', existingLaunch.configurations?.length || 0, 'configurations');
    } catch (error) {
        // File doesn't exist, we'll create it
        console.log('HC3Emu: Creating new launch.json file');
    }

    // Ensure configurations array exists
    if (!existingLaunch.configurations || !Array.isArray(existingLaunch.configurations)) {
        existingLaunch.configurations = [];
    }

    // Remove any existing HC3Emu configurations to avoid duplicates
    const beforeCount = existingLaunch.configurations.length;
    existingLaunch.configurations = existingLaunch.configurations.filter(
        (config: any) => !config.name || !config.name.toLowerCase().includes('hc3emu')
    );
    const afterCount = existingLaunch.configurations.length;
    console.log(`HC3Emu: Removed ${beforeCount - afterCount} existing HC3Emu configurations`);

    // Add HC3Emu configurations
    existingLaunch.configurations.push(...hc3LaunchConfigs);
    console.log(`HC3Emu: Added ${hc3LaunchConfigs.length} new configurations`);

    // Ensure .vscode directory exists
    try {
        await vscode.workspace.fs.createDirectory(vscodeDir);
        console.log('HC3Emu: Created .vscode directory');
    } catch (error) {
        // Directory might already exist
        console.log('HC3Emu: .vscode directory already exists');
    }

    // Write updated launch.json
    const updatedContent = JSON.stringify(existingLaunch, null, 2);
    await vscode.workspace.fs.writeFile(launchJsonUri, Buffer.from(updatedContent, 'utf8'));
    
    console.log(`HC3Emu: Successfully installed ${hc3LaunchConfigs.length} debug configurations to ${launchJsonUri.fsPath}`);
    console.log('HC3Emu: Final launch.json content:', updatedContent);
}
