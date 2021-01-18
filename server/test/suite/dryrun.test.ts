import { activateExtension, createTestFile, testHover } from '../test-utils';

import { before } from 'mocha'

suite('auto complete', () => {
    before(async () => {
        await createTestFile('hover.tsx');
        await activateExtension()
    });

    test('holds', async function () {
        this.timeout(0);

        await testHover(`/** amis */
export default {
    type: "page"
}

/** kemis-h5-test */
export default {
    type: "pa|ge"
}
`);

        await new Promise((resolve) => setTimeout(resolve, 1000000000));

    });
});