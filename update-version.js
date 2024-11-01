const fs = require('fs')
const packageVersion = require('./package.json').version

console.log( `set version to ${packageVersion}...` )

let file = 'index.php'

console.log( file )
fs.writeFileSync( file,  fs.readFileSync( file, 'utf8' ).replace(/^( \* Version: )[\d.]+(\-[a-z0-9]+)*$/m, `$1${packageVersion}`))

file = 'readme.txt'
console.log( file )
fs.writeFileSync( file, fs.readFileSync( file, 'utf8' ).replace(/(^Stable tag: )[\d.]+(\-[a-z0-9]+)*$/m, `$1${packageVersion}`))

console.log( 'DONE.' )
