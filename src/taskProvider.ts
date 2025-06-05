import * as vscode from 'vscode';
import * as path from 'path'; // For path operations if needed, though Uri.joinPath is better

// This interface should match the properties defined in package.json's taskDefinitions
interface HC3EmuTaskDefinition extends vscode.TaskDefinition {
    // 'type' is inherited and will be 'hc3emu'
    label: string;    // The 'label' from hc3emu2tasks.json, used for the task name
    command: string;  // The 'command' from hc3emu2tasks.json
    args?: string[];   // The 'args' from hc3emu2tasks.json
}

// Structure of the tasks within hc3emu2tasks.json
interface Hc3Emu2JsonTaskConfig {
    label: string;
    type: string; // e.g., "shell"
    command: string;
    args?: string[];
    // other properties like 'problemMatcher' could be here if needed
}

interface Hc3Emu2TasksJsonFormat {
    version: string;
    tasks: Hc3Emu2JsonTaskConfig[];
    inputs?: any[]; // We don't directly process inputs, VS Code handles them
}

export class HC3EmuTaskProvider implements vscode.TaskProvider {
    static taskType = 'hc3emu'; // Back to custom type
    private cachedTasks: vscode.Task[] | undefined;
    private tasksPromise: Promise<vscode.Task[]> | undefined;

    constructor() {}

    // Helper to build a vscode.Task object from our definition
    private buildVscodeTask(definition: HC3EmuTaskDefinition, scope?: vscode.TaskScope | vscode.WorkspaceFolder): vscode.Task {
        // The definition object that VS Code will store and use to identify the task.
        // It MUST include the 'type' property matching our provider.
        const taskDefinitionForStore: HC3EmuTaskDefinition = {
            type: 'hc3emu',
            label: definition.label,
            command: definition.command,
            args: definition.args,
        };

        let taskScope: vscode.TaskScope | undefined;
        if (scope === undefined || scope === vscode.TaskScope.Global || scope === vscode.TaskScope.Workspace) {
            taskScope = scope;
        } else {
            // If scope is a WorkspaceFolder, it implies TaskScope.Workspace for that folder.
            // However, the Task constructor expects TaskScope.Workspace or TaskScope.Global.
            // For simplicity and common use cases, we'll default to Workspace scope.
            // If folder-specific tasks are critical, this logic might need refinement
            // to pass the WorkspaceFolder itself if the API supports it directly for scope,
            // or handle it by creating tasks per folder.
            taskScope = vscode.TaskScope.Workspace;
        }

        return new vscode.Task(
            taskDefinitionForStore,         // The unique definition of the task
            taskScope || vscode.TaskScope.Workspace, // Task scope
            definition.label,               // Name of the task (shown in UI)
            'hc3emu',    // Source of the task (our extension)
            new vscode.ShellExecution(definition.command, definition.args || []) // How to execute it
            // You can add problemMatchers here if needed, e.g., ['$lua']
        );
    }

    public provideTasks(): vscode.ProviderResult<vscode.Task[]> {
        console.log('HC3EmuTaskProvider: provideTasks() called by VS Code');
        console.log('HC3EmuTaskProvider: Stack trace:', new Error().stack);
        if (this.cachedTasks) {
            console.log(`HC3EmuTaskProvider: Returning ${this.cachedTasks.length} cached tasks`);
            return this.cachedTasks;
        }
        if (!this.tasksPromise) {
            console.log('HC3EmuTaskProvider: Loading tasks from file...');
            this.tasksPromise = this.loadTasksFromFile().then(tasks => {
                console.log(`HC3EmuTaskProvider: Loaded ${tasks.length} tasks from file`);
                this.cachedTasks = tasks;
                return tasks;
            }).catch(err => {
                console.error("HC3EmuTaskProvider: Failed to load tasks:", err);
                this.tasksPromise = undefined;
                this.cachedTasks = undefined;
                vscode.window.showErrorMessage("Failed to load hc3emu tasks. See console for details.");
                return [];
            });
        }
        return this.tasksPromise;
    }

