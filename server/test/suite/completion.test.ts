import {
    TestCase,
    createTestFile,
    run,
    activateExtension,
    ciSlowNess,
} from '../test-utils'
import { before } from 'mocha'

const timeout = 300 * ciSlowNess

suite('auto complete', () => {
    before(async () => {
        await createTestFile('auto-complete.tsx');
        await activateExtension()
    })

    test('basic', async () => {
        const testCases: TestCase[] = [
            {
                input: `/** amis */
export default {
    t|
}`,
                type: 'y',
                expect: `/** amis */
export default {
    type
}`,
                waitForAutoComplete: 1,
                timeout: 'never'
            },

        ]
        await run(testCases, { timeout })
    })
})