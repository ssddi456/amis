import { LanguageModelCache, getLanguageModelCache } from '../languageModelCache';
import {
	SymbolInformation,
	SymbolKind,
	CompletionItem,
	SignatureHelp,
	SignatureInformation,
	ParameterInformation,
	Definition,
	TextEdit,
	Diagnostic,
	DiagnosticSeverity,
	Range,
	CompletionItemKind,
	Hover,
	MarkedString,
	DocumentHighlight,
	DocumentHighlightKind,
	CompletionList,
	Position,
	FormattingOptions
} from 'vscode-languageserver-types';
import { LanguageMode } from '../languageModes';
import { DocumentRegions, LanguageRange } from '../embeddedSupport';
import { getServiceHost } from './serviceHost';
import { getFileFsPath, getFilePath } from '../utils/paths';

import { URI } from 'vscode-uri';
import * as ts from 'typescript';
import * as _ from 'lodash';

import { nullMode, NULL_SIGNATURE, NULL_COMPLETION, NULL_HOVER } from './nullMode';
import { logger } from '../utils/logger';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { getAmisJsonOriginName, isAmisJsonUrl } from './helpers/bridge';
import { MarkupContent } from 'vscode-languageserver';

export function getJavascriptMode(
	documentRegions: LanguageModelCache<DocumentRegions>,
	workspacePath: string | null | undefined
): LanguageMode {
	if (!workspacePath) {
		return { ...nullMode, };
	}
	const jsDocuments = getLanguageModelCache(10, 60, document => {

		if (isAmisJsonUrl(document.uri)) {

			logger.log(() => `js modes parse ${document.uri}
languageId ${document.languageId}
isSanInterpolation ${isAmisJsonUrl(document.uri)}
content ${document.getText()}`);

			const sanDocument = documentRegions.get(TextDocument.create(
				getAmisJsonOriginName(document.uri),
				'san',
				document.version,
				document.getText()
			));

			const template = sanDocument.getEmbeddedDocumentByType('template');

			return TextDocument.create(
				document.uri,
				document.languageId,
				document.version,
				parseSanInterpolation(template.getText(), false),
			);
		} else {
			return document;
		}
	});

	const regionStart = getLanguageModelCache(10, 60, document => {
		const sanDocument = documentRegions.get(document);
		return sanDocument.getLanguageRangeByType('script');
	});

	const serviceHost = getServiceHost(workspacePath, jsDocuments, documentRegions);
	const { updateCurrentTextDocument, getScriptDocByFsPath, getLanguageId } = serviceHost;
	let config: any = {};

	return {
		getId() {
			return 'javascript';
		},
		configure(c) {
			config = c;
		},
		doValidation(doc: TextDocument, noUnsedVal = false): Diagnostic[] {
			logger.log(() => ['start doValidation', doc.uri]);
			let service: ts.LanguageService;
			const updatedServiceInfo = updateCurrentTextDocument(doc);
			const scriptDoc = updatedServiceInfo.scriptDoc;
			service = updatedServiceInfo.service;

			if (!languageServiceIncludesFile(service, doc.uri)) {
				logger.log(() => ['feiled to do validation, no such a file', doc.uri]);
				return [];
			}

			const fileFsPath = getFileFsPath(doc.uri);
			let diagnostics: ts.Diagnostic[] = [];


			try {
				service.getSyntacticDiagnostics(fileFsPath).forEach(x => diagnostics.push(x));
				service.getSemanticDiagnostics(fileFsPath).forEach(x => diagnostics.push(x));
				service.getSuggestionDiagnostics(fileFsPath).forEach(x => diagnostics.push(x));
			} catch (e) {
				logger.log(() => ['do validation exception', doc.uri, e]);
				return [];
			}

			logger.log(() => ['origin dianostics ', diagnostics]);

			if (noUnsedVal) {
				diagnostics = diagnostics.filter(function (diag) {
					return diag.code !== 6133; //ts.Diagnostics._0_is_declared_but_its_value_is_never_read
				})
			}
			return diagnostics.map(diag => {
				// syntactic/semantic diagnostic always has start and length
				// so we can safely cast diag to TextSpan
				return {
					range: convertRange(scriptDoc, diag as ts.TextSpan),
					severity: DiagnosticSeverity.Error,
					message: ts.flattenDiagnosticMessageText(diag.messageText, '\n')
				};
			});
		},
		doComplete(doc: TextDocument, position: Position): CompletionList {
			// 这里从shadow json读一下
			return {
				isIncomplete: false,
				items: []
			};
		},

		doHover(doc: TextDocument, position: Position): Hover {
			logger.log(() => ['start doHover', doc.uri]);
			let service: ts.LanguageService;
			const updatedServiceInfo = updateCurrentTextDocument(doc);
			const scriptDoc = updatedServiceInfo.scriptDoc;
			service = updatedServiceInfo.service;

			if (!languageServiceIncludesFile(service, doc.uri)) {
				logger.log(() => ['cannot found the doc', doc.uri]);
				return NULL_HOVER;
			}

			const fileFsPath = getFileFsPath(doc.uri);
			const offset = scriptDoc.offsetAt(position);
			logger.log(() => ['start to get quick info',
				doc.uri,
				languageServiceIncludesFile(service, doc.uri),
				scriptDoc.getText(),
				offset,]
			);

			let info: ts.QuickInfo | undefined;
			if (isSan(fileFsPath) && getLanguageId(fileFsPath) == 'javascript') {
				const shadowTsDoc = TextDocument.create(
					createShadowTsFileName(doc.uri),
					'typescript',
					doc.version,
					doc.getText()
				);
				service = updateCurrentTextDocument(shadowTsDoc).service;
				try {
					info = service.getQuickInfoAtPosition(
						createShadowTsFileName(fileFsPath), offset);
				} catch (e) {
					logger.log(() => [e]);
				}
				logger.log(() => ['shadow ts file type info', info,]);
			}

			if (!info) {
				try {
					info = service.getQuickInfoAtPosition(fileFsPath, offset);
				} catch (e) {
					logger.log(() => [e]);
				}
				logger.log(() => ['origin quick info', info]);
			}

			if (info) {
				info.displayParts.forEach(x => {
					if (x.kind == 'moduleName') {
						const suffixIndex = x.text.indexOf(shadowTsSurfix);

						if (suffixIndex !== -1 && suffixIndex == x.text.length - 1 - shadowTsSurfix.length) {
							logger.log(() => ['origin file name ', x.text]);
							x.text = x.text.replace(/^('|")(.*)(\1)$/, function ($, $1, $2, $3) {
								return $1
									+ getShadowTsOriginName($2 + '.ts')
									+ $3;
							});
							logger.log(() => ['parsed file name ', x.text]);
						}
					} else if (x.kind == 'aliasName') {
						const emptyName = x.text.match(/[ \n]+/g)
						logger.log(() => ['parsed alias name ', x.text, emptyName]);
						if (emptyName && emptyName[0].length == x.text.length) {
							x.text = '<missing>';
						}
					}
				});
				const display = ts.displayPartsToString(info.displayParts);
				const doc = ts.displayPartsToString(info.documentation);
				const markedContents: MarkupContent = { kind: 'markdown', value: '```' + display + '```' };
				logger.log(() => ['hover info for display', display]);
				if (doc) {
					markedContents.value +=  '\n' + doc + '\n';
				}
				return {
					range: convertRange(scriptDoc, info.textSpan),
					contents: markedContents
				};
			}
			return NULL_HOVER;
		},
		

		onDocumentRemoved(document: TextDocument) {
			jsDocuments.onDocumentRemoved(document);
		},
		dispose() {
			serviceHost.dispose();
			jsDocuments.dispose();
		}
	};
}

