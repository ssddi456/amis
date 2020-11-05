
export interface AmisConfigSettings {
    schema: {
        map: { label: string; schema: string; isAmisStyleSchema: boolean; }[];
	};
}
// The example settings
// The global settings, used when the `workspace/configuration` request is not supported by the client.
// Please note that this is not the case when using this server with the client provided in this example
// but could happen with other clients.
export const defaultSettings: AmisConfigSettings = {
	schema: {
		map: [{
			"label": "amis",
			"schema": "https://fex-team.github.io/amis-editor-demo/schema.json",
			isAmisStyleSchema: true
		}]
	}
};
