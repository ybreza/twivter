const ts = require('typescript')
const fs = require('fs')

const file = process.argv[2]
const source = fs.readFileSync(file, 'utf8')
const sf = ts.createSourceFile(file, source, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TS)

const diags = sf.parseDiagnostics || []
if (diags.length === 0) {
  console.log('PARSE OK')
} else {
  for (const d of diags) {
    const { line, character } = sf.getLineAndCharacterOfPosition(d.start)
    console.log(`line ${line + 1}:${character + 1} ${ts.flattenDiagnosticMessageText(d.messageText, ' ')}`)
    console.log('  >>> ' + JSON.stringify(source.split('\n')[line]))
  }
}