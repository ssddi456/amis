import { DocumentRegions } from '../embeddedSupport';
import { LanguageModelCache } from '../languageModelCache';
import { LanguageMode } from '../languageModes';
import {
	LanguageSettings,
	getLanguageService,
	LanguageService,
	ClientCapabilities
} from 'vscode-json-languageservice';


export function getAmisJsonMode(
	documentRegions: LanguageModelCache<DocumentRegions>,
	workspacePath: string | null | undefined
): LanguageMode {
	let configure: LanguageSettings = {
		validate: false,
		allowComments: true,
	};
	// 这里应该有一个运行时重读配置的地儿?
	let ls = getLanguageService({ 
		clientCapabilities: ClientCapabilities.LATEST 
	}) as LanguageService;

	ls.configure(configure);

	return {
		getId() {
			return 'amisjson';
		},
		configure(c: LanguageSettings) {
			ls.configure(c);
		},
		
		doHover(document, position) {
			const textdocument = documentRegions.get(document).getSubDocumentAtPosition(position);
			const jsonDocument = ls.parseJSONDocument(textdocument);
			return ls.doHover(textdocument, position, jsonDocument)
		},

		doComplete(document, position) {
			const textdocument = documentRegions.get(document).getSubDocumentAtPosition(position);
			const jsonDocument = ls.parseJSONDocument(textdocument);
			return ls.doComplete(textdocument, position, jsonDocument)
		},

		onDocumentRemoved(document) {
			documentRegions.onDocumentRemoved(document);
		},
		dispose() {
			(ls as any) = null;
		}
	};
}