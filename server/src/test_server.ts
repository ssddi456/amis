debugger
/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
import {
	createConnection,
	ProposedFeatures,
} from 'vscode-languageserver';


let connection = createConnection(ProposedFeatures.all);
connection.onInitialize(() => {
    console.log('connect onInitialize');
	return {
        capabilities: {}
    };
});
connection.onInitialized(() => {
    console.log('connect onInitialized');
    
});
connection.listen();