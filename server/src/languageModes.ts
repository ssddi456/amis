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
import { Color, ColorInformation, ColorPresentation, HandlerResult } from 'vscode-languageserver';
import { DocumentRegions } from './embeddedSupport';
import { getDocumentRegions } from './modes/helpers/parser';
import { getAmisJsonMode } from './modes/amisJson';

export interface LanguageMode {
    getId(): string;
    configure?(options: any): void;
    doValidation?(document: TextDocument): Diagnostic[];
    doComplete?(document: TextDocument, position: Position): Promise<CompletionList> | CompletionList;
    doResolve?(document: TextDocument, item: CompletionItem): HandlerResult<CompletionItem | null, any>;
    doHover?(document: TextDocument, position: Position): HandlerResult<Hover | null, any>;
    doSignatureHelp?(document: TextDocument, position: Position): HandlerResult<SignatureHelp | null, any>;
    findDocumentHighlight?(document: TextDocument, position: Position): HandlerResult<DocumentHighlight[] | null, any>;
    findDocumentSymbols?(document: TextDocument): HandlerResult<SymbolInformation[] | null, any>;
    findDocumentLinks?(document: TextDocument, documentContext: DocumentContext): HandlerResult<DocumentLink[] | null, any>;
    findDefinition?(document: TextDocument, position: Position): HandlerResult<Definition | null, any>;
    findReferences?(document: TextDocument, position: Position): HandlerResult<Location[] | null, any>;
    format?(document: TextDocument, range: Range, options: FormattingOptions): HandlerResult<TextEdit[] | null, any>;
    findDocumentColors?(document: TextDocument): HandlerResult<ColorInformation[] | null, any>;
    getColorPresentations?(document: TextDocument, color: Color, range: Range): HandlerResult<ColorPresentation[] | null, any>;

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
    const documentRegions = getLanguageModelCache<DocumentRegions>(10, 60, getDocumentRegions);
    const jsonMode = getAmisJsonMode(documentRegions, workspacePath);
    let modelCaches: LanguageModelCache<any>[] = [];
    modelCaches.push(documentRegions);

    let modes: { [k: string]: LanguageMode } = {
        amisjson: jsonMode,
        javascript: jsonMode,
        jsx: jsonMode,
        tsx: jsonMode,
        typescript: jsonMode
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
                if (mode && result.indexOf(mode) === -1) {
                    result.push(mode);
                }
            }
            return result;
        },
        getAllModes(): LanguageMode[] {
            const result = [];
            for (const languageId in modes) {
                const mode = modes[languageId];
                if (mode && result.indexOf(mode) === -1) {
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