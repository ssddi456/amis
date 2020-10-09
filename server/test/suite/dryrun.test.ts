import { activateExtension, createTestFile, testHover } from '../test-utils';

import { before } from 'mocha'

suite('auto complete', () => {
    before(async () => {
        await createTestFile('hover.ts');
        await activateExtension()
    });

    test('holds', async function () {
        this.timeout(0);

        await testHover(`/** amis */
        export default {
            ty|pe: "page"
        }
        `);

        await new Promise((resolve) => setTimeout(resolve, 1000000000));

    });
});