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
            'hc3emu', 
            new HC3EmuTaskProvider()
        );
        disposables.push(taskProvider);
        console.log(`HC3Emu extension: Task provider registered for type: hc3emu`);
        
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
        
        // Register command to test task provider
        const testTasksCommand = vscode.commands.registerCommand(
            'hc3emu.testTasks',
            async () => {
                console.log('HC3Emu: Test tasks command called');
                try {
                    const taskProvider = new HC3EmuTaskProvider();
                    const tasks = await taskProvider.provideTasks();
                    console.log(`HC3Emu: Task provider returned ${tasks?.length || 0} tasks`);
                    
                    if (tasks && tasks.length > 0) {
                        const taskNames = tasks.map(t => t.name).join(', ');
                        vscode.window.showInformationMessage(`Found ${tasks.length} HC3Emu tasks: ${taskNames}`);
                    } else {
                        vscode.window.showWarningMessage('No HC3Emu tasks found');
                    }
                } catch (error) {
                    console.error('Failed to test tasks:', error);
                    vscode.window.showErrorMessage(`Failed to test tasks: ${error}`);
                }
            }
        );
        
        // Register command to install tasks
        const installTasksCommand = vscode.commands.registerCommand(
            'hc3emu.installTasks',
            async () => {
                console.log('HC3Emu: Install tasks command called');
                try {
                    await installTasksFromExtension(context);
                    vscode.window.showInformationMessage('HC3Emu tasks installed successfully!');
                } catch (error) {
                    console.error('Failed to install tasks:', error);
                    vscode.window.showErrorMessage(`Failed to install tasks: ${error}`);
                }
            }
        );

        // Register command to setup HC3Emu development environment
        const setupDevEnvCommand = vscode.commands.registerCommand(
            'hc3emu.setupDevEnvironment',
            async () => {
                console.log('HC3Emu: Setup development environment command called');
                try {
                    await installTasksFromExtension(context);
                    await installDebugConfigurationsFromExtension(context);
                    vscode.window.showInformationMessage('HC3Emu development environment setup complete!');
                } catch (error) {
                    console.error('Failed to setup development environment:', error);
                    vscode.window.showErrorMessage(`Failed to setup development environment: ${error}`);
                }
            }
        );
        disposables.push(installDebugConfigCommand);
        disposables.push(testTasksCommand);
        disposables.push(installTasksCommand);
        disposables.push(setupDevEnvCommand);
        console.log('HC3Emu extension: Debug config installation command registered');

        context.subscriptions.push(...disposables);

        // Configure Lua language server
        console.log('HC3Emu extension: Configuring Lua language server...');
        await configureLuaLanguageServer(context).catch(err => {
            console.error('Failed to configure Lua language server:', err);
        });

        // Auto-install tasks and debug configs if files exist
        console.log('HC3Emu extension: Checking for auto-installation...');
        await autoInstallConfigurations(context);

        // Set up file watcher for .lua files to trigger auto-installation
        const luaFileWatcher = vscode.workspace.createFileSystemWatcher('**/*.lua');
        luaFileWatcher.onDidCreate(async (uri) => {
            console.log(`HC3Emu: New .lua file created: ${uri.fsPath}`);
            console.log('HC3Emu: Triggering auto-installation due to new .lua file...');
            await autoInstallConfigurations(context);
        });
        disposables.push(luaFileWatcher);

        console.log('HC3Emu extension: Activation completed successfully!');

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

async function installTasks(): Promise<void> {
    console.log('HC3Emu: installTasks() called');
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        console.log('HC3Emu: No workspace folder open');
        throw new Error('No workspace folder open');
    }

    const workspaceFolder = workspaceFolders[0];
    console.log(`HC3Emu: Using workspace folder: ${workspaceFolder.uri.fsPath}`);
    
    // Load tasks from hc3emu2tasks.json
    const taskProvider = new HC3EmuTaskProvider();
    const tasks = await taskProvider.provideTasks();
    
    if (!tasks || tasks.length === 0) {
        throw new Error('No tasks found in hc3emu2tasks.json');
    }

    console.log(`HC3Emu: Found ${tasks.length} tasks to install`);

    // Get or create .vscode/tasks.json
    const vscodeDir = vscode.Uri.joinPath(workspaceFolder.uri, '.vscode');
    const tasksJsonUri = vscode.Uri.joinPath(vscodeDir, 'tasks.json');
    
    let existingTasks: any = {
        version: "2.0.0",
        tasks: []
    };

    try {
        // Try to read existing tasks.json
        const existingContent = await vscode.workspace.fs.readFile(tasksJsonUri);
        existingTasks = JSON.parse(Buffer.from(existingContent).toString('utf8'));
        console.log('HC3Emu: Found existing tasks.json with', existingTasks.tasks?.length || 0, 'tasks');
    } catch (error) {
        // File doesn't exist, we'll create it
        console.log('HC3Emu: Creating new tasks.json file');
    }

    // Ensure tasks array exists
    if (!existingTasks.tasks || !Array.isArray(existingTasks.tasks)) {
        existingTasks.tasks = [];
    }

    // Remove any existing HC3Emu tasks to avoid duplicates
    const beforeCount = existingTasks.tasks.length;
    existingTasks.tasks = existingTasks.tasks.filter(
        (task: any) => !task.label || !task.label.toLowerCase().includes('hc3emu')
    );
    const afterCount = existingTasks.tasks.length;
    console.log(`HC3Emu: Removed ${beforeCount - afterCount} existing HC3Emu tasks`);

    // Convert VS Code tasks to tasks.json format
    const newTasks = tasks.map(task => {
        const definition = task.definition as any;
        return {
            label: task.name,
            type: "shell",
            command: definition.command,
            args: definition.args || [],
            group: "build"
        };
    });

    // Add HC3Emu tasks
    existingTasks.tasks.push(...newTasks);
    console.log(`HC3Emu: Added ${newTasks.length} new tasks`);

    // Ensure .vscode directory exists
    try {
        await vscode.workspace.fs.createDirectory(vscodeDir);
        console.log('HC3Emu: Created .vscode directory');
    } catch (error) {
        // Directory might already exist
        console.log('HC3Emu: .vscode directory already exists');
    }

    // Write updated tasks.json
    const updatedContent = JSON.stringify(existingTasks, null, 2);
    await vscode.workspace.fs.writeFile(tasksJsonUri, Buffer.from(updatedContent, 'utf8'));
    
    console.log(`HC3Emu: Successfully installed ${newTasks.length} tasks to ${tasksJsonUri.fsPath}`);
    console.log('HC3Emu: Final tasks.json content:', updatedContent);
}

