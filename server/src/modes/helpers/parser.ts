import * as ts from "typescript";

import { createDocumentRegions, EmbeddedRegion } from '../../embeddedSupport';

export function parseAmisJSON(content: string) {

	const regions: EmbeddedRegion<'json'>[] = [];

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

	function getSourceInRange(node: ts.ReadonlyTextRange) {
		return makeLeadingBlankSpace(node) + content.slice(node.pos, node.end);
	}

	function addCodeToRegion(node: ts.ReadonlyTextRange) {
		regions.push({
			start: node.pos,
			end: node.end,
			languageId: 'amisjson',
			type: 'json',
			text: getSourceInRange(node)
		});
	}
	/**
	 * 输出ast树状信息
	 */
	function nodeTypeReader<T extends ts.Node>(context: ts.TransformationContext) {
		return function (rootNode: T) {
			function visit(node: ts.Node): ts.VisitResult<ts.Node> {
				if ((node as any).jsDoc) {
					if (
						(node as any).jsDoc.some((item: any) => item.comment && item.comment.trim() == 'amis')
					) {
						if (ts.isObjectLiteralElementLike(node)) {
							if (ts.isPropertyAssignment(node)) {
								if (ts.isObjectLiteralExpression(node.initializer)) {
									addCodeToRegion((node as ts.PropertyAssignment).initializer);
								}
							}
						} else if (ts.isExportAssignment(node)) {
							if (ts.isObjectLiteralExpression(node.expression)) {
								addCodeToRegion(node.expression);
							}

						} else if (node.kind == ts.SyntaxKind.FirstStatement) {
							const declarationList = (node as any).declarationList;

							if (declarationList && ts.isVariableDeclarationList(declarationList)) {
								const declaration = declarationList.declarations[0];
								if (declaration && declaration.initializer && ts.isObjectLiteralExpression(declaration.initializer)) {
									addCodeToRegion(declaration.initializer);
								}
							}

						} else if (ts.isExpressionStatement(node)) {
							const expression = node.expression;
							if (ts.isBinaryExpression(expression)) {
								if (ts.isObjectLiteralExpression(expression.right)) {
									addCodeToRegion(expression.right);
								}
							}
						} else {
							console.log("other Visiting " + ts.SyntaxKind[node.kind]);
						}
					}
				}
				return ts.visitEachChild(node, visit, context);
			}
			return ts.visitNode(rootNode, visit);
		}
	}
	const sourceFile = ts.createSourceFile('test.ts', content, ts.ScriptTarget.ES5);

	ts.transform<ts.Statement>([...sourceFile.statements], [nodeTypeReader]);

	return regions;
}


export const getDocumentRegions = createDocumentRegions(
	(document) => parseAmisJSON(document.getText()),
	undefined,
	'san');
