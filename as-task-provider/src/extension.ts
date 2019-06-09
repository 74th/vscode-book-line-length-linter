import * as vscode from "vscode";

interface LllTaskDefinition extends vscode.TaskDefinition {
  src?: string;
}

export function activate(context: vscode.ExtensionContext) {
  console.log(
    'Congratulations, your extension "line-length-linter" is now active!'
  );

  const disposable = vscode.tasks.registerTaskProvider("lll", {
    provideTasks: getLllTasks,
    // 現在、resolveTaskは未実装
    resolveTask: resolveTask,
  });
  context.subscriptions.push(disposable);

}

/**
 * シェルコマンドを作成する
 */
function createCommand(settings: LllTaskDefinition, scope: vscode.WorkspaceFolder):vscode.ShellExecution {
  return new vscode.ShellExecution(
    "lll",
    [".", "--skiplist", "node_modules"],
    { cwd: scope.uri.fsPath }
  );
}

/**
 * 自動検出タスクを作成する
 */
async function getLllTasks(): Promise<vscode.Task[]> {

  const tasks: vscode.Task[] = [];

  if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
    // ワークスペースがあるかどうかのチェック
    return tasks;
  }

  for (const workspaceFolder of vscode.workspace.workspaceFolders) {
    // ワークスペースごとのタスクを生成
    const taskDefinition = { type: "lll" };
    let task = new vscode.Task(
      taskDefinition,
      workspaceFolder,
      "lint " + workspaceFolder.name,
      "lll",
      createCommand(taskDefinition, workspaceFolder),
      "$lll"
    );
    tasks.push(task);
  }
  return tasks;
}

/**
 * tasks.jsonから、実行可能なタスクを作成する
 */
async function resolveTask(task: vscode.Task): Promise<vscode.Task> {
  const settings = task.definition as LllTaskDefinition;
  task.execution = createCommand(settings, task.scope as vscode.WorkspaceFolder);
  task.source = "lll";
  task.problemMatchers = ["$lll"];
  return task;
}

// this method is called when your extension is deactivated
export function deactivate() {}
