import * as path from "path";
import * as vscode from "vscode";
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind
} from "vscode-languageclient";

let client: LanguageClient;

export function activate(context: vscode.ExtensionContext) {
  let serverModule = context.asAbsolutePath(
    path.join("server", "out", "server.js")
  );

  let debugOptions = {
    execArgv: ["--nolazy", "--inspect=6010"]
  };

  let serverOptions: ServerOptions = {
    run: {
      module: serverModule,
      transport: TransportKind.ipc
    },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: debugOptions
    }
  };

  let clientOptions: LanguageClientOptions = {
    documentSelector: [{scheme:"file"}],
    // documentSelector: [{ scheme: "file", language: "plaintext" }],
    synchronize: {
      configurationSection: "lll",
      fileEvents: vscode.workspace.createFileSystemWatcher("**/.lllrc")
    }
  };

  client = new LanguageClient(
    "line-length-linter",
    "Line Length Linter",
    serverOptions,
    clientOptions
  );

  client.start();
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  return client.stop();
}
