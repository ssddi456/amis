import * as path from 'path';
export const shadowJSONSurfix = '.__shadow_json__';
export const shadowJSONSchemaKey = '$schema';
export const shadowJSONSchemaValue = 'https://houtai.baidu.com/v2/schemas/schema.json';
export const shadowJSONFormSchemaValue = 'https://houtai.baidu.com/v2/schemas/form.json';
export const shadowJSONSchemaPrefix = 'https://houtai.baidu.com/v2';
import { JSONSchema } from 'vscode-json-languageservice';

export function getSchemaValueByType(schema: string) {
	switch (schema) {
		case 'amis-formitem':
			return shadowJSONFormSchemaValue;
		default:
		case 'amis':
			return shadowJSONSchemaValue;
	}
}

export function getJSONSchemaByType(schema: string) {
	switch (schema) {
		case 'amis-formitem':
			return defaultFormSchema;
		default:
		case 'amis':
			return defaultSchema;
	}
}

import * as fs from 'fs';

const schemaJSON = (function () {
	try {
		return fs.readFileSync(path.join(__dirname, '../../../src/schemas/schema.json'), 'utf8');
	} catch (e) {
		return '{}';
	}
})();
export const defaultSchema: JSONSchema = (function () {
	try {
		return JSON.parse(schemaJSON);
	} catch (e) {
		console.log('load schema error', e);
	}
	return {};
})()

export const defaultFormSchema: JSONSchema = (function () {
	try {
		const schema = JSON.parse(schemaJSON);
		schema["$ref"] = "#/definitions/FormControlSchema";
		return schema;
	} catch (e) {
		console.log('load schema error', e);
	}
	return {};
})();
