import * as path from 'path'
import { runTests } from 'vscode-test'

const extensionRoot = path.join(__dirname, '../../')
;(async () => {
  try {
    const extensionDevelopmentPath = path.resolve(__dirname, '../../')
    const extensionTestsPath = path.resolve(__dirname, './suite/index')
    const workspace = path.join(extensionRoot, `server/src/test/suite/workspace`)

console.log('extensionRoot', extensionRoot,);
console.log('extensionDevelopmentPath', extensionDevelopmentPath,);
console.log('extensionTestsPath', extensionTestsPath,);
console.log('workspace', workspace);

    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      // vscodeExecutablePath: path.join(
      //   __dirname,
      //   `../../.vscode-test/vscode-${vscodeVersion}/VSCode-linux-x64/bin/code`
      // ),
      launchArgs: ['--disable-extensions', workspace],
    })
  } catch (err) {
    console.error('Failed to run tests')
    // process.exit(1)
  }
})()