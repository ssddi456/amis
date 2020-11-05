import { DocumentRegions } from '../embeddedSupport';
import { LanguageModelCache } from '../languageModelCache';
import { LanguageMode } from '../languageModes';
import * as request from 'request';
import {
	LanguageSettings,
	getLanguageService,
	LanguageService,
	ClientCapabilities
} from 'vscode-json-languageservice';

import {
	CompletionList,
	CompletionItem
} from 'vscode-languageserver-types';
import { insertSchema } from './helpers/preprocesser';
import { defaultSchema, shadowJSONSchemaPrefix, shadowJSONSchemaValue } from './helpers/bridge';
import { NULL_COMPLETION } from './nullMode';
import { AmisConfigSettings, defaultSettings } from '../AmisConfigSettings';


export function getLs({
	extensionSetting,
	languageSettings
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
	}
) {
	// 这里可以预先加载schemas

	const ls = getLanguageService({
		workspaceContext: {
			resolveRelativePath(relativePath: string, resource: string): string {
				// 处理下amis本身schema写的不对的问题，回头给他提个pr；
				if (resource.indexOf(shadowJSONSchemaPrefix) === 0) {
					return shadowJSONSchemaPrefix + relativePath;
				}
				return relativePath;
			}
		},
		async schemaRequestService(schemaUri: string): Promise<string> {
			const schemaConfig = (extensionSetting.schema?.map?.filter(item => item.schema == schemaUri) || [])[0];

			return await new Promise<string>(function (resolve, reject) {

				request.get(schemaUri, function (err, resp, body) {
					if (err) {
						console.log('do get schema failed', schemaUri, err);
						reject(err);
					} else {
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

		onDocumentRemoved(document) {
			documentRegions.onDocumentRemoved(document);
		},
		dispose() {
			(ls as any) = null;
		}
	};
}