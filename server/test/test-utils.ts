import * as vscode from 'vscode'
import * as fs from 'fs'
import * as path from 'path'
import * as assert from 'assert'

const extension = vscode.extensions.getExtension(
  'ssddi456.amis'
)

export async function activateExtension() {
  await extension!.activate()
}

export interface TestCase {
  input?: string
  type?: string
  expect: string
  only?: boolean
  speed?: number
  skip?: boolean
  timeout?: 'never' | number
  debug?: boolean
  waitForAutoComplete?: 1
  selection?: [number, number]
  afterCommands?: string[]
}

export async function createTestFile(
  fileName: string,
  content: string = ''
): Promise<void> {
  const filePath = path.join(__dirname, fileName)
  fs.writeFileSync(filePath, content)
  const uri = vscode.Uri.file(filePath)
  await vscode.window.showTextDocument(uri)
  vscode.window.activeTextEditor!.edit(builder => {
    builder.setEndOfLine(vscode.EndOfLine.LF);
  })
}

export async function closeTestFile(): Promise<void> {
  await vscode.commands.executeCommand('workbench.action.closeActiveEditor')
}

async function setText(text: string): Promise<void> {
  const document = vscode.window.activeTextEditor!.document
  const all = new vscode.Range(
    document.positionAt(0),
    document.positionAt(document.getText().length)
  )
  await vscode.window.activeTextEditor!.edit(editBuilder =>
    editBuilder.replace(all, text)
  )
}

function setCursorPosition(offset: number): void {
  const position = vscode.window.activeTextEditor!.document.positionAt(offset)
  vscode.window.activeTextEditor!.selection = new vscode.Selection(
    position,
    position
  )
  console.log(vscode.window.activeTextEditor!.selection)
}

async function typeLiteral(text: string): Promise<void> {
  await vscode.window.activeTextEditor!.insertSnippet(
    new vscode.SnippetString(text),
    vscode.window.activeTextEditor!.selection.active,
    {
      undoStopAfter: false,
      undoStopBefore: false,
    }
  )
}

async function typeDelete(times: number = 1): Promise<void> {
  const offset = vscode.window.activeTextEditor!.document.offsetAt(
    vscode.window.activeTextEditor!.selection.active
  )
  await new Promise<void>(async resolve => {
    await vscode.window.activeTextEditor!.edit(editBuilder => {
      editBuilder.delete(
        new vscode.Range(
          vscode.window.activeTextEditor!.document.positionAt(offset - times),
          vscode.window.activeTextEditor!.document.positionAt(offset)
        )
      )
    })
    resolve()
  })
}
async function type(text: string, speed = 150): Promise<void> {
  for (let i = 0; i < text.length; i++) {
    if (i === 0) {
      await new Promise(resolve => setTimeout(resolve, speed / 2))
    } else {
      await new Promise(resolve => setTimeout(resolve, speed))
    }
    if (text.slice(i).startsWith('{backspace}')) {
      await typeDelete()
      i += '{backspace}'.length - 1
    } else if (text.slice(i).startsWith('{undo}')) {
      await vscode.commands.executeCommand('undo')
      i += '{undo}'.length - 1
    } else if (text.slice(i).startsWith('{redo}')) {
      await vscode.commands.executeCommand('redo')
      i += '{redo}'.length - 1
    } else if (text.slice(i).startsWith('{tab}')) {
      await vscode.commands.executeCommand('html-expand-abbreviation')
      i += '{tab}'.length - 1
    } else if (text.slice(i).startsWith('{end}')) {
      await vscode.commands.executeCommand('cursorEnd')
      i += '{end}'.length - 1
    } else if (text.slice(i).startsWith('{down}')) {
      await vscode.commands.executeCommand('cursorDown')
      i += '{down}'.length - 1
    } else if (text.slice(i).startsWith('{copyLineDown}')) {
      await vscode.commands.executeCommand('editor.action.copyLinesDownAction')
      i += '{copyLineDown}'.length - 1
    } else {
      await typeLiteral(text[i])
    }
  }
}

async function waitForAutoComplete(timeout: 'never' | number) {
  return new Promise<void>(resolve => {
    const disposable = vscode.workspace.onDidChangeTextDocument(() => {
      disposable.dispose()
      resolve()
    })
    if (timeout !== 'never') {
      setTimeout(resolve, timeout)
    }
  })
}

export function getText(): string {
  return vscode.window.activeTextEditor!.document.getText()
}

async function setupContentAndCursor(content: string) {
  const cursorOffset = content.indexOf('|');
  const input = content.replace('|', '');
  await setText(input);
  setCursorPosition(cursorOffset);
}

export async function testHover(
  content: string
) {
  await setupContentAndCursor(content);
  const hovers = await vscode.commands.executeCommand(
    'vscode.executeHoverProvider',
    vscode.window.activeTextEditor!.document.uri,
    vscode.window.activeTextEditor!.selection.active) as vscode.Hover[];

  console.log('hovers', hovers);

}
export async function run(
  testCases: TestCase[],
  { speed = 0, timeout = 40, afterCommands = [] as any[] } = {}
) {
  const only = testCases.filter(testCase => testCase.only)
  const applicableTestCases = only.length ? only : testCases
  for (const testCase of applicableTestCases) {
    if (testCase.skip) {
      continue
    }
    if (testCase.input !== undefined) {
      await setupContentAndCursor(testCase.input);
    }
    if (testCase.selection) {
      const [start, end] = testCase.selection;
      vscode.window.activeTextEditor!.selection = new vscode.Selection(
        vscode.window.activeTextEditor!.document.positionAt(start),
        vscode.window.activeTextEditor!.document.positionAt(end)
      )
    }
    if (testCase.type) {
      await type(testCase.type, testCase.speed || speed)
      const autoCompleteTimeout = testCase.timeout || timeout
      await waitForAutoComplete(autoCompleteTimeout)
    }
    const resolvedAfterCommands = testCase.afterCommands || afterCommands
    for (const afterCommand of resolvedAfterCommands) {
      await vscode.commands.executeCommand(afterCommand)
      const autoCompleteTimeout = testCase.timeout || timeout
      await waitForAutoComplete(autoCompleteTimeout)
    }
    const result = getText()
    if (testCase.debug) {
      await new Promise(() => { })
    }
    assert.equal(result, testCase.expect)
  }
}

export const ciSlowNess = 2