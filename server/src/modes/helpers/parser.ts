import * as ts from "typescript";

import { createDocumentRegions, EmbeddedRegion } from '../../embeddedSupport';
import { AmisConfigSettings, defaultSettings } from "../../AmisConfigSettings";

interface PropertyInfo {
    range: ts.TextRange,
    key: {
        range: ts.TextRange,
        value: string
    },
    value: {
        range: ts.TextRange,
        value: string
    },
}
export interface JSONMetaInfo {
    properties: PropertyInfo[]
}

export function parseAmisJSON(content: string, config: AmisConfigSettings) {

    const regions: EmbeddedRegion<'json', JSONMetaInfo>[] = [];
    const validSchemas = config?.schema?.map?.map(item => item.label);
    const sourceFile = ts.createSourceFile('test.ts', content, ts.ScriptTarget.ES5);

    function makeLeadingBlankSpace(node: ts.ReadonlyTextRange) {
        const leadingContent = content.slice(0, node.pos);
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

    function getSourceInRange(node: ts.Node) {
        return makeLeadingBlankSpace(node) + content.slice(node.pos, node.end);
    }

    function getTextNodeWithoutQuote(node: ts.StringLiteralLike) {
        const value = node.getText(sourceFile);
        return {
            range: { pos: node.pos + 1, end: node.end - 1 },
            value: value.slice(1, -1),
        };
    }

    function getPropties(node: ts.Node): PropertyInfo[] {
        const properties: PropertyInfo[] = []
        ts.transform(node, [function (context) {
            return function (node: ts.Node): ts.Node {
                function visit(node: ts.Node): ts.Node {
                    if (ts.isPropertyAssignment(node)) {
                        // console.log('isPropertyAssignment', node.getText(sourceFile));

                        if (node.initializer) {
                            const value = node.initializer.getText(sourceFile);
                            if (ts.isStringLiteralLike(node.initializer) && value[0] !== '\"') {
                                // console.log('property start:', node.pos, node.name.pos);

                                properties.push({
                                    range: { pos: node.pos, end: node.end },
                                    key: {
                                        range: { pos: node.name.pos, end: node.name.end },
                                        value: node.name.getText(sourceFile),
                                    },
                                    value: getTextNodeWithoutQuote(node.initializer)
                                })
                            }
                        }
                    }
                    return node;
                }
                return ts.visitEachChild(node, visit, context);
            };
        }])
        return properties;
    }

    function addCodeToRegion(node: ts.Node, schema: string) {
        const regionConfig = (config?.schema?.map?.filter(item => item.label == schema) || [])[0];

        regions.push({
            start: node.pos,
            end: node.end,
            languageId: 'amisjson',
            type: 'json',
            text: getSourceInRange(node),
            schema,
            schemaUri: regionConfig.schema,
            meta: {
                properties: getPropties(node)
            }
        });
    }
    /**
     * 输出ast树状信息
     */
    function nodeTypeReader<T extends ts.Node>(context: ts.TransformationContext) {
        return function (rootNode: T) {

            function createFindObjectLiteralExpression(schema: string) {
                const ret = function (node: ts.Node): ts.VisitResult<ts.Node> {
                    if (ts.isObjectLiteralExpression(node)) {
                        addCodeToRegion(node, schema);
                        return;
                    };
                    try {
                        return ts.visitEachChild(node, ret, context);
                    } catch (e) {
                        console.log('error code ::', node.getText(sourceFile));
                    }
                }
                return ret
            }

            function visit(node: ts.Node): ts.VisitResult<ts.Node> {
                if ((node as any).jsDoc) {
                    let schema = '';
                    if (
                        (node as any).jsDoc.some((item: any) => {
                            if (item.comment) {
                                const comment = item.comment.trim();
                                if (validSchemas.indexOf(comment) !== -1) {
                                    schema = comment;
                                    return true;
                                }
                            }
                        })
                    ) {
                        if (ts.isObjectLiteralElementLike(node)) {
                            if (ts.isPropertyAssignment(node)) {
                                if (ts.isObjectLiteralExpression(node.initializer)) {
                                    addCodeToRegion((node as ts.PropertyAssignment).initializer, schema);
                                    return;
                                }
                            }
                        } else if (ts.isExportAssignment(node)) {
                            if (ts.isObjectLiteralExpression(node.expression)) {
                                addCodeToRegion(node.expression, schema);
                                return;
                            }

                        } else if (node.kind == ts.SyntaxKind.FirstStatement) {
                            const declarationList = (node as any).declarationList;

                            if (declarationList && ts.isVariableDeclarationList(declarationList)) {
                                const declaration = declarationList.declarations[0];
                                if (declaration && declaration.initializer && ts.isObjectLiteralExpression(declaration.initializer)) {
                                    addCodeToRegion(declaration.initializer, schema);
                                    return;
                                }
                            }

                        } else if (ts.isExpressionStatement(node)) {
                            const expression = node.expression;
                            if (ts.isBinaryExpression(expression)) {
                                if (ts.isObjectLiteralExpression(expression.right)) {
                                    addCodeToRegion(expression.right, schema);
                                    return;
                                }
                            }
                        }

                        const visitor = createFindObjectLiteralExpression(schema);
                        console.log("other Visiting " + ts.SyntaxKind[node.kind]);
                        return ts.visitEachChild(node, visitor, context);
                    }
                }
                return ts.visitEachChild(node, visit, context);
            }
            return ts.visitNode(rootNode, visit);
        }
    }

    ts.transform<ts.Statement>([...sourceFile.statements], [nodeTypeReader]);

    return regions;
}


export const getDocumentRegions = createDocumentRegions(
    (document, options) => parseAmisJSON(document.getText(), options),
    undefined,
    undefined,
    defaultSettings);
