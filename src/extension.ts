import * as vscode from 'vscode';
import { configureLuaLanguageServer } from './luaLanguageServer';
import { HC3EmuTaskProvider } from './taskProvider';

export async function activate(context: vscode.ExtensionContext) {
    try {
        const disposables: vscode.Disposable[] = [];
        
        // Register task provider
        const taskProvider = vscode.tasks.registerTaskProvider(
            HC3EmuTaskProvider.taskType, 
            new HC3EmuTaskProvider()
        );
        disposables.push(taskProvider);
        
        context.subscriptions.push(...disposables);

        // Configure Lua language server
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
