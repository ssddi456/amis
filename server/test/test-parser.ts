import 'mocha';
import 'ts-node';
import { assert } from "chai";
import { Position, TextDocument } from 'vscode-languageserver-textdocument';
import { getLs } from '../src/modes/amisJson';
import { insertSchema } from '../src/modes/helpers/preprocesser';
import { ASTNode } from 'vscode-json-languageservice';

describe('get amisjson hover at point', function () {

    function getNodeSource(node: ASTNode, source: string) {
        return source.slice(node.offset, node.offset + node.length);
    }

    async function testParseDocument(code: string, schema: string) {
        const sourceFile = TextDocument.create('test://test/testParseDocument.ts', 'typescript', 0, code);
        const ls = getLs();
        const jsonDocument = ls.parseJSONDocument(sourceFile);
        insertSchema(jsonDocument, schema);
        const ret = await ls.getMatchingSchemas(sourceFile, jsonDocument);
        const FormControlSchema = ret[ret.length - 1].schema.definitions!.FormControlSchema;
    }

    //     it('parse a json with schema', function () {
    //         testParseDocument(`{
    //     "$schema": "https://test/test.ts",
    //     "type":"head"
    // }`);
    //     });
    it('parse a json without schema', function () {
        testParseDocument(`{
            type: "page",
            "body": [
                {
                    "type": "form",
                    "controls": [{
                        type: "text"
                    }]
                }
            ]
        }`, 'amis');
    });

    it('parse a json without schema', function () {
        testParseDocument(`{
            type: "email",
        }`, 'amis-formitem');
    });
});
