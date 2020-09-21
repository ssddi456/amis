import * as ts from "typescript";




export function parseAmisJSON(content: string) {

	const regions: string[] = [];

	function getSourceInRange(node: ts.ReadonlyTextRange) {
		return content.slice(node.pos, node.end);
	}

	function addCodeToRegion(node: ts.ReadonlyTextRange) {
		regions.push(getSourceInRange(node));
	}
	/**
	 * 输出ast树状信息
	 */
	function nodeTypeReader<T extends ts.Node>(context: ts.TransformationContext) {
		return function (rootNode: T) {
			function visit(node: ts.Node): ts.VisitResult<ts.Node> {

				if ((node as any).jsDoc) {
					console.log("Visiting " + ts.SyntaxKind[node.kind]);

					if (
						(node as any).jsDoc.some((item: any) => item.comment && item.comment.trim() == 'amis')
					) {
						if (node.kind === ts.SyntaxKind.PropertyAssignment) {
							console.log("-- Visiting " + ts.SyntaxKind[(node as ts.PropertyAssignment).initializer.kind]);

							// if () {
							// 	addCodeToRegion((node as ts.PropertyAssignment).initializer);
							// }
						} else if (node.kind == ts.SyntaxKind.ExportAssignment) {
							if (ts.isObjectLiteralElementLike((node as ts.ExportAssignment).expression)) {
								addCodeToRegion((node as ts.ExportAssignment).expression);
							}
						} else if (node.kind == ts.SyntaxKind.FirstStatement) {
							if ((node as any).declarationList) {
								const firstDeclaration: ts.VariableDeclaration = (node as any).declarationList[0];
								if (firstDeclaration && firstDeclaration.initializer && ts.isObjectLiteralElementLike(firstDeclaration.initializer)) {
									addCodeToRegion(firstDeclaration.initializer);
								}
							}
						} else {
							console.log("Visiting " + ts.SyntaxKind[node.kind]);
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