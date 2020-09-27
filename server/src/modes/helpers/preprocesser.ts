/**
 * 修改源码插入 $schema
 */
import { JSONDocument, PropertyASTNode, ObjectASTNode, StringASTNode } from 'vscode-json-languageservice';
import { shadowJSONSchemaKey, shadowJSONSchemaValue } from './bridge';


export function hasSchemaNode(document: JSONDocument) {
	if (document.root && document.root.type == 'object') {
		const properties = document.root.properties;
		for (let i = 0; i < properties.length; i++) {
			const element = properties[i];
			if (element.keyNode.value == '$schema') {
				return true;
			}
		}
	}
	return false;
}

export function insertSchema(document: JSONDocument) {
	if (!hasSchemaNode(document) && document.root && document.root.type == 'object') {
		const schemaNode = getSchemaNode(document.root.offset, 0, document.root);
		document.root.properties.unshift(schemaNode);
	}
}


export function getSchemaNode(offset: number, colonOffset: number, parent: ObjectASTNode): PropertyASTNode {
	const key: StringASTNode = {
		type: 'string',
		offset,
		length: 0,
		value: shadowJSONSchemaKey,
	};
	const value: StringASTNode = {
		type: 'string',
		offset,
		length: 0,
		value: shadowJSONSchemaValue,
	};
	const property: PropertyASTNode = {
		type: 'property',
		parent,
		offset,
		length: 1,
		keyNode: key,
		valueNode: value,
		colonOffset,
		children: [],
	};
	return property;
}