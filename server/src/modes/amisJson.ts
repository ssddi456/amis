import { DocumentRegions } from '../embeddedSupport';
import { LanguageModelCache } from '../languageModelCache';
import { LanguageMode } from '../languageModes';
import * as request from 'request';
import {
    LanguageSettings,
    getLanguageService,
    LanguageService,
    ClientCapabilities,
    TextDocument
} from 'vscode-json-languageservice';

import * as fs from 'fs';
import {
    CompletionList,
    CompletionItem,
} from 'vscode-languageserver-types';
import { insertSchema } from './helpers/preprocesser';
import { defaultSchema, shadowJSONSchemaPrefix, shadowJSONSchemaValue } from './helpers/bridge';
import { NULL_COMPLETION } from './nullMode';
import { AmisConfigSettings, defaultSettings } from '../AmisConfigSettings';
import { Command, TextDocumentChangeEvent } from 'vscode-languageserver';
import events, { EventTypes } from '../utils/events';

enum AmisCommand {
    preview = 'amis.previewSchema',
    endpreview = 'amis.endPreviewSchema',
};
enum AmisNotification {
    openPreviewWebview = 'amisJsonExtension/openPreviewWebview',
    updatePreviewWebview = 'amisJsonExtension/updatePreviewWebview',
};

const AmisCommandKeys = Object.keys(AmisCommand)
const commands: AmisCommand[] = AmisCommandKeys.map(k => (AmisCommand as any)[k]).map(v => v as AmisCommand)

export function getLs({
    extensionSetting,
    languageSettings,
}: {
    extensionSetting: AmisConfigSettings,
    languageSettings: LanguageSettings
} = {
        extensionSetting: defaultSettings,
        languageSettings: {
            validate: false,
            allowComments: true,
            schemas: [{
                uri: shadowJSONSchemaValue,
                schema: defaultSchema
            }]
        }
    },
) {

    const schemas: { [k: string]: Promise<string> } = {};
    extensionSetting.schema?.map?.forEach((schemaConfig) => {
        schemas[schemaConfig.schema] = doRequest(schemaConfig.schema, schemaConfig);
    });

    console.log( 'amis extensionSetting', JSON.stringify(extensionSetting) );

    async function doRequest(schemaUri: string, schemaConfig: { isAmisStyleSchema: boolean, }) {
        return new Promise<string>((resolve, reject) => {
            // console.log('do get schema start', schemaUri);
            request.get(schemaUri, function (err, resp, body) {
                if (err) {
                    // console.log('do get schema failed', schemaUri, err);
                    reject(err);
                } else {
                    // console.log('do get schema success', schemaUri);
                    if (schemaConfig && schemaConfig.isAmisStyleSchema) {
                        try {
                            const schema = JSON.parse(body);
                            schema["$ref"] = "#/definitions/SchemaObject";
                            resolve(JSON.stringify(schema));
                            return;
                        } catch (error) { }
                    }
                    resolve(body);
                }
            });
        });
    }
    // 这里可以预先加载schemas
    const ls = getLanguageService({
        async schemaRequestService(schemaUri: string): Promise<string> {
            const schemaConfig = (extensionSetting.schema?.map?.filter(item => item.schema == schemaUri) || [])[0];
            if (schemas[schemaUri]) {
                return schemas[schemaUri];
            }

            return doRequest(schemaUri, schemaConfig);
        },
        clientCapabilities: ClientCapabilities.LATEST
    });

    ls.configure(languageSettings);

    return ls;
}

export function getAmisJsonMode(
    documentRegions: LanguageModelCache<DocumentRegions>,
    workspacePath: string | null | undefined
): LanguageMode {

    // 这里应该有一个运行时重读配置的地儿?
    let ls: LanguageService = getLs();

    return {
        getId() {
            return 'amisjson';
        },
        configure(c) {

            ls = getLs({
                extensionSetting: c,
                languageSettings: {
                    validate: false,
                    allowComments: true,
                    schemas: c?.schema?.map.map(item => { return { uri: item.schema } }) || []
                }
            });
            if (documentRegions.configure) {
                documentRegions.configure(c);
            }
        },

        doHover(document, position) {
            const region = documentRegions.get(document).getRegionAtPosition(position);
            const textdocument = documentRegions.get(document).getSubDocumentAtPosition(position);
            const jsonDocument = ls.parseJSONDocument(textdocument);
            insertSchema(jsonDocument, region.schema!, region.schemaUri);

            return ls.doHover(textdocument, position, jsonDocument)
        },

        async doComplete(document, position): Promise<CompletionList> {
            const region = documentRegions.get(document).getRegionAtPosition(position);
            const textdocument = documentRegions.get(document).getSubDocumentAtPosition(position);
            const jsonDocument = ls.parseJSONDocument(textdocument);
            insertSchema(jsonDocument, region.schema!, region.schemaUri);

            return (await ls.doComplete(textdocument, position, jsonDocument) as CompletionList | null) || NULL_COMPLETION;
        },

        async doResolve(document, item): Promise<CompletionItem> {
            return await ls.doResolve(item) as any;
        },

        getCommands() {
            return commands;
        },
        async doCodeAction(document, range): Promise<Command[]> {
            const regions = documentRegions.get(document);
            const region = regions.getRegionAtPosition(range.start);
            const index = regions.getRegionIndex(region);

            return [Command.create('preview schema', AmisCommand.preview,
                document.uri,
                index
            )];
        },
        async executeCommand(command: string, args: any[], connection) {


            switch (command) {
                case AmisCommand.preview:
                    const regions = documentRegions.getByUri(args[0]);
                    const textdocument = regions.getSubDocumentAtIndex(args[1]);
                    connection.sendNotification(AmisNotification.openPreviewWebview,
                        tryParseJSON(textdocument.getText()));
                    events.on(EventTypes.fileChange, contentChange);
                    break;
                case AmisCommand.endpreview:
                    // dispose watch
                    events.removeListener(EventTypes.fileChange, contentChange);
                    break;
                default:
                    break;
            }


            function tryParseJSON(text: string) {
                try {
                    return JSON.parse(text.trim());
                } catch (e) {
                    return text;
                }
            }

            function contentChange(event: TextDocumentChangeEvent<TextDocument>) {
                if (event.document.uri == args[0]) {
                    const regions = documentRegions.get(event.document);
                    const textdocument = regions.getSubDocumentAtIndex(args[1]);
                    connection.sendNotification(AmisNotification.updatePreviewWebview,
                        tryParseJSON(textdocument.getText()));
                }
            }
        },
        onDocumentRemoved(document) {
            documentRegions.onDocumentRemoved(document);
        },
        dispose() {
            (ls as any) = null;
        }
    };
}