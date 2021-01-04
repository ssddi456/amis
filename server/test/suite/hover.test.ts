import {
    createTestFile,
    activateExtension,
    ciSlowNess,
    testHover,
} from '../test-utils'
import { before } from 'mocha'

const timeout = 300 * ciSlowNess

suite('auto complete', () => {
    before(async () => {
        await createTestFile('hover.tsx');
        await activateExtension()
    });

    test('basic', async () => {
        await testHover(`/** amis */
export default {
    ty|pe: "page"
}
`);
        await new Promise((resolve) => setTimeout(resolve, 10000000));
    });
});