import * as path from 'path';
export const shadowJSONSurfix = '.__shadow_json__';
export const shadowJSONSchemaKey = '$schema';
export const shadowJSONSchemaValue = 'https://houtai.baidu.com/v2/schemas/page.json';
export const shadowJSONSchemaPrefix = 'https://houtai.baidu.com/v2';


export function isAmisJsonUrl( url: string) {
	const extname = path.basename(url);
	return path.extname(path.basename(url, extname)) == shadowJSONSurfix;
}


export function getAmisJsonOriginName(url: string) {
	const extname = path.basename(url);
	return path.basename(path.basename(url, extname), shadowJSONSurfix) + extname;
}