    public resolveTask(task: vscode.Task): vscode.Task | undefined {
        console.log('HC3EmuTaskProvider: resolveTask() called for task:', task.name);
        const definition = task.definition as HC3EmuTaskDefinition;

        // Check if this task definition is something our provider understands
        // (i.e., has the correct type and the required properties 'label' and 'command')
        if (definition.type === 'hc3emu' && definition.label && definition.command) {
            // Re-create the task using the provided definition.
            // The 'definition' object (task.definition) already contains all necessary info.
            // Pass the original task's scope (which could be a WorkspaceFolder)
            return this.buildVscodeTask(definition, task.scope);
        }
        return undefined;
    }

    private async loadTasksFromFile(): Promise<vscode.Task[]> {
        console.log('HC3EmuTaskProvider: loadTasksFromFile() starting...');
        const discoveredTasks: vscode.Task[] = [];
        const workspaceFolders = vscode.workspace.workspaceFolders;

        if (!workspaceFolders || workspaceFolders.length === 0) {
            console.log("HC3EmuTaskProvider: No workspace folder open, cannot load hc3emu2tasks.json.");
            return discoveredTasks;
        }

        // Try multiple possible locations for the tasks file
        const possiblePaths = [
            'hc3emu2tasks.json',           // Root of workspace
            '../hc3emu2tasks.json',        // Parent directory
            '../../hc3emu2tasks.json'      // Grandparent directory
        ];

        let tasksJsonUri: vscode.Uri | null = null;
        let tasksJsonString: string = '';

        for (const relativePath of possiblePaths) {
            try {
                const candidateUri = vscode.Uri.joinPath(workspaceFolders[0].uri, relativePath);
                console.log(`HC3EmuTaskProvider: Trying tasks file at: ${candidateUri.fsPath}`);
                
                const fileContent = await vscode.workspace.fs.readFile(candidateUri);
                tasksJsonString = Buffer.from(fileContent).toString('utf8');
                tasksJsonUri = candidateUri;
                console.log(`HC3EmuTaskProvider: Found tasks file at: ${candidateUri.fsPath}`);
                break;
            } catch (error: any) {
                if (error.code === 'FileNotFound') {
                    console.log(`HC3EmuTaskProvider: File not found at: ${vscode.Uri.joinPath(workspaceFolders[0].uri, relativePath).fsPath}`);
                } else {
                    console.error(`HC3EmuTaskProvider: Error reading file at ${relativePath}:`, error);
                }
            }
        }

        if (!tasksJsonUri) {
            console.log('HC3EmuTaskProvider: No hc3emu2tasks.json file found in any expected location');
            return discoveredTasks;
        }

        try {
            console.log(`HC3EmuTaskProvider: File content loaded, length: ${tasksJsonString.length}`);
            
            const tasksJson = JSON.parse(tasksJsonString) as Hc3Emu2TasksJsonFormat;
            console.log(`HC3EmuTaskProvider: JSON parsed, found ${tasksJson.tasks?.length || 0} tasks`);

            if (tasksJson && tasksJson.tasks && Array.isArray(tasksJson.tasks)) {
                for (const taskConfig of tasksJson.tasks) {
                    console.log(`HC3EmuTaskProvider: Processing task: "${taskConfig.label}"`);
                    if (taskConfig.label && taskConfig.command) {
                        const definition: HC3EmuTaskDefinition = {
                            type: 'hc3emu',
                            label: taskConfig.label,
                            command: taskConfig.command,
                            args: taskConfig.args || []
                        };
                        const task = this.buildVscodeTask(definition);
                        discoveredTasks.push(task);
                        console.log(`HC3EmuTaskProvider: Successfully added task: "${taskConfig.label}"`);
                    } else {
                        console.warn(`HC3EmuTaskProvider: Skipping task due to missing label or command:`, taskConfig);
                    }
                }
            } else {
                console.warn('HC3EmuTaskProvider: Invalid JSON structure or no tasks array found');
            }
        } catch (error: any) {
            console.error(`HC3EmuTaskProvider: Error parsing JSON from ${tasksJsonUri.fsPath}:`, error);
            if (error instanceof SyntaxError) {
                console.error('HC3EmuTaskProvider: JSON syntax error:', error.message);
            }
        }
        
        console.log(`HC3EmuTaskProvider: Returning ${discoveredTasks.length} discovered tasks`);
        return discoveredTasks;
    }
}
