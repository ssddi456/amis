/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as path from 'path';
import * as fs from 'fs';
import { workspace, ExtensionContext, window, ViewColumn, Uri, commands } from 'vscode';

import {
	CloseAction,
	ErrorAction,
	InitializeError,
	LanguageClient,
	LanguageClientOptions,
	Message,
	ResponseError,
	ServerOptions,
	TransportKind
} from 'vscode-languageclient';

let client: LanguageClient;

export function activate(context: ExtensionContext) {
	// The server is implemented in node
	let serverModule = context.asAbsolutePath(
		// path.join('dist', 'server.js')
		path.join('server', 'out', 'src', 'server.js')
	);
	console.log('serverModule', serverModule);

	// The debug options for the server
	// --inspect=6009: runs the server in Node's Inspector mode so VS Code can attach to the server for debugging
	let debugOptions = { execArgv: ['--nolazy', '--inspect-brk=6009'] };

	// If the extension is launched in debug mode then the debug server options are used
	// Otherwise the run options are used
	let serverOptions: ServerOptions = {
		run: { module: serverModule, transport: TransportKind.ipc },
		debug: {
			module: serverModule,
			transport: TransportKind.ipc,
			options: debugOptions
		}
	};

	// Options to control the language client
	let clientOptions: LanguageClientOptions = {
		// Register the server for plain text documents
		documentSelector: [
			{ language: 'javascript' },
			{ language: 'javascriptreact' },
			{ language: 'typescript' },
			{ language: 'typescriptreact' },
		],
		synchronize: {
			// Notify the server about file changes to '.clientrc files contained in the workspace
			fileEvents: workspace.createFileSystemWatcher('**/.clientrc')
		},
		errorHandler: {
			error(error: Error, message: Message, count: number): ErrorAction {
				console.log(error, message, count);
				return ErrorAction.Continue;
			},
			closed(): CloseAction {
				return CloseAction.DoNotRestart;
			}
		},
		initializationFailedHandler(error: ResponseError<InitializeError> | Error | any): boolean {
			console.log(error);
			return false;
		}
	};

	// Create the language client and start the client.
	client = new LanguageClient(
		'AmislanguageServer',
		'Amis Language Server',
		serverOptions,
		clientOptions
	);
	client.onReady().then(() => {
		console.log('client ready');

		let previewPanal;
		client.onNotification("amisJsonExtension/openPreviewWebview", async (args: Array<String>) => {
			const panel = window.createWebviewPanel(
				'Amis preview', // viewType
				"WebView演示", // 视图标题
				ViewColumn.Two, // 显示在编辑器的哪个部位
				{
					enableScripts: true,
					enableFindWidget: true,
					retainContextWhenHidden: true, // webview被隐藏时保持状态，避免被重置
				}
			);

			// Get path to resource on disk
			const onDiskPath = Uri.file(path.join(context.extensionPath, 'assets', 'preview_inner.html'));
			// And get the special URI to use with the webview
			const preview_inner_url = panel.webview.asWebviewUri(onDiskPath) + '?pid=kemis_pc&version=1.0.20';
			panel.webview.html = await new Promise((res) => {
				fs.readFile(path.join(__dirname, '../../assets/preview_container.html'), 'utf8', function (err, content) {
					res((content || '').replace(/src="preview_inner\.html/, 'src="' + preview_inner_url));
				});
			});

			panel.webview.postMessage({
				isJS: false,
				schema: {
					"type": "page",
					"body": [{}]
				},
				type: 'schema'
			});
			previewPanal = panel;

			panel.onDidDispose(function () {
				commands.executeCommand('amis.endPreviewSchema');
			});
		});

		client.onNotification("amisJsonExtension/updatePreviewWebview", (infos) => {
			if (previewPanal) {
				previewPanal.webview.postMessage({ schema: infos })
			} else {

			}
		});
	});

	console.log('client start');
	// Start the client. This will also launch the server
	context.subscriptions.push(client.start());
}

export function deactivate(): Thenable<void> | undefined {
	if (!client) {
		return undefined;
	}
	return client.stop();
}
