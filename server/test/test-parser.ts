import 'mocha';
import 'ts-node';
import { assert } from "chai";
import { Position, TextDocument } from 'vscode-languageserver-textdocument';
import { getLs } from '../src/modes/amisJson';
import { insertSchema } from '../src/modes/helpers/preprocesser';


describe('get amisjson hover at point', function () {
    async function testParseDocument(code: string) {
        const sourceFile = TextDocument.create('test://test/testParseDocument.ts', 'typescript', 0, code);
        const ls = getLs();
        const jsonDocument = ls.parseJSONDocument(sourceFile);        
        const ret = await ls.getMatchingSchemas(sourceFile, jsonDocument);
    }

    it('parse a json with schema', function () {
        testParseDocument(`{
    "$schema": "https://test/test.ts",
    "type":"head"
}`);
    });
    it('parse a json without schema', function () {
        testParseDocument(`{
    "type":"head"
}`)
    });

    
});