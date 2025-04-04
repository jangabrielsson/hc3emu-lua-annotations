import * as vscode from 'vscode';

interface HC3EmuTaskDefinition extends vscode.TaskDefinition {
    script: string;
    args?: string[];
}

export class HC3EmuTaskProvider implements vscode.TaskProvider {
    static taskType = 'hc3emu';
    private tasks: vscode.Task[] | undefined;

    public provideTasks(): vscode.ProviderResult<vscode.Task[]> {
        if (this.tasks) {
            return this.tasks;
        }

        this.tasks = this.loadTasks();
        return this.tasks;
    }

    public resolveTask(task: vscode.Task): vscode.Task | undefined {
        const definition = task.definition as HC3EmuTaskDefinition;
        return this.createTask(definition);
    }

    private loadTasks(): vscode.Task[] {
        const result: vscode.Task[] = [];
        
        // Add default tasks
        result.push(this.createTask({
            type: HC3EmuTaskProvider.taskType,
            script: 'run',
            args: ['${file}']
        }));

        return result;
    }

    private createTask(definition: HC3EmuTaskDefinition): vscode.Task {
        const execution = new vscode.ShellExecution(`hc3emu ${definition.script} ${(definition.args || []).join(' ')}`);
        return new vscode.Task(
            definition,
            vscode.TaskScope.Workspace,
            `HC3Emu: ${definition.script}`,
            HC3EmuTaskProvider.taskType,
            execution
        );
    }
}
