import * as path from 'path';
export const shadowJSONSurfix = '.__shadow_json__';
export const shadowJSONSchema = '$schema: "https://houtai.baidu.com/v2/schemas/page.json"';


export function isAmisJsonUrl( url: string) {
	const extname = path.basename(url);
	return path.extname(path.basename(url, extname)) == shadowJSONSurfix;
}


export function getAmisJsonOriginName(url: string) {
	const extname = path.basename(url);
	return path.basename(path.basename(url, extname), shadowJSONSurfix) + extname;
}