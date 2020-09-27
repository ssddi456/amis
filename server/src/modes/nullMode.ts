import { LanguageMode } from '../languageModes';
import { CompletionList } from 'vscode-languageserver';

export const NULL_HOVER = {
	contents: []
};

export const NULL_SIGNATURE = {
	signatures: [],
	activeSignature: 0,
	activeParameter: 0
};

export const NULL_COMPLETION: CompletionList = {
	isIncomplete: false,
	items: [],
};

export const nullMode: LanguageMode = {
	getId: () => '',
	onDocumentRemoved() { },
	dispose() { },
	doHover: (...args: any[]) => NULL_HOVER,
	doComplete: (...args: any[]) => NULL_COMPLETION,
	doSignatureHelp: (...args: any[]) => NULL_SIGNATURE,
	findReferences: (...args: any[]) => []
};