async function installTasksFromExtension(context: vscode.ExtensionContext): Promise<void> {
    console.log('HC3Emu: installTasksFromExtension() called');
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        throw new Error('No workspace folder open');
    }

    const workspaceFolder = workspaceFolders[0];
    
    // Read tasks from extension directory using context.extensionPath
    const extensionPath = context.extensionPath;
    console.log(`HC3Emu: Extension path: ${extensionPath}`);
    
    const tasksFilePath = vscode.Uri.joinPath(vscode.Uri.file(extensionPath), 'hc3emu2tasks.json');
    console.log(`HC3Emu: Reading tasks from: ${tasksFilePath.fsPath}`);
    
    let tasksJson: any;
    try {
        const fileContent = await vscode.workspace.fs.readFile(tasksFilePath);
        tasksJson = JSON.parse(Buffer.from(fileContent).toString('utf8'));
    } catch (error) {
        throw new Error(`Could not read hc3emu2tasks.json from extension: ${error}`);
    }

    if (!tasksJson.tasks || !Array.isArray(tasksJson.tasks)) {
        throw new Error('Invalid tasks.json format in extension');
    }

    console.log(`HC3Emu: Found ${tasksJson.tasks.length} tasks in extension`);

    // Create new tasks.json in workspace (don't merge with existing)
    const vscodeDir = vscode.Uri.joinPath(workspaceFolder.uri, '.vscode');
    const tasksJsonUri = vscode.Uri.joinPath(vscodeDir, 'tasks.json');
    
    // Create the tasks.json structure
    const newTasks = {
        version: "2.0.0",
        tasks: tasksJson.tasks.map((taskConfig: any) => ({
            label: taskConfig.label,
            type: "shell",
            command: taskConfig.command,
            args: taskConfig.args || [],
            group: "build"
        }))
    };

    console.log(`HC3Emu: Will create ${newTasks.tasks.length} tasks`);

    // Ensure .vscode directory exists
    try {
        await vscode.workspace.fs.createDirectory(vscodeDir);
    } catch (error) {
        // Directory might already exist
    }

    // Write new tasks.json
    const updatedContent = JSON.stringify(newTasks, null, 2);
    await vscode.workspace.fs.writeFile(tasksJsonUri, Buffer.from(updatedContent, 'utf8'));
    
    console.log(`HC3Emu: Successfully created tasks.json with ${newTasks.tasks.length} tasks at ${tasksJsonUri.fsPath}`);
}

