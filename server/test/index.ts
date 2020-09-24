import 'mocha';
import 'ts-node';
import { assert } from "chai";

import { getLanguageService, LanguageService, JSONSchema, ClientCapabilities } from 'vscode-json-languageservice';

import { CompletionItemKind, CompletionList, MarkupContent, Position, TextEdit } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';

import * as ts from 'typescript';
import { logCodeAst } from '../src/utils/logger';
import { getDocumentRegions, parseAmisJSON } from '../src/modes/helpers/parser';
import { EmbeddedRegion } from '../src/embeddedSupport';

interface ItemDescription {
    label: string;
    detail?: string;
    documentation?: string | MarkupContent;
    kind?: CompletionItemKind;
    resultText?: string;
    notAvailable?: boolean;
    sortText?: string;
}



const assertCompletion = function (completions: CompletionList, expected: ItemDescription, document: TextDocument, offset: number) {
    const matches = completions.items.filter(completion => {
        return completion.label === expected.label;
    });
    if (expected.notAvailable) {
        assert.equal(matches.length, 0, expected.label + " should not existing is results");
        return;
    }
    assert.equal(matches.length, 1, expected.label + " should only existing once: Actual: " + completions.items.map(c => c.label).join(', '));
    const match = matches[0];
    if (expected.detail !== undefined) {
        assert.equal(match.detail, expected.detail);
    }
    if (expected.documentation !== undefined) {
        assert.deepEqual(match.documentation, expected.documentation);
    }
    if (expected.kind !== undefined) {
        assert.equal(match.kind, expected.kind);
    }
    if (expected.resultText !== undefined && match.textEdit !== undefined) {
        const edit = TextEdit.is(match.textEdit)
            ? match.textEdit
            : TextEdit.replace((match.textEdit as any).replace, (match.textEdit as any).newText);
        assert.equal(TextDocument.applyEdits(document, [edit]), expected.resultText);
    }
    if (expected.sortText !== undefined) {
        assert.equal(match.sortText, expected.sortText);
    }
};

const testCompletionsFor = function (
    value: string,
    schema: JSONSchema | null,
    expected: {
        count?: number,
        items?: ItemDescription[]
    },
    clientCapabilities = ClientCapabilities.LATEST
): PromiseLike<void> {
    const offset = value.indexOf('|');
    value = value.substr(0, offset) + value.substr(offset + 1);

    const ls = getLanguageService({ clientCapabilities }) as LanguageService;
    if (schema) {
        ls.configure({
            schemas: [{
                uri: 'http://myschemastore/test1',
                schema,
                fileMatch: ["*.json"]
            }]
        });
    }

    const document = TextDocument.create('test://test/test.json', 'json', 0, value);
    const position = Position.create(0, offset);
    const jsonDoc = ls.parseJSONDocument(document);
    return ls.doComplete(document, position, jsonDoc).then(list => {
        if (expected.count) {
            assert.equal(list!.items.length, expected.count, value + ' ' + list!.items.map(i => i.label).join(', '));
        }
        if (expected.items) {
            for (const item of expected.items) {
                assertCompletion(list! as any, item, document, offset);
            }
        }
    });
};
describe('test json ls hover', function () {
    it(' simple ', async function () {
        await testCompletionsFor('[ { "name": "John", "age": 44 }, { | }', null, {
            count: 2,
            items: [
                { label: 'name', resultText: '[ { "name": "John", "age": 44 }, { "name" }' },
                { label: 'age', resultText: '[ { "name": "John", "age": 44 }, { "age" }' }
            ]
        });

    });

    it('on json with synctax errors', async function () {
        await testCompletionsFor(`[ { "name": "John", "age": 44, body: () => { return 1;} }, { | }`, null, {
            count: 3,
            items: [
                { label: 'name', resultText: `[ { "name": "John", "age": 44, body: () => { return 1;} }, { "name" }` },
                { label: 'age', resultText: `[ { "name": "John", "age": 44, body: () => { return 1;} }, { "age" }` },
                { label: 'body', resultText: `[ { "name": "John", "age": 44, body: () => { return 1;} }, { "body" }` }
            ]
        });
    });
});

describe('parse text regions', function () {

    function testParseRegions(code: string, expected: EmbeddedRegion[]) {
        const sourceFile = ts.createSourceFile('test.ts', code, ts.ScriptTarget.ESNext);
        const regions = parseAmisJSON(sourceFile.text);
        assert.deepEqual(regions, expected, 'regions should equal');
    }

    it('props in toplevel declaration', async function () {
        testParseRegions(`
/** amis */	
const obj = {
    type: "page"
};`,
            [
                {
                    start: 25,
                    end: 46,
                    type: 'json',
                    languageId: 'amisjson',
                    text: `
            
            {
    type: "page"
}`}
            ]);
    });
    it('props on exports', async function () {
        testParseRegions(`
/** amis */
export default {
    type: "page",
    body: "default exports"
}
/** amis */
export const schema = {
    type: "page",
    body: "named exports"
}`,
            [
                {
                    start: 27,
                    end: 77,
                    type: 'json',
                    languageId: 'amisjson',
                    text: `
           
               {
    type: "page",
    body: "default exports"
}`},
                {
                    start: 111,
                    end: 159,
                    type: 'json',
                    languageId: 'amisjson',
                    text: `
           
                
                 
                           
 
           
                      {
    type: "page",
    body: "named exports"
}`}
            ]);
    });
    it('props in function', async function () {
        testParseRegions(`
function test() {
    /** amis */
    var obj6 = {
        type: "page",
        body: "declaration"
    };

    /** amis */
    obj6 = {
        type: "page",
        body: "new value"
    };
}`,
            [
                {
                    start: 49,
                    end: 107,
                    type: 'json',
                    languageId: 'amisjson',
                    text: `
                 
               
               {
        type: "page",
        body: "declaration"
    }`},
                {
                    start: 136,
                    end: 192,
                    type: 'json',
                    languageId: 'amisjson',
                    text: `
                 
               
                
                     
                           
      

               
           {
        type: "page",
        body: "new value"
    }`}
            ]);
    });
});


describe('get amisjson at certen point', function () {


    function testGetDocumentAtPoint(code: string, position: Position, languageId: string) {
        const sourceFile = TextDocument.create('test://test/test.ts', 'typescript', 0, code);
        const documentRegion = getDocumentRegions(sourceFile);
        assert.equal(documentRegion.getLanguageAtPosition(position), languageId, 'languageId should equal');
    }
    it('get amisjson at object literal', function () {
        testGetDocumentAtPoint(`
function test() {
    /** amis */
    var obj6 = {
        type: "page",
        body: "declaration"
    };

    /** amis */
    obj6 = {
        type: "page",
        body: "new value"
    };
}`, { line: 4, character: 11 }, 'amisjson');
    })
});


describe('get amisjson hover at point', function () {


    function testGetDocumentAtPoint(code: string, position: Position, languageId: string) {
        const sourceFile = TextDocument.create('test://test/test.ts', 'typescript', 0, code);
        const documentRegion = getDocumentRegions(sourceFile);
        assert.equal(documentRegion.getLanguageAtPosition(position), languageId, 'languageId should equal');
    }
    it('get amisjson at object literal', function () {
        testGetDocumentAtPoint(`
function test() {
    /** amis */
    var obj6 = {
        type: "page",
        body: "declaration"
    };

    /** amis */
    obj6 = {
        type: "page",
        body: "new value"
    };
}`, { line: 4, character: 11 }, 'amisjson');
    })
});

