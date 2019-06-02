import * as child_process from "child_process";
import * as path from "path";
import {
  createConnection,
  TextDocuments,
  TextDocument,
  Diagnostic,
  DiagnosticSeverity,
  ProposedFeatures,
  InitializeParams,
  DidChangeConfigurationNotification,
  Files
} from "vscode-languageserver";

let connection = createConnection(ProposedFeatures.all);

let documents: TextDocuments = new TextDocuments();

let hasConfigurationCapability: boolean = false;
let hasWorkspaceFolderCapability: boolean = false;
let hasDiagnosticRelatedInformationCapability: boolean = false;

connection.onInitialize((params: InitializeParams) => {
  let capabilities = params.capabilities;

  // Does the client support the `workspace/configuration` request?
  // If not, we will fall back using global settings
  hasConfigurationCapability = !!(
    capabilities.workspace && !!capabilities.workspace.configuration
  );
  hasWorkspaceFolderCapability = !!(
    capabilities.workspace && !!capabilities.workspace.workspaceFolders
  );
  hasDiagnosticRelatedInformationCapability = !!(
    capabilities.textDocument &&
    capabilities.textDocument.publishDiagnostics &&
    capabilities.textDocument.publishDiagnostics.relatedInformation
  );

  return {
    capabilities: {
      textDocumentSync: documents.syncKind,
      // Tell the client that the server supports code completion
      completionProvider: {
        resolveProvider: true
      }
    }
  };
});

connection.onInitialized(() => {
  if (hasConfigurationCapability) {
    // Register for all configuration changes.
    connection.client.register(
      DidChangeConfigurationNotification.type,
      undefined
    );
  }
  if (hasWorkspaceFolderCapability) {
    connection.workspace.onDidChangeWorkspaceFolders(_event => {
      connection.console.log("Workspace folder change event received.");
    });
  }
});

interface LllSettings {
  maxNumberOfProblems: number;
  maxLength: number;
}

// 初期設定
const defaultSettings: LllSettings = {
  maxNumberOfProblems: 1000,
  maxLength: 80,
};
let globalSettings: LllSettings = defaultSettings;

let documentSettings: Map<string, Thenable<LllSettings>> = new Map();

// 設定変更時の置き換え
connection.onDidChangeConfiguration(change => {
  if (hasConfigurationCapability) {
    documentSettings.clear();
  } else {
    globalSettings = <LllSettings>(
      (change.settings.languageServerExample || defaultSettings)
    );
  }

  // Revalidate all open text documents
  documents.all().forEach(validateTextDocument);
});

function getDocumentSettings(resource: string): Thenable<LllSettings> {
  if (!hasConfigurationCapability) {
    return Promise.resolve(globalSettings);
  }
  let result = documentSettings.get(resource);
  if (!result) {
    result = connection.workspace.getConfiguration({
      scopeUri: resource,
      section: "lll"
    });
    documentSettings.set(resource, result);
  }
  return result;
}

// 閉じた時は設定を破棄する
documents.onDidClose(e => {
  documentSettings.delete(e.document.uri);
});

// 開いた時のイベント
documents.onDidOpen(e => {
  validateTextDocument(e.document);
});

// 保存した時のイベント
documents.onDidSave(e => {
  validateTextDocument(e.document);
});


// リントの実行
async function validateTextDocument(textDocument: TextDocument): Promise<void> {

  const filePath = Files.uriToFilePath(textDocument.uri);
  if (!filePath) {
    // ファイルが特定できない場合は何もしない
    return;
  }

  let config = await getDocumentSettings(textDocument.uri);

  // lllの実行
  const cmd = `lll -l ${config.maxLength} "${filePath}"`;
  const output = child_process.execSync(cmd, {
    encoding: "utf8"
  });

  let pattern = /^([^\s]+):(\d+): (.*)$/;

  let problems = 0;
  let diagnostics: Diagnostic[] = [];
  for (let outputLine of output.split("\n")) {
    problems++;
    if (problems > 100) {
      // 100行以上該当する場合はストップ
      break;
    }

    // 正規表現で出力から行番号とメッセージを抽出
    const m = pattern.exec(outputLine);
    if (!m) {
      continue;
    }
    const line = parseInt(m[2]) - 1;
    const message = m[3];

    // エラーとして登録
    let diagnostic: Diagnostic = {
      severity: DiagnosticSeverity.Warning,
      range: {
        start: { line, character: 80 },
        end: { line, character: Number.MAX_VALUE }
      },
      message: message,
      source: "lll"
    };
    diagnostics.push(diagnostic);
  }

  // Send the computed diagnostics to VSCode.
  connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

connection.onDidChangeWatchedFiles(_change => {
  // Monitored files have change in VSCode
  connection.console.log("We received an file change event");
});

// // This handler provides the initial list of the completion items.
// connection.onCompletion(
//   (_textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
//     // The pass parameter contains the position of the text document in
//     // which code complete got requested. For the example we ignore this
//     // info and always provide the same completion items.
//     return [
//       {
//         label: "TypeScript",
//         kind: CompletionItemKind.Text,
//         data: 1
//       },
//       {
//         label: "JavaScript",
//         kind: CompletionItemKind.Text,
//         data: 2
//       }
//     ];
//   }
// );

// // This handler resolves additional information for the item selected in
// // the completion list.
// connection.onCompletionResolve(
//   (item: CompletionItem): CompletionItem => {
//     if (item.data === 1) {
//       item.detail = "TypeScript details";
//       item.documentation = "TypeScript documentation";
//     } else if (item.data === 2) {
//       item.detail = "JavaScript details";
//       item.documentation = "JavaScript documentation";
//     }
//     return item;
//   }
// );

/*
connection.onDidOpenTextDocument((params) => {
	// A text document got opened in VSCode.
	// params.uri uniquely identifies the document. For documents store on disk this is a file URI.
	// params.text the initial full content of the document.
	connection.console.log(`${params.textDocument.uri} opened.`);
});
connection.onDidChangeTextDocument((params) => {
	// The content of a text document did change in VSCode.
	// params.uri uniquely identifies the document.
	// params.contentChanges describe the content changes to the document.
	connection.console.log(`${params.textDocument.uri} changed: ${JSON.stringify(params.contentChanges)}`);
});
connection.onDidCloseTextDocument((params) => {
	// A text document got closed in VSCode.
	// params.uri uniquely identifies the document.
	connection.console.log(`${params.textDocument.uri} closed.`);
});
*/

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