function languageServiceIncludesFile(ls: ts.LanguageService, documentUri: string): boolean {
	const filePaths = ls.getProgram()!.getRootFileNames();
	const filePath = getFilePath(documentUri);
	return filePaths.includes(filePath);
}

function convertRange(document: TextDocument, span: ts.TextSpan): Range {
	const startPosition = document.positionAt(span.start);
	const endPosition = document.positionAt(span.start + span.length);
	return Range.create(startPosition, endPosition);
}

function convertKind(kind: ts.ScriptElementKind): CompletionItemKind {
	switch (kind) {
		case 'primitive type':
		case 'keyword':
			return CompletionItemKind.Keyword;
		case 'var':
		case 'local var':
			return CompletionItemKind.Variable;
		case 'property':
		case 'getter':
		case 'setter':
			return CompletionItemKind.Field;
		case 'function':
		case 'method':
		case 'construct':
		case 'call':
		case 'index':
			return CompletionItemKind.Function;
		case 'enum':
			return CompletionItemKind.Enum;
		case 'module':
			return CompletionItemKind.Module;
		case 'class':
			return CompletionItemKind.Class;
		case 'interface':
			return CompletionItemKind.Interface;
		case 'warning':
			return CompletionItemKind.File;
	}

	return CompletionItemKind.Property;
}



function convertCodeAction(
	doc: TextDocument,
	codeActions: ts.CodeAction[],
	regionStart: LanguageModelCache<LanguageRange | undefined>) {
	const textEdits: TextEdit[] = [];
	for (const action of codeActions) {
		for (const change of action.changes) {
			textEdits.push(...change.textChanges.map(tc => {
				// currently, only import codeAction is available
				// change start of doc to start of script region
				if (tc.span.start === 0 && tc.span.length === 0) {
					const region = regionStart.get(doc);
					if (region) {
						const line = region.start.line;
						return {
							range: Range.create(line + 1, 0, line + 1, 0),
							newText: tc.newText
						};
					}
				}
				return {
					range: convertRange(doc, tc.span),
					newText: tc.newText
				};
			}
			));
		}
	}
	return textEdits;
}