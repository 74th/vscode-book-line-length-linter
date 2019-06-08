import * as vscode from "vscode";

interface LllTaskDefinition extends vscode.TaskDefinition {
  task: string;
  file?: string;
}

export function activate(context: vscode.ExtensionContext) {
  console.log(
    'Congratulations, your extension "line-length-linter" is now active!'
  );

  let lllPromise: Thenable<vscode.Task[]> | undefined = undefined;
  const taskProvider = vscode.tasks.registerTaskProvider("lll", {
    provideTasks: () => {
      if (!lllPromise) {
        lllPromise = getLllTasks();
      }
      return lllPromise;
    },
    resolveTask: (_task: vscode.Task): vscode.Task | undefined => {
      return undefined;
    }
  });
}

async function getLllTasks(): Promise<vscode.Task[]> {

  const tasks: vscode.Task[] = [];

  if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
    return tasks;
  }

  for (const workspaceFolder of vscode.workspace.workspaceFolders) {
    let task = new vscode.Task(
      { type: "lll" },
      workspaceFolder,
      "line length linter " + workspaceFolder.name,
      "lll",
      new vscode.ShellExecution("lll", [".", "--skiplist", "node_modules"], {
        cwd: workspaceFolder.uri.fsPath
      }),
      "$lll"
    );
    tasks.push(task);
  }
  return tasks;
}

// this method is called when your extension is deactivated
export function deactivate() {}