async function installDebugConfigurationsFromExtension(context: vscode.ExtensionContext): Promise<void> {
    console.log('HC3Emu: installDebugConfigurationsFromExtension() called');
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        throw new Error('No workspace folder open');
    }

    const workspaceFolder = workspaceFolders[0];
    
    // Read debug configs from extension directory using context.extensionPath
    const extensionPath = context.extensionPath;
    console.log(`HC3Emu: Extension path: ${extensionPath}`);
    
    const launchFilePath = vscode.Uri.joinPath(vscode.Uri.file(extensionPath), 'hc3emu2launch.json');
    console.log(`HC3Emu: Reading launch configs from: ${launchFilePath.fsPath}`);
    
    let launchJson: any;
    try {
        const fileContent = await vscode.workspace.fs.readFile(launchFilePath);
        launchJson = JSON.parse(Buffer.from(fileContent).toString('utf8'));
    } catch (error) {
        throw new Error(`Could not read hc3emu2launch.json from extension: ${error}`);
    }

    if (!launchJson.configurations || !Array.isArray(launchJson.configurations)) {
        throw new Error('Invalid launch.json format in extension');
    }

    console.log(`HC3Emu: Found ${launchJson.configurations.length} configurations in extension`);

    // Create new launch.json in workspace (don't merge with existing)
    const vscodeDir = vscode.Uri.joinPath(workspaceFolder.uri, '.vscode');
    const launchJsonUri = vscode.Uri.joinPath(vscodeDir, 'launch.json');
    
    // Create the launch.json structure
    const newLaunch = {
        version: "0.2.0",
        configurations: [...launchJson.configurations]
    };

    console.log(`HC3Emu: Will create ${newLaunch.configurations.length} debug configurations`);

    // Ensure .vscode directory exists
    try {
        await vscode.workspace.fs.createDirectory(vscodeDir);
    } catch (error) {
        // Directory might already exist
    }

    // Write new launch.json
    const updatedContent = JSON.stringify(newLaunch, null, 2);
    await vscode.workspace.fs.writeFile(launchJsonUri, Buffer.from(updatedContent, 'utf8'));
    
    console.log(`HC3Emu: Successfully created launch.json with ${newLaunch.configurations.length} debug configurations at ${launchJsonUri.fsPath}`);
}

async function autoInstallConfigurations(context: vscode.ExtensionContext): Promise<void> {
    // Check if auto-installation is enabled
    const config = vscode.workspace.getConfiguration('hc3emu');
    const autoInstall = config.get<boolean>('autoInstallConfigurations', true);
    
    if (!autoInstall) {
        console.log('HC3Emu: Auto-installation disabled by user setting');
        return;
    }

    console.log('HC3Emu: autoInstallConfigurations() called');
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        console.log('HC3Emu: No workspace folder open');
        return;
    }

    const workspaceFolder = workspaceFolders[0];
    console.log(`HC3Emu: Using workspace folder: ${workspaceFolder.uri.fsPath}`);

    // Check if we've already installed configurations to avoid duplicates
    const vscodeDir = vscode.Uri.joinPath(workspaceFolder.uri, '.vscode');
    const tasksJsonUri = vscode.Uri.joinPath(vscodeDir, 'tasks.json');
    const launchJsonUri = vscode.Uri.joinPath(vscodeDir, 'launch.json');
    
    let tasksFileExists = false;
    let launchFileExists = false;
    
    try {
        await vscode.workspace.fs.stat(tasksJsonUri);
        tasksFileExists = true;
        console.log('HC3Emu: tasks.json already exists, skipping task installation');
    } catch (error) {
        // File doesn't exist, we can install
        console.log('HC3Emu: tasks.json does not exist, will install');
    }
    
    try {
        await vscode.workspace.fs.stat(launchJsonUri);
        launchFileExists = true;
        console.log('HC3Emu: launch.json already exists, skipping debug configuration installation');
    } catch (error) {
        // File doesn't exist, we can install
        console.log('HC3Emu: launch.json does not exist, will install');
    }

    if (tasksFileExists && launchFileExists) {
        console.log('HC3Emu: Both configuration files already exist, skipping auto-installation');
        return;
    }

    // Check if workspace contains .lua files (indicating HC3 development)
    let luaFilesFound = false;
    try {
        const files = await vscode.workspace.findFiles('**/*.lua', null, 5); // Limit to 5 files for performance
        luaFilesFound = files.length > 0;
        console.log(`HC3Emu: Found ${files.length} .lua files in workspace`);
    } catch (error) {
        console.log('HC3Emu: Error searching for .lua files:', error);
    }

    // Auto-install if .lua files are found and config files don't exist
    if (luaFilesFound) {
        console.log('HC3Emu: Lua files detected, checking what to auto-install...');
        
        try {
            let installCount = 0;
            let installMessage = 'HC3Emu: Auto-installed ';
            
            // Install tasks only if tasks.json doesn't exist
            if (!tasksFileExists) {
                await installTasksFromExtension(context);
                console.log('HC3Emu: Tasks auto-installed successfully');
                installCount++;
                installMessage += 'tasks';
            }
            
            // Install debug configs only if launch.json doesn't exist  
            if (!launchFileExists) {
                await installDebugConfigurationsFromExtension(context);
                console.log('HC3Emu: Debug configurations auto-installed successfully');
                if (installCount > 0) installMessage += ' and ';
                installMessage += 'debug configurations';
                installCount++;
            }
            
            // Show notification only if something was installed
            if (installCount > 0) {
                vscode.window.showInformationMessage(installMessage + ' for Lua development');
            } else {
                console.log('HC3Emu: No installation needed, configuration files already exist');
            }
            
        } catch (error) {
            console.error('HC3Emu: Auto-installation failed:', error);
            // Don't show error to user, just log it
        }
    } else {
        console.log('HC3Emu: No .lua files found, skipping auto-installation');
    }
}

async function fileExists(uri: vscode.Uri): Promise<boolean> {
    try {
        await vscode.workspace.fs.stat(uri);
        return true;
    } catch (error) {
        if (error instanceof vscode.FileSystemError && error.code === 'FileNotFound') {
            return false;
        }
        throw error;
    }
}
