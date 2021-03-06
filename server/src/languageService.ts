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
    Range, DocumentSymbol
} from 'vscode-languageserver-types';

import {
    Color, ColorInformation, ColorPresentation
} from 'vscode-languageserver-protocol';

import { getLanguageModes, LanguageModes } from './languageModes';
import { NULL_HOVER, NULL_COMPLETION, NULL_SIGNATURE } from './modes/nullMode';

import { logger } from './utils/logger';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { CodeAction, Command, Connection, HandlerResult } from 'vscode-languageserver';

export interface DocumentContext {
    resolveReference(ref: string, base?: string): string;
}

interface ValidationOptions {
    script: boolean;
}
enum ShadowLSCommands {
    reloadAll = 'amis.reloadAll'
}
const ShadowLsCommandKeys = Object.keys(ShadowLSCommands)

const commands: ShadowLSCommands[] = ShadowLsCommandKeys.map(k => (ShadowLSCommands as any)[k]).map(v => v as ShadowLSCommands)

export function getShadowLS() {
    let languageModes: LanguageModes;
    const validation: { [k: string]: boolean } = {
        javascript: true
    };

    // for reload
    let lastWorkspacePath: string | null | undefined;
    let lastConfig: any;

    return {
        initialize(workspacePath: string | null | undefined) {
            lastWorkspacePath = workspacePath;
            languageModes = getLanguageModes(workspacePath);
        },
        getAllCommands(): string[] {
            return ([] as string[]).concat(
                commands,
                ...(languageModes?.getAllModes().map(mode => mode.getCommands ? mode.getCommands() : []) || [])
            );
        },
        configure(config: any) {
            lastConfig = config;
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
        doComplete(doc: TextDocument, position: Position): HandlerResult<CompletionList | null, any> {
            const mode = languageModes.getModeAtPosition(doc, position);
            if (mode) {
                if (mode.doComplete) {
                    return mode.doComplete(doc, position);
                }
            }
            return NULL_COMPLETION;
        },
        doResolve(doc: TextDocument, languageId: string, item: CompletionItem): HandlerResult<CompletionItem | null, any> {
            const mode = languageModes.getMode(languageId);
            if (mode && mode.doResolve && doc) {
                return mode.doResolve(doc, item);
            }
            return item;
        },
        doHover(doc: TextDocument, position: Position): HandlerResult<Hover | null, any> {
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
        doCodeAction(doc: TextDocument, range: Range): HandlerResult<Array<Command | CodeAction>, any> {
            const mode = languageModes.getModeAtPosition(doc, range.start);
            console.log('may do code action?', !!mode, !!(mode?.doCodeAction));

            if (mode && mode.doCodeAction) {
                try {
                    return mode.doCodeAction(doc, range);
                } catch (error) {
                    logger.log(() => [error]);
                }
            }
            return []
        },
        doExecuteCommand(command: string, args: any[], connect: Connection) {
            switch (command) {
                case ShadowLSCommands.reloadAll: {

                    // 理论上用最近的config刷一下就重载了

                    languageModes.getAllModes().forEach(m => {
                        if (m.configure) {
                            m.configure(lastConfig);
                        }
                    });
                }

                default:
                    break;
            }

            languageModes.getAllModes().forEach(m => {
                if (m.getCommands && m.getCommands().indexOf(command) != -1) {
                    m.executeCommand!(command, args, connect);
                }
            });
        },
        findDocumentHighlight(doc: TextDocument, position: Position): HandlerResult<DocumentHighlight[] | null, any> {
            const mode = languageModes.getModeAtPosition(doc, position);
            if (mode && mode.findDocumentHighlight) {
                return mode.findDocumentHighlight(doc, position);
            }
            return [];
        },
        findDefinition(doc: TextDocument, position: Position): HandlerResult<Definition | null, any> {
            logger.log(() => ['do findDefinition', doc.uri]);

            const mode = languageModes.getModeAtPosition(doc, position);
            if (mode && mode.findDefinition) {
                return mode.findDefinition(doc, position);
            }
            return [];
        },
        findReferences(doc: TextDocument, position: Position): HandlerResult<Location[] | null, any> {
            const mode = languageModes.getModeAtPosition(doc, position);
            if (mode && mode.findReferences) {
                return mode.findReferences(doc, position);
            }
            return [];
        },
        async findDocumentLinks(doc: TextDocument, documentContext: DocumentContext): Promise<DocumentLink[]> {
            const links: DocumentLink[] = [];
            const modes = languageModes.getAllModesInDocument(doc);
            for (let index = 0; index < modes.length; index++) {
                const m = modes[index];
                if (m.findDocumentLinks) {
                    pushAll(links, (await m.findDocumentLinks(doc, documentContext) as DocumentLink[]) || []);
                }
            }
            return links;
        },
        async findDocumentSymbols(doc: TextDocument): Promise<SymbolInformation[]> {
            const symbols: SymbolInformation[] = [];
            const modes = languageModes.getAllModesInDocument(doc);
            for (let index = 0; index < modes.length; index++) {
                const m = modes[index];
                if (m.findDocumentSymbols) {
                    pushAll(symbols, (await m.findDocumentSymbols(doc) as SymbolInformation[]) || []);
                }
            }
            return symbols;
        },
        async findDocumentColors(doc: TextDocument): Promise<ColorInformation[]> {
            const colors: ColorInformation[] = [];
            const modes = languageModes.getAllModesInDocument(doc);
            for (let index = 0; index < modes.length; index++) {
                const m = modes[index];
                if (m.findDocumentColors) {
                    pushAll(colors, (await m.findDocumentColors(doc) as ColorInformation[]) || []);
                }
            }
            return colors;
        },
        getColorPresentations(doc: TextDocument, color: Color, range: Range): HandlerResult<ColorPresentation[] | null, any> {
            const mode = languageModes.getModeAtPosition(doc, range.start);
            if (mode && mode.getColorPresentations) {
                return mode.getColorPresentations(doc, color, range);
            }
            return [];
        },
        doSignatureHelp(doc: TextDocument, position: Position): HandlerResult<SignatureHelp | null, any> {
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