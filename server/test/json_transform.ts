import 'mocha';
import 'ts-node';
import { assert } from "chai";
import {
    getLanguageService,
    ClientCapabilities
} from 'vscode-json-languageservice';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { defaultSettings } from '../src/AmisConfigSettings';
import { parseAmisJSON } from '../src/modes/helpers/parser';
import { patchJsonAst } from '../src/modes/helpers/preprocesser';

function createTestLs() {
    const ls = getLanguageService({
        clientCapabilities: ClientCapabilities.LATEST
    });

    ls.configure({
        validate: false,
        allowComments: true,
        schemas: [{ uri: 'http://test.com', schema: testSchema }]
    });

    return ls;
}

const testSchema = {
    "$schema": "http://json-schema.org/draft-04/schema#",
    "title": "book info",
    "description": "some information about book",
    "type": "object",
    "properties": {
        "a": {
            "type": "string",
        },
        "b": {
            "type": "string",
        },
        "c": {
            "type": "string",
        },
        "id": {
            "description": "The unique identifier for a book",
            "type": "integer",
            "minimum": 1
        },
        "name": {
            "type": "string",
            "pattern": "^#([0-9a-fA-F]{6}$",
            "maxLength": 6,
            "minLength": 6
        },
        "price": {
            "type": "number",
            "multipleOf": 0.5,
            "maximum": 12.5,
            "exclusiveMaximum": true,
            "minimum": 2.5,
            "exclusiveMinimum": true
        },
        "tags": {
            "type": "array",
            "items": [
                {
                    "type": "string",
                    "minLength": 5
                },
                {
                    "type": "number",
                    "minimum": 10
                }
            ],
            "additionalItems": {
                "type": "string",
                "minLength": 2
            },
            "minItems": 1,
            "maxItems": 5,
            "uniqueItems": true
        }
    },
    "minProperties": 1,
    "maxProperties": 5,
    "required": [
    ]
};

const sampleCode1 = `
/** amis */
const b = {
    a: 'b',
    b: "b",
    d: 'b',
    "c": \`d\`,
}
`;

describe('test test region parser', function () {
    it(' simple ', async function () {
        const regions = parseAmisJSON(sampleCode1, defaultSettings);

        console.log(regions);

        assert.deepEqual(regions, [
            {
                start: 22,
                end: 76,
                languageId: 'amisjson',
                type: 'json',
                text: ['',
                    '           ',
                    '          {',
                    "    a: 'b',",
                    '    b: "b",',
                    "    d: 'b',",
                    '    "c": `d`,',
                    '}'].join('\n'),
                schema: 'amis',
                schemaUri: 'https://fex-team.github.io/amis-editor-demo/schema.json',
                meta: {
                    properties: [
                        {
                            "key": {
                                "range": {
                                    "end": 30,
                                    "pos": 24
                                },
                                "value": "a"
                            },
                            "range": {
                                "end": 35,
                                "pos": 24
                            },
                            "value": {
                                "range": {
                                    "end": 34,
                                    "pos": 32
                                },
                                "value": "b"
                            }
                        },
                        {
                            "key": {
                                "range": {
                                    "end": 54,
                                    "pos": 48
                                },
                                "value": "d"
                            },
                            "range": {
                                "end": 59,
                                "pos": 48
                            },
                            "value": {
                                "range": {
                                    "end": 58,
                                    "pos": 56
                                },
                                "value": "b"
                            }
                        },
                        {
                            "key": {
                                "range": {
                                    "end": 68,
                                    "pos": 60
                                },
                                "value": "\"c\""
                            },
                            "range": {
                                "end": 73,
                                "pos": 60
                            },
                            "value": {
                                "range": {
                                    "end": 72,
                                    "pos": 70
                                },
                                "value": "d"
                            }
                        }
                    ]
                }
            }
        ]);
        return;
    });
});

describe('test json transform', function () {
    const ls = createTestLs();
    it(' simple ', async function () {
        const regions = parseAmisJSON(sampleCode1, defaultSettings);

        patchJsonAst(ls.parseJSONDocument(TextDocument.create('file://test.json', 'amisjson', 0, regions[0].text!)), regions[0]);
    });
});
