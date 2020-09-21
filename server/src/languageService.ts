import {
    Diagnostic,
    Position,
    CompletionList,
    CompletionItem,
    SignatureHelp,
    DocumentHighlight,
    SymbolInformation,
    DocumentLink,
    Definition,
    Location,
    Hover,
    Range
} from 'vscode-languageserver-types';

import {
    Color, ColorInformation, ColorPresentation
} from 'vscode-languageserver-protocol';

import { getLanguageModes, LanguageModes } from './languageModes';
import { NULL_HOVER, NULL_COMPLETION, NULL_SIGNATURE } from './modes/nullMode';

import { logger } from './utils/logger';
import { TextDocument } from 'vscode-languageserver-textdocument';

export interface DocumentContext {
    resolveReference(ref: string, base?: string): string;
}

interface ValidationOptions {
    script: boolean;
}
export function getShadowLS() {
    let languageModes: LanguageModes;
    const validation: { [k: string]: boolean } = {
        javascript: true
    };


    return {
        initialize(workspacePath: string | null | undefined) {
            languageModes = getLanguageModes(workspacePath);
        },
        configure(config: { drei: { validation: ValidationOptions } }) {
            const dreiValidationOptions = config.drei.validation;

            validation.javascript = dreiValidationOptions.script;

            languageModes.getAllModes().forEach(m => {
                if (m.configure) {
                    m.configure(config);
                }
            });
        },

        validate(doc: TextDocument): Diagnostic[] {
            const diagnostics: Diagnostic[] = [];
            if (doc.languageId === 'san') {
                languageModes.getAllModesInDocument(doc).forEach(mode => {
                    if (mode.doValidation && validation[mode.getId()]) {
                        pushAll(diagnostics, mode.doValidation(doc));
                    }
                });
            }
            return diagnostics;
        },
        doComplete(doc: TextDocument, position: Position): CompletionList {
            const mode = languageModes.getModeAtPosition(doc, position);
            if (mode) {
                if (mode.doComplete) {
                    return mode.doComplete(doc, position);
                }
            }
            return NULL_COMPLETION;
        },
        doResolve(doc: TextDocument, languageId: string, item: CompletionItem): CompletionItem {
            const mode = languageModes.getMode(languageId);
            if (mode && mode.doResolve && doc) {
                return mode.doResolve(doc, item);
            }
            return item;
        },
        doHover(doc: TextDocument, position: Position): Hover {
            const mode = languageModes.getModeAtPosition(doc, position);
            logger.log(() => ['do hover!!', mode!.getId()]);

            if (mode && mode.doHover) {
                try {
                    return mode.doHover(doc, position);
                } catch (error) {
                    logger.log(() => [error]);
                }
            }
            return NULL_HOVER;
        },
        findDocumentHighlight(doc: TextDocument, position: Position): DocumentHighlight[] {
            const mode = languageModes.getModeAtPosition(doc, position);
            if (mode && mode.findDocumentHighlight) {
                return mode.findDocumentHighlight(doc, position);
            }
            return [];
        },
        findDefinition(doc: TextDocument, position: Position): Definition {
            logger.log(() => ['do findDefinition', doc.uri]);

            const mode = languageModes.getModeAtPosition(doc, position);
            if (mode && mode.findDefinition) {
                return mode.findDefinition(doc, position);
            }
            return [];
        },
        findReferences(doc: TextDocument, position: Position): Location[] {
            const mode = languageModes.getModeAtPosition(doc, position);
            if (mode && mode.findReferences) {
                return mode.findReferences(doc, position);
            }
            return [];
        },
        findDocumentLinks(doc: TextDocument, documentContext: DocumentContext): DocumentLink[] {
            const links: DocumentLink[] = [];
            languageModes.getAllModesInDocument(doc).forEach(m => {
                if (m.findDocumentLinks) {
                    pushAll(links, m.findDocumentLinks(doc, documentContext));
                }
            });
            return links;
        },
        findDocumentSymbols(doc: TextDocument): SymbolInformation[] {
            const symbols: SymbolInformation[] = [];
            languageModes.getAllModesInDocument(doc).forEach(m => {
                if (m.findDocumentSymbols) {
                    pushAll(symbols, m.findDocumentSymbols(doc));
                }
            });
            return symbols;
        },
        findDocumentColors(doc: TextDocument): ColorInformation[] {
            const colors: ColorInformation[] = [];
            languageModes.getAllModesInDocument(doc).forEach(m => {
                if (m.findDocumentColors) {
                    pushAll(colors, m.findDocumentColors(doc));
                }
            });
            return colors;
        },
        getColorPresentations(doc: TextDocument, color: Color, range: Range): ColorPresentation[] {
            const mode = languageModes.getModeAtPosition(doc, range.start);
            if (mode && mode.getColorPresentations) {
                return mode.getColorPresentations(doc, color, range);
            }
            return [];
        },
        doSignatureHelp(doc: TextDocument, position: Position): SignatureHelp {
            const mode = languageModes.getModeAtPosition(doc, position);
            if (mode && mode.doSignatureHelp) {
                return mode.doSignatureHelp(doc, position);
            }
            return NULL_SIGNATURE;
        },
        removeDocument(doc: TextDocument) {
            languageModes.onDocumentRemoved(doc);
        },
        dispose() {
            languageModes.dispose();
        }
    };
}

function pushAll<T>(to: T[], from: T[]) {
    if (from) {
        for (let i = 0; i < from.length; i++) {
            to.push(from[i]);
        }
    }
}