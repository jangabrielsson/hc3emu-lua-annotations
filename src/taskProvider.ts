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
    static taskType = 'hc3emu'; // This must match the 'type' in package.json taskDefinitions
    private cachedTasks: vscode.Task[] | undefined;
    private tasksPromise: Promise<vscode.Task[]> | undefined;

    constructor() {}

    // Helper to build a vscode.Task object from our definition
    private buildVscodeTask(definition: HC3EmuTaskDefinition, scope?: vscode.TaskScope | vscode.WorkspaceFolder): vscode.Task {
        // The definition object that VS Code will store and use to identify the task.
        // It MUST include the 'type' property matching our provider.
        const taskDefinitionForStore: HC3EmuTaskDefinition = {
            type: HC3EmuTaskProvider.taskType,
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
            HC3EmuTaskProvider.taskType,    // Source of the task (our extension)
            new vscode.ShellExecution(definition.command, definition.args || []) // How to execute it
            // You can add problemMatchers here if needed, e.g., ['$lua']
        );
    }

    public provideTasks(): vscode.ProviderResult<vscode.Task[]> {
        if (this.cachedTasks) {
            return this.cachedTasks;
        }
        if (!this.tasksPromise) {
            this.tasksPromise = this.loadTasksFromFile().then(tasks => {
                this.cachedTasks = tasks;
                return tasks;
            }).catch(err => {
                this.tasksPromise = undefined;
                this.cachedTasks = undefined;
                console.error("Failed to load tasks for HC3Emu provider:", err);
                vscode.window.showErrorMessage("Failed to load hc3emu tasks. See console for details.");
                return [];
            });
        }
        return this.tasksPromise;
    }

    public resolveTask(task: vscode.Task): vscode.Task | undefined {
        const definition = task.definition as HC3EmuTaskDefinition;

        // Check if this task definition is something our provider understands
        // (i.e., has the correct type and the required properties 'label' and 'command')
        if (definition.type === HC3EmuTaskProvider.taskType && definition.label && definition.command) {
            // Re-create the task using the provided definition.
            // The 'definition' object (task.definition) already contains all necessary info.
            // Pass the original task's scope (which could be a WorkspaceFolder)
            return this.buildVscodeTask(definition, task.scope);
        }
        return undefined;
    }

    private async loadTasksFromFile(): Promise<vscode.Task[]> {
        const discoveredTasks: vscode.Task[] = [];
        const workspaceFolders = vscode.workspace.workspaceFolders;

        if (!workspaceFolders || workspaceFolders.length === 0) {
            console.log("No workspace folder open, cannot load hc3emu2tasks.json.");
            return discoveredTasks; // No workspace, no tasks from file
        }

        // Assuming hc3emu2tasks.json is in the root of the first workspace folder.
        // You might want to make this path configurable or search more broadly.
        const tasksJsonUri = vscode.Uri.joinPath(workspaceFolders[0].uri, 'hc3emu2tasks.json');

        try {
            const fileContent = await vscode.workspace.fs.readFile(tasksJsonUri);
            const tasksJson = JSON.parse(Buffer.from(fileContent).toString('utf8')) as Hc3Emu2TasksJsonFormat;

            if (tasksJson && tasksJson.tasks && Array.isArray(tasksJson.tasks)) {
                for (const taskConfig of tasksJson.tasks) {
                    // taskConfig is an object from the "tasks" array in hc3emu2tasks.json
                    if (taskConfig.label && taskConfig.command) { // Basic validation
                        const definition: HC3EmuTaskDefinition = {
                            type: HC3EmuTaskProvider.taskType, // Our task type
                            label: taskConfig.label,           // Will be the task name
                            command: taskConfig.command,
                            args: taskConfig.args || []
                        };
                        discoveredTasks.push(this.buildVscodeTask(definition));
                    } else {
                        console.warn(`HC3Emu TaskProvider: Skipping task from hc3emu2tasks.json due to missing 'label' or 'command':`, taskConfig);
                    }
                }
            } else {
                console.log(`HC3Emu TaskProvider: No tasks found or incorrect format in ${tasksJsonUri.fsPath}`);
            }
        } catch (error: any) {
            // File might not exist or be malformed. This is not necessarily a critical error.
            // It just means no tasks will be auto-detected from this file.
            if (error.code === 'FileNotFound') {
                console.log(`HC3Emu TaskProvider: hc3emu2tasks.json not found at ${tasksJsonUri.fsPath}. No tasks will be loaded from it.`);
            } else {
                console.error(`HC3Emu TaskProvider: Error loading tasks from ${tasksJsonUri.fsPath}:`, error);
                vscode.window.showWarningMessage(`Could not load tasks from hc3emu2tasks.json: ${error.message}`);
            }
        }
        return discoveredTasks;
    }
}
