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
import { insertSchema } from './helpers/preprocesser';
import { shadowJSONSchemaPrefix } from './helpers/bridge';


export function getLs(configure: LanguageSettings = {
	validate: false,
	allowComments: true,
	schemas: [{
		uri: 'https://houtai.baidu.com/v2/schemas/page.json',
	}]
}) {
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

			return await new Promise<string>(function (resolve, reject) {
				
				request.get(schemaUri, function (err, resp, body) {
					if (err) {
						console.log('do get schema failed', schemaUri, err);
						reject(err);
					} else {
						resolve(body);
					}
				});
			});
		},
		clientCapabilities: ClientCapabilities.LATEST
	});

	ls.configure(configure);
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
		configure(c: LanguageSettings) {
			ls.configure(c);
		},

		doHover(document, position) {
			const textdocument = documentRegions.get(document).getSubDocumentAtPosition(position);
			const jsonDocument = ls.parseJSONDocument(textdocument);
			insertSchema(jsonDocument);

			return ls.doHover(textdocument, position, jsonDocument)
		},

		doComplete(document, position) {
			const textdocument = documentRegions.get(document).getSubDocumentAtPosition(position);
			const jsonDocument = ls.parseJSONDocument(textdocument);
			insertSchema(jsonDocument);

			return ls.doComplete(textdocument, position, jsonDocument)
		},

		onDocumentRemoved(document) {
			documentRegions.onDocumentRemoved(document);
		},
		dispose() {
			(ls as any) = null;
		}
	};
}