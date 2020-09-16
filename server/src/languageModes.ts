import {
    CompletionItem,
    Location,
    SignatureHelp,
    Definition,
    TextEdit,
    Diagnostic,
    DocumentLink,
    Range,
    Hover,
    DocumentHighlight,
    CompletionList,
    Position,
    FormattingOptions,
    SymbolInformation
} from 'vscode-languageserver-types';

export interface DocumentContext {
    resolveReference(ref: string, base?: string): string;
}

import { getLanguageModelCache, LanguageModelCache } from './languageModelCache';
import { logger } from './utils/logger';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { Color, ColorInformation, ColorPresentation } from 'vscode-languageserver';
import { DocumentRegions, getDocumentRegions } from './embeddedSupport';

export interface LanguageMode {
    getId(): string;
    configure?(options: any): void;
    doValidation?(document: TextDocument): Diagnostic[];
    doComplete?(document: TextDocument, position: Position): CompletionList;
    doResolve?(document: TextDocument, item: CompletionItem): CompletionItem;
    doHover?(document: TextDocument, position: Position): Hover;
    doSignatureHelp?(document: TextDocument, position: Position): SignatureHelp;
    findDocumentHighlight?(document: TextDocument, position: Position): DocumentHighlight[];
    findDocumentSymbols?(document: TextDocument): SymbolInformation[];
    findDocumentLinks?(document: TextDocument, documentContext: DocumentContext): DocumentLink[];
    findDefinition?(document: TextDocument, position: Position): Definition;
    findReferences?(document: TextDocument, position: Position): Location[];
    format?(document: TextDocument, range: Range, options: FormattingOptions): TextEdit[];
    findDocumentColors?(document: TextDocument): ColorInformation[];
    getColorPresentations?(document: TextDocument, color: Color, range: Range): ColorPresentation[];

    onDocumentRemoved(document: TextDocument): void;
    dispose(): void;
}

export interface LanguageModes {
    getModeAtPosition(document: TextDocument, position: Position): LanguageMode | null;
    getModesInRange(document: TextDocument, range: Range): LanguageModeRange[];
    getAllModes(): LanguageMode[];
    getAllModesInDocument(document: TextDocument): LanguageMode[];
    getMode(languageId: string): LanguageMode;
    onDocumentRemoved(document: TextDocument): void;
    dispose(): void;
}

export interface LanguageModeRange extends Range {
    mode: LanguageMode;
    attributeValue?: boolean;
}

export function getLanguageModes(workspacePath: string | null | undefined): LanguageModes {
    const documentRegions = getLanguageModelCache<DocumentRegions>(10, 60, document => getDocumentRegions(document));

    let modelCaches: LanguageModelCache<any>[] = [];
    modelCaches.push(documentRegions);

    let modes: { [k: string]: LanguageMode } = {
		javascript: jsMode,
		jsx: jsMode,
        tsx: jsMode,
        typescript: jsMode
    };

    return {
        getModeAtPosition(document: TextDocument, position: Position): LanguageMode | null {
            const languageId = documentRegions.get(document).getLanguageAtPosition(position);
            logger.log(() => ['getModeAtPosition', position, languageId]);
            if (languageId) {
                return modes[languageId];
            }
            return null;
        },
        getModesInRange(document: TextDocument, range: Range): LanguageModeRange[] {
            return documentRegions
                .get(document)
                .getLanguageRanges(range)
                .map(r => {
                    return {
                        start: r.start,
                        end: r.end,
                        mode: modes[r.languageId],
                        attributeValue: r.attributeValue
                    };
                });
        },
        getAllModesInDocument(document: TextDocument): LanguageMode[] {
            const result = [];
            for (const languageId of documentRegions.get(document).getLanguagesInDocument()) {
                const mode = modes[languageId];
                if (mode) {
                    result.push(mode);
                }
            }
            return result;
        },
        getAllModes(): LanguageMode[] {
            const result = [];
            for (const languageId in modes) {
                const mode = modes[languageId];
                if (mode) {
                    result.push(mode);
                }
            }
            return result;
        },
        getMode(languageId: string): LanguageMode {
            return modes[languageId];
        },
        onDocumentRemoved(document: TextDocument) {
            modelCaches.forEach(mc => mc.onDocumentRemoved(document));
            for (const mode in modes) {
                modes[mode].onDocumentRemoved(document);
            }
        },
        dispose(): void {
            modelCaches.forEach(mc => mc.dispose());
            modelCaches = [];
            for (const mode in modes) {
                modes[mode].dispose();
            }
            modes = {}; // drop all references
        }
    };
}