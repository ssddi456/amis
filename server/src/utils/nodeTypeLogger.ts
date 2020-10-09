import ts = require('typescript');

/**
 * 输出ast树状信息
 */

export function nodeTypeLogger<T extends ts.Node>(context: ts.TransformationContext) {
    return function (rootNode: T) {
        function visit(node: ts.Node): ts.Node {

            if (node.kind == ts.SyntaxKind.Identifier) {
                console.log("Visiting " + ts.SyntaxKind[node.kind], (node as ts.Identifier).escapedText);
            } else {
                console.log("Visiting " + ts.SyntaxKind[node.kind]);
            }
            if ((node as any).jsDoc) {
                console.log('-- jsDoc');
                (node as any).jsDoc.forEach((item: any) => console.log(item));
            }

            return ts.visitEachChild(node, visit, context);
        }
        return ts.visitNode(rootNode, visit);
    };
}
export function logCodeAst(code: string) {
    console.log('---------');
    const instanceDataInsertor = ts.createSourceFile('test.ts', code, ts.ScriptTarget.ES5);
    ts.transform<ts.Statement>([...instanceDataInsertor.statements], [nodeTypeLogger]);
}
