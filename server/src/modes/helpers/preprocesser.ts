/**
 * 修改源码插入 $schema
 */
import {
    TextDocument,
    Position,
    LanguageService,
} from 'vscode-json-languageservice';

import {
    JSONDocument,
    ASTNode,
    PropertyASTNode,
    ObjectASTNode,
    StringASTNode
} from 'vscode-json-languageservice';
import { DocumentRegions, EmbeddedRegion } from '../../embeddedSupport';
import { LanguageModelCache } from '../../languageModelCache';
import {
    shadowJSONSchemaKey,
    getSchemaValueByType
} from './bridge';
import { JSONMetaInfo } from './parser';


export function hasSchemaNode(document: JSONDocument) {
    if (document.root && document.root.type == 'object') {
        const properties = document.root.properties;
        for (let i = 0; i < properties.length; i++) {
            const element = properties[i];
            if (element.keyNode.value == '$schema') {
                return true;
            }
        }
    }
    return false;
}

export function insertSchema(document: JSONDocument,
    schemaType: string,
    schemUrl?: string) {
    if (!hasSchemaNode(document) && document.root && document.root.type == 'object') {
        const schemaNode = getSchemaNode(document.root.offset,
            0,
            document.root,
            schemaType,
            schemUrl);
        document.root.properties.unshift(schemaNode);
    }
}

export function getSchemaNode(offset: number,
    colonOffset: number,
    parent: ObjectASTNode,
    schemaType: string,
    schemUrl?: string,
): PropertyASTNode {
    const key: StringASTNode = {
        type: 'string',
        offset,
        length: 0,
        value: shadowJSONSchemaKey,
    };
    const value: StringASTNode = {
        type: 'string',
        offset,
        length: 0,
        value: schemUrl || getSchemaValueByType(schemaType),
    };
    const property: PropertyASTNode = {
        type: 'property',
        parent,
        offset,
        length: 1,
        keyNode: key,
        valueNode: value,
        colonOffset,
        children: [],
    };
    (key as any).parent = property;
    (value as any).parent = property;
    return property;
}


interface syntaxError {
    range: {}[];
    message: string;
    severity: number;
    code: number;
    source: string;
}

interface JSONDocumentOrigin extends JSONDocument {
    syntaxErrors?: syntaxError[];
    visit?(visitor: (node: ASTNode) => boolean): void;
}

export function patchJsonAst(jsonDocument: JSONDocumentOrigin, embeddedRegion: EmbeddedRegion<'json', JSONMetaInfo>) {

    jsonDocument.visit!(function (node) {
        // 在这里修正一下json的ast
        switch (node.type) {
            case 'property':
                if (!node.valueNode) {
                    // 修正json
                    const propertyInfo = embeddedRegion.meta!.properties
                        .filter(property => (property.range.pos <= node.offset) && property.range.end >= (node.offset + node.length)).slice(-1)[0];

                    if (propertyInfo) {
                        (node as any).valueNode = {
                            type: 'string',
                            offset: propertyInfo.value.range.pos,
                            length: propertyInfo.value.range.end - propertyInfo.value.range.pos,
                            value: propertyInfo.value.value,
                            parent: node
                        } as StringASTNode;
                    }
                }
                break;
        }
        return true;
    });

    return new Proxy(jsonDocument, {
        get(target, property) {
            if (property == 'syntaxErrors') {
                return (((target as any)[property] || []) as syntaxError[]).filter(node => [0, 519,].indexOf(node.code) != -1)
            }
        }
    });
}

export function prepareDocuments(
    document: TextDocument,
    position: Position,
    documentRegions: LanguageModelCache<DocumentRegions<'json', JSONMetaInfo>>,
    ls: LanguageService
): [TextDocument, JSONDocument] {
    const region = documentRegions.get(document).getRegionAtPosition(position);
    const textdocument = documentRegions.get(document).getSubDocumentAtPosition(position);
    const jsonDocument = ls.parseJSONDocument(textdocument);
    insertSchema(jsonDocument, region.schema!, region.schemaUri);
    patchJsonAst(jsonDocument, region);

    return [textdocument, jsonDocument];
}
