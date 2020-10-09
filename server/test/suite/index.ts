import * as path from 'path'
import * as Mocha from 'mocha'
import * as glob from 'glob'

// const testFiles = '**/**.test.js'
// const testFiles = '**/+(emmetCompleteTag|autoCloseTag).test.js'
// const testFiles = '**/+(emmetCompleteTag).test.js'
const files = [
    'dryrun'
]
const testFiles = `**/+(${files.join('|')}).test.js`
// const testFiles = '**/+(emmetCompleteTag).benchmark.js'

export function run(): Promise<void> {
    // Create the mocha test
    const mocha = new Mocha({
        ui: 'tdd',
        timeout: 1000000,
    })

    mocha.bail(true)

    const testsRoot = path.resolve(__dirname, '..')

    return new Promise((resolve, reject) => {
        glob(testFiles, { cwd: testsRoot }, (err, files) => {
            console.log(files)
            if (err) {
                return reject(err)
            }

            // Add files to the test suite
            files.forEach(f => mocha.addFile(path.resolve(testsRoot, f)))

            try {
                // Run the mocha test
                mocha.run(failures => {
                    if (failures > 0) {
                        reject(new Error(`${failures} tests failed.`))
                    } else {
                        resolve()
                    }
                })
            } catch (err) {
                reject(err)
            }
        })
    })
}