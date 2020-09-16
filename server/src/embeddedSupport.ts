import { Range, TextDocument } from 'vscode-languageserver-textdocument';
import { logger } from './utils/logger';
import { Position } from 'vscode-languageserver';


export interface LanguageRange extends Range {
    languageId: string;
    attributeValue?: boolean;
}

export interface DocumentRegions {
    getEmbeddedDocument(languageId: string): TextDocument;
    getEmbeddedDocumentByType(type: EmbeddedType): TextDocument;
    getLanguageRangeByType(type: EmbeddedType): LanguageRange | undefined;
    getLanguageRanges(range: Range): LanguageRange[];
    getLanguageAtPosition(position: Position): string;
    getLanguagesInDocument(): string[];
    getImportedScripts(): string[];
}

type EmbeddedType = 'template' | 'script' | 'style' | 'custom';

interface EmbeddedRegion {
    languageId: string;
    start: number;
    end: number;
    type: EmbeddedType;
}

const defaultType: { [type: string]: string } = {
    template: 'san-html',
    script: 'javascript',
    style: 'css'
};

export function getDocumentRegions(document: TextDocument): DocumentRegions {
    const regions: EmbeddedRegion[] = [];
    const text = document.getText();
    let lastTagName = '';
    let lastAttributeName = '';
    let languageIdFromType = '';
    const importedScripts: string[] = [];


    return {
        getLanguageRanges: (range: Range) => getLanguageRanges(document, regions, range),
        getLanguageRangeByType: (type: EmbeddedType) => getLanguageRangeByType(document, regions, type),
        getEmbeddedDocument: (languageId: string) => getEmbeddedDocument(document, regions, languageId),
        getEmbeddedDocumentByType: (type: EmbeddedType) => getEmbeddedDocumentByType(document, regions, type),
        getLanguageAtPosition: (position: Position) => getLanguageAtPosition(document, regions, position),
        getLanguagesInDocument: () => getLanguagesInDocument(document, regions),
        getImportedScripts: () => importedScripts
    };
}



function getLanguageRanges(document: TextDocument, regions: EmbeddedRegion[], range: Range): LanguageRange[] {
    const result: LanguageRange[] = [];
    let currentPos = range ? range.start : Position.create(0, 0);
    let currentOffset = range ? document.offsetAt(range.start) : 0;
    const endOffset = range ? document.offsetAt(range.end) : document.getText().length;
    for (const region of regions) {
        if (region.end > currentOffset && region.start < endOffset) {
            const start = Math.max(region.start, currentOffset);
            const startPos = document.positionAt(start);
            if (currentOffset < region.start) {
                result.push({
                    start: currentPos,
                    end: startPos,
                    languageId: 'san'
                });
            }
            const end = Math.min(region.end, endOffset);
            const endPos = document.positionAt(end);
            if (end > region.start) {
                result.push({
                    start: startPos,
                    end: endPos,
                    languageId: region.languageId
                });
            }
            currentOffset = end;
            currentPos = endPos;
        }
    }
    if (currentOffset < endOffset) {
        const endPos = range ? range.end : document.positionAt(endOffset);
        result.push({
            start: currentPos,
            end: endPos,
            languageId: 'san'
        });
    }
    return result;
}

function getLanguagesInDocument(document: TextDocument, regions: EmbeddedRegion[]): string[] {
    const result = ['san'];
    for (const region of regions) {
        if (region.languageId && result.indexOf(region.languageId) === -1) {
            result.push(region.languageId);
        }
    }
    return result;
}

function getLanguageAtPosition(document: TextDocument, regions: EmbeddedRegion[], position: Position): string {
    const offset = document.offsetAt(position);

    logger.log(() => ['getLanguageAtPosition', position, offset]);

    for (const region of regions) {
        if (region.start <= offset) {
            if (offset <= region.end) {
                return region.languageId;
            }
        } else {
            break;
        }
    }
    return 'san';
}

function getEmbeddedDocument(document: TextDocument, contents: EmbeddedRegion[], languageId: string): TextDocument {
    const oldContent = document.getText();
    let result = '';
    for (const c of contents) {
        if (c.languageId === languageId) {
            result = oldContent.substring(0, c.start).replace(/./g, ' ');
            result += oldContent.substring(c.start, c.end);
            break;
        }
    }
    return TextDocument.create(document.uri, languageId, document.version, result);
}

function getEmbeddedDocumentByType(
    document: TextDocument,
    contents: EmbeddedRegion[],
    type: EmbeddedType
): TextDocument {
    const oldContent = document.getText();
    let result = '';
    for (const c of contents) {
        if (c.type === type) {
            result = oldContent.substring(0, c.start).replace(/./g, ' ');
            result += oldContent.substring(c.start, c.end);
            return TextDocument.create(document.uri, c.languageId, document.version, result);
        }
    }
    return TextDocument.create(document.uri, defaultType[type], document.version, result);
}

function getLanguageRangeByType(
    document: TextDocument,
    contents: EmbeddedRegion[],
    type: EmbeddedType
): LanguageRange | undefined {
    for (const c of contents) {
        if (c.type === type) {
            return {
                start: document.positionAt(c.start),
                end: document.positionAt(c.end),
                languageId: c.languageId
            };
        }
    }
    return undefined;
}