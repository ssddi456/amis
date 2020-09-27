import * as fs from "fs";
import ts = require('typescript');
import * as util from "util";


Error.stackTraceLimit = 1000;
(Error.prototype as any).stackTraceLimit = 1000;

const DEBUG = true;

function getLogger() {
    const tempLogFile = 'D:/temp/test.log';
    const ret = {
        info(...args: any[]) {
            console.log(...args);
            if (DEBUG) {
                const now = new Date();
                const timeStr = `${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}`;
                fs.appendFileSync(tempLogFile,
                    `[-- ${timeStr}]
${args.map(x => typeof x == 'string' ? x : util.inspect(x)).join(' ')}
[${timeStr} --]
`);
            }
        },
        clear() {
            if (DEBUG) {
                fs.unlinkSync(tempLogFile);
            }
        },
        trace(...args: any[]) {
            if (DEBUG) {
                ret.info(`${args.map(x => typeof x == 'string' ? x : util.inspect(x)).join(' ')}
${new Error().stack!.split('\n').slice(2).join('\n')}`);
            }
        },
        setup() {
            if (DEBUG) {
                console.log = logger.info;
                console.error = logger.trace;
            }
        },
        log(info: () => any[] | any) {
            if (DEBUG) {
                let logInfo = info();
                if (!Array.isArray(logInfo)) {
                    logInfo = [logInfo];
                }
                this.info(...logInfo);
            }
        }
    };
    return ret;
}

// make a log file here
export const logger = getLogger();

/**
 * 输出ast树状信息
 */
export function nodeTypeLogger<T extends ts.Node>(context: ts.TransformationContext) {
    return function (rootNode: T) {
        function visit(node: ts.Node): ts.Node {

            if (node.kind == ts.SyntaxKind.Identifier) {
                console.log("Visiting " + ts.SyntaxKind[node.kind], (node as ts.Identifier).escapedText);
            } else {
                console.log("Visiting " + ts.SyntaxKind[node.kind])
            }
            if ((node as any).jsDoc) {
                console.log('-- jsDoc');
                (node as any).jsDoc.forEach( (item: any) => console.log(item))
            }

            return ts.visitEachChild(node, visit, context);
        }
        return ts.visitNode(rootNode, visit);
    }
}
export function logCodeAst(code: string) {
    console.log('---------');
    const instanceDataInsertor = ts.createSourceFile('test.ts', code, ts.ScriptTarget.ES5);
    ts.transform<ts.Statement>([...instanceDataInsertor.statements], [nodeTypeLogger]);
}
process.on('uncaughtException', function (e: Error) {
    logger.log(() => e);
});