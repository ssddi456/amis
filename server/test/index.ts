import 'mocha';
import 'ts-node';
import { assert } from "chai";

import { getLanguageService, LanguageService, JSONSchema, ClientCapabilities } from 'vscode-json-languageservice';

import { CompletionItemKind, CompletionList, Hover, MarkupContent, Position, TextEdit } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';

import * as ts from 'typescript';
import { getDocumentRegions, JSONMetaInfo, parseAmisJSON } from '../src/modes/helpers/parser';
import { EmbeddedRegion } from '../src/embeddedSupport';
import { getShadowLS } from '../src/languageService';
import { AmisConfigSettings, defaultSettings } from '../src/AmisConfigSettings';

const customSettings: AmisConfigSettings = {
    schema: {
        map: [...defaultSettings.schema.map, {
            label: 'kemis',
            schema: 'http://localhost:8001/schema.json',
            isAmisStyleSchema: true
        }]
    }
};
interface ItemDescription {
    label: string;
    detail?: string;
    documentation?: string | MarkupContent;
    kind?: CompletionItemKind;
    resultText?: string;
    notAvailable?: boolean;
    sortText?: string;
}

after(() => {
    console.log('all done');
    setTimeout(() => process.exit(0), 3000);
});

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

function testParseRegions(
    code: string,
    expected: EmbeddedRegion<'json', JSONMetaInfo>[],
    setting: AmisConfigSettings = defaultSettings
) {
    const sourceFile = ts.createSourceFile('test.ts', code, ts.ScriptTarget.ESNext);
    const regions = parseAmisJSON(sourceFile.text, setting);
    assert.deepEqual(regions, expected, 'regions should equal');
}

describe('parse text regions', function () {
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
                    schema: "amis",
                    schemaUri: "https://fex-team.github.io/amis-editor-demo/schema.json",
                    text: `
           
            {
    type: "page"
}`,
                    meta: { properties: [] }
                }
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
                    schema: "amis",
                    schemaUri: "https://fex-team.github.io/amis-editor-demo/schema.json",
                    text: `
           
               {
    type: "page",
    body: "default exports"
}`,
                    meta: { properties: [] }
                },
                {
                    start: 111,
                    end: 159,
                    type: 'json',
                    languageId: 'amisjson',
                    schema: "amis",
                    schemaUri: "https://fex-team.github.io/amis-editor-demo/schema.json",
                    text: `
           
                
                 
                           
 
           
                      {
    type: "page",
    body: "named exports"
}`,
                    meta: { properties: [] }
                }
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
                    schema: "amis",
                    schemaUri: "https://fex-team.github.io/amis-editor-demo/schema.json",
                    text: `
                 
               
               {
        type: "page",
        body: "declaration"
    }`,
                    meta: { properties: [] }
                },
                {
                    start: 136,
                    end: 192,
                    type: 'json',
                    languageId: 'amisjson',
                    schema: "amis",
                    schemaUri: "https://fex-team.github.io/amis-editor-demo/schema.json",
                    text: `
                 
               
                
                     
                           
      

               
           {
        type: "page",
        body: "new value"
    }`,
                    meta: { properties: [] }
                }
            ]);
    });
});

describe('parse text regions with custom setting', function () {
    it('props in toplevel declaration', async function () {
        testParseRegions(`
/** kemis */
const obj = {
    type: "page"
};`,
            [
                {
                    start: 25,
                    end: 46,
                    type: 'json',
                    languageId: 'amisjson',
                    schema: "kemis",
                    schemaUri: "http://localhost:8001/schema.json",
                    text: `
            
            {
    type: "page"
}`,
                    meta: { properties: [] }
                },
            ],
            customSettings);
    });
});

function testGetDocumentAtPoint(code: string, position: Position, languageId: string) {
    const sourceFile = TextDocument.create('test://test/test.ts', 'typescript', 0, code);
    const documentRegion = getDocumentRegions(sourceFile);
    assert.equal(documentRegion.getLanguageAtPosition(position), languageId, 'languageId should equal');
}

describe('get amisjson at certen point', function () {


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
    let sls: ReturnType<typeof getShadowLS>;

    async function testGetDocumentHoverAtPoint(code: string, position: Position, expected: Hover) {
        const sourceFile = TextDocument.create('test://test/test.ts', 'typescript', 0, code);
        debugger
        const hover = await sls.doHover(sourceFile, position);
        assert.deepEqual(hover, expected);
    }

    before(() => {
        this.timeout(5000)
        sls = getShadowLS();
        sls.initialize(null);
        sls.configure(defaultSettings);
    });

    after(() => {
        console.log('suite done');
        sls.dispose();
    });

    it('get hover at object literal', async function () {
        this.timeout(5000);
        await testGetDocumentHoverAtPoint(`
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
}`, { line: 4, character: 11 }, {
            contents: ['指定为 page 渲染器。'],
            range: { start: { line: 4, character: 8 }, end: { line: 4, character: 12 } }
        });
    });


    it('get hover info for refed schema', async function () {
        this.timeout(5000);
        await testGetDocumentHoverAtPoint(`/** amis */
export default {
    "title": "表单各种展示模式汇总",
    "remark": "展示各种模式的 Form",
    "body": [
        {
            "type": "grid",
            "visible": true,
            "columns": []
        }
    ]
}`,
            {
                line: 8,
                character: 15
            },
            {
                contents: ['是否显示'],
                range: { start: { line: 8, character: 12 }, end: { line: 8, character: 21 } }
            });
    });

    it('get hover info for nest schema', async function () {
        this.timeout(5000);
        await testGetDocumentHoverAtPoint(`/** amis */
export default {
    type: "page",
    "body": [
        {
            "type": "form",
            "controls": [{
                type: "number"
            }]
        }
    ]
}`,
            {
                line: 8,
                character: 18
            },
            {
                contents: ['表单项类型'],
                range: { start: { line: 8, character: 16 }, end: { line: 8, character: 21 } }
            });
    })

});

describe('get kemis hover at point', function () {
    let sls: ReturnType<typeof getShadowLS>;

    async function testGetDocumentHoverAtPoint(code: string, position: Position, expected: Hover) {
        const sourceFile = TextDocument.create('test://test/test.ts', 'typescript', 0, code);
        debugger
        const hover = await sls.doHover(sourceFile, position);
        assert.deepEqual(hover, expected);
    }

    before(() => {
        this.timeout(5000)
        sls = getShadowLS();
        sls.initialize(null);
        sls.configure(customSettings);
    });

    after(() => {
        console.log('suite done');
        sls.dispose();
    });

    it('get hover at object literal', async function () {
        this.timeout(5000);
        await testGetDocumentHoverAtPoint(`
function test() {
    /** kemis */
    var obj6 = {
        type: "page",
        body: "declaration"
    };

    /** kemis */
    obj6 = {
        type: "page",
        body: "new value"
    };
}`, { line: 4, character: 11 }, {
            contents: ['Page渲染器'],
            range: { start: { line: 4, character: 8 }, end: { line: 4, character: 12 } }
        });
    });

})

async function testGetDocumentCompletionAtPoint(code: string, position: Position) {
    const sourceFile = TextDocument.create('test://test/test.ts', 'typescript', 0, code);
    const sls = getShadowLS();
    sls.initialize(null);

    const completion = await sls.doComplete(sourceFile, position);
    // console.log('completion', completion);

    sls.dispose();
}
describe('get amisjson completion at point', function () {
    this.timeout(5000);
    it('get amisjson at object literal', async function () {
        await testGetDocumentCompletionAtPoint(`function test() {
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
}`, { line: 4, character: 11 });
    })
});
