import { Range, TextDocument } from 'vscode-languageserver-textdocument';
import { logger } from './utils/logger';
import { Position } from 'vscode-languageserver';
import { URI } from 'vscode-uri';
import * as path from 'path';

export interface LanguageRange extends Range {
    languageId: string;
    attributeValue?: boolean;
}

export interface DocumentRegions<T = EmbeddedType> {
    getEmbeddedDocument(languageId: string): TextDocument;
    getEmbeddedDocumentByType(type: T): TextDocument;
    getLanguageRangeByType(type: T): LanguageRange | undefined;
    getLanguageRanges(range: Range): LanguageRange[];
    getRegionAtPosition(positon: Position): EmbeddedRegion;
    getLanguageAtPosition(position: Position): string;
    getSubDocumentAtPosition(position: Position): TextDocument;
    getLanguagesInDocument(): string[];
    getImportedScripts(): string[];
}

type EmbeddedType = 'template' | 'script' | 'style' | 'custom';

export interface EmbeddedRegion<T = any> {
    languageId: string;
    start: number;
    end: number;
    type: T;
    text?: string;
    schema?: string;
}

const defaultType: { [type: string]: string } = {
    template: 'san-html',
    script: 'javascript',
    style: 'css'
};

/** a example */
export function createDocumentRegions(
    parser: (document: TextDocument) => EmbeddedRegion[],
    defaultTypeMap: { [type: string]: string } = defaultType,
    defaultLanguageId: string = '',
): (document: TextDocument) => DocumentRegions {

    return function getDocumentRegions(document: TextDocument): DocumentRegions {
        const regions: EmbeddedRegion[] = parser(document);
        const importedScripts: string[] = [];

        return {
            getLanguageRanges: (range: Range) => getLanguageRanges(document, regions, range),
            getLanguageRangeByType: (type: string) => getLanguageRangeByType(document, regions, type),
            getEmbeddedDocument: (languageId: string) => getEmbeddedDocument(document, regions, languageId),
            getEmbeddedDocumentByType: (type: string) => getEmbeddedDocumentByType(document, regions, type),
            getRegionAtPosition: (position: Position) => getRegionAtPosition(document, regions, position),
            getSubDocumentAtPosition: (position: Position) => getSubDocumentAtPosition(document, regions, position),
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
                        languageId: defaultLanguageId || document.languageId
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
                languageId: defaultLanguageId || document.languageId
            });
        }
        return result;
    }

    function getLanguagesInDocument(document: TextDocument, regions: EmbeddedRegion[]): string[] {
        const result = [defaultLanguageId || document.languageId];
        for (const region of regions) {
            if (region.languageId && result.indexOf(region.languageId) === -1) {
                result.push(region.languageId);
            }
        }
        return result;
    }

    function getRegionAtPosition(document: TextDocument, regions: EmbeddedRegion[], position: Position): EmbeddedRegion {
        const offset = document.offsetAt(position);

        logger.log(() => ['getRegionAtPosition', position, offset]);

        let lastRagionEnd = 0;
        for (const region of regions) {
            if (region.start <= offset) {
                if (offset <= region.end) {
                    return region;
                }
            } else {
                lastRagionEnd = region.end;
                break;
            }
        }
        return {
            languageId: defaultLanguageId || document.languageId,
            start: lastRagionEnd + 1,
            end: document.getText().length,
            type: defaultType,
        };
    }
    function getLanguageAtPosition(document: TextDocument, regions: EmbeddedRegion[], position: Position): string {
        return getRegionAtPosition(document, regions, position).languageId;
    }

    function makeLeadingBlankSpace(content: string, node: EmbeddedRegion) {
        const leadingContent = content.slice(0, node.start);
        let ret = [];
        for (let i = 0; i < leadingContent.length; i++) {
            const element = leadingContent[i];
            if (element != '\r' && element != '\n') {
                ret.push(' ');
            } else {
                ret.push(element);
            }
        }
        return ret.join('');
    }

    function getDocumentContentOfRegion(document: TextDocument, region: EmbeddedRegion) {
        if (region.text) {
            return region.text;
        }
        const content = document.getText();
        return makeLeadingBlankSpace(content, region) + content.substring(region.start, region.end);
    }


    function getSubDocumentAtPosition(document: TextDocument, regions: EmbeddedRegion[], position: Position): TextDocument {
        const region = getRegionAtPosition(document, regions, position);
        const index = regions.indexOf(region);
        if (index === -1) {
            return document;
        }
        const documentUrl = URI.file(document.uri);
        const ext = path.extname(documentUrl.fsPath);
        const newDocumentUrlPath = path.basename( documentUrl.fsPath, ext) + `.${region.languageId}_${index}` + ext;
        const newDocumentUrl = URI.file(newDocumentUrlPath);
        const result = getDocumentContentOfRegion(document, region);

        return TextDocument.create(newDocumentUrl.toString(), region.languageId, document.version, result);
    }

    function getEmbeddedDocument(document: TextDocument, contents: EmbeddedRegion[], languageId: string): TextDocument {
        let result = '';

        for (const c of contents) {
            if (c.languageId === languageId) {
                result = getDocumentContentOfRegion(document, c);
            }
        }
        return TextDocument.create(document.uri, languageId, document.version, result);
    }

    function getEmbeddedDocumentByType(
        document: TextDocument,
        contents: EmbeddedRegion[],
        type: string
    ): TextDocument {
        let result = '';
        for (const c of contents) {
            if (c.type === type) {
                result = getDocumentContentOfRegion(document, c);

                return TextDocument.create(document.uri, c.languageId, document.version, result);
            }
        }
        return TextDocument.create(document.uri, defaultTypeMap[type], document.version, result);
    }

    function getLanguageRangeByType(
        document: TextDocument,
        contents: EmbeddedRegion[],
        type: string
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
}


