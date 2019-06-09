import * as child_process from "child_process";
import * as ls from "vscode-languageserver";

// 接続を管理するモジュール
let connection = ls.createConnection(ls.ProposedFeatures.all);

// ソースコードの同期を管理するモジュール
let documents: ls.TextDocuments = new ls.TextDocuments();

connection.onInitialize((params: ls.InitializeParams) => {
  // 初期化前のイベント
  // ソースコードの同期のモジュールを渡します
  return {
    capabilities: {
      textDocumentSync: documents.syncKind,

    }
  };
});

connection.onInitialized(() => {
  // Language Client と接続したときのイベント

  // 設定が変更されたとき、イベントを受け取るように設定します
  connection.client.register(
    ls.DidChangeConfigurationNotification.type,
    undefined
  );
});

// 設定
interface LllSettings {
  maxLength: number;
}

// ファイルごとの設定を管理する
let documentSettings: Map<string, Thenable<LllSettings>> = new Map();

// 設定変更時の置き換え
connection.onDidChangeConfiguration(change => {
  // すべてのドキュメントの設定を削除する
  documentSettings.clear();
  // すべてのドキュメントでリントを再実行する
  documents.all().forEach(validateTextDocument);
});

/**
 * ドキュメントの設定を取得します
 **/
function getDocumentSettings(resource: string): Thenable<LllSettings> {
  // documentSettingsにキャッシュし、リントを実行するたびに実行しないようにする
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
async function validateTextDocument(textDocument: ls.TextDocument): Promise<void> {

  const filePath = ls.Files.uriToFilePath(textDocument.uri);
  if (!filePath) {
    // ファイルが特定できない場合は何もしない
    return;
  }

  let config = await getDocumentSettings(textDocument.uri);

  // lllの実行
  const cmd = `lll -l ${config.maxLength} "${filePath}"`;
  connection.console.info(cmd);
  const output = child_process.execSync(cmd, {
    encoding: "utf8"
  });

  let pattern = /^([^\s]+):(\d+): (.*)$/;

  let problems = 0;
  let diagnostics: ls.Diagnostic[] = [];
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
    let diagnostic: ls.Diagnostic = {
      severity: ls.DiagnosticSeverity.Warning,
      range: {
        start: { line, character: 80 },
        end: { line, character: Number.MAX_VALUE }
      },
      message: message,
      source: "lll"
    };
    diagnostics.push(diagnostic);
  }

  // ドキュメントの読み取り例
  // const text = textDocument.getText({
  //   start: { line: 0, character: 0 },
  //   end: { line: textDocument.lineCount, character: Number.MAX_VALUE },
  // })

  // Send the computed diagnostics to VSCode.
  connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

documents.listen(connection);

connection.listen();
