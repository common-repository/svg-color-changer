const rimraf = require("rimraf");
const copy = require('copy')
const path = require('path')
const fs = require('fs')
const fse = require('fs-extra')
const archiver = require('archiver')
const package = require('./package.json')

// const isAlpha = /-alpha$/.test(package.name);

const copyFiles = [
  'license.txt',
  'readme.txt',
  './*.php',
  './js/**',
  './css/**',
  './assets/**',
  './languages/**',
  './lib/**',
]

let targetCount = 0;
let finishedTargets = 0;

let DEBUG_KEEP_FILES = false;

function escapeRegex(string) {
  return string.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')
}

function resolveFilePlaceholders( stringIn, target ) {
  return stringIn.replace(/\{target\}/g, target.name)
}

function modifyContent(files, basePath, target) {
  files.forEach(file => {
    const copiedFile = file.path.replace( new RegExp(`^${ basePath }`), '' )

    if (!copiedFile.startsWith(libPath)) { // we don't want to touch any lib files
      const pathParts = [ 'dist', '_temp', target.name ]
      const relativeFilePath = path.relative(path.resolve( ...[fs.realpathSync(__dirname), pathParts].flat() ), fs.realpathSync(file.path)).replace(/\\/g, '/')

      if (target.fileBlacklist && target.fileBlacklist.includes(relativeFilePath)) {
        fs.unlinkSync( file.path )
      } else if (/\.(php|js)$/.test(file.path)) {
        let content = fs.readFileSync(file.path, 'utf8')

        let modifiedContent = content

        let outputFile = file.path
        let newFilename = relativeFilePath

        if (target.renameFiles && target.renameFiles[relativeFilePath] ) {
          newFilename = resolveFilePlaceholders(target.renameFiles[relativeFilePath], target)
          console.log(`[${target.name}] rename ${relativeFilePath} => ${newFilename}`)
          outputFile = path.resolve( path.dirname(outputFile), newFilename )
          fs.unlinkSync( file.path )
        }

        if (target.replaceFileContent && target.replaceFileContent[relativeFilePath]) {
          console.log(`[${target.name}] replace content in ${newFilename}`)
          modifiedContent = target.replaceFileContent[relativeFilePath](modifiedContent)
        }

        if ( modifiedContent !== content ) {
          fs.writeFileSync(outputFile, modifiedContent)
        }
      } else if (target.renameFiles && target.renameFiles[relativeFilePath] ) {
        let newFilename = resolveFilePlaceholders(target.renameFiles[relativeFilePath], target)
        console.log(`[${target.name}] rename ${relativeFilePath} => ${newFilename}`)
        let outputFile = path.resolve( path.dirname(file.path), newFilename )
        fs.renameSync( file.path, outputFile )
      }
    }
  })
}

function createTarget(target) {
  targetCount++

  const pathParts = [ 'dist', '_temp', `${target.name}` ]
  let files = [ ...copyFiles, './' + target.name + '/**' ]; // add target-specific folder

  if ( !!target.includeVendorDir ) {
    files.push( './vendor/**' );
  }

  copy(files, path.join( ...pathParts ), function (err, files) {
    const basePath = escapeRegex(path.join( ...[ process.cwd(), pathParts ].flat() ))

    if (err) {
      console.error( err )
    } else {
      console.log(`finished copying files to target ${target.name}`)
      modifyContent(files, basePath, target)
      console.log(`finished modifying files for target ${target.name}`)
      // @TODO remove assets folder if empty
      createArchive(target)
    }
  })
}

function createArchive(target) {
  const zipName = `dist/${package.name}-${package.version}-${target.name}.zip`
  const output = fs.createWriteStream(zipName)
  const archive = archiver('zip')

  output.on('close', function () {
    console.log(`created ${zipName} (${archive.pointer()} bytes)`)

    if (target.finally) {
      target.finally()
    }

    finishedTargets++

    if (finishedTargets === targetCount) {
      if (!DEBUG_KEEP_FILES) rimraf.sync('dist/_temp')
      console.log('DONE.')
    }
  })

  archive.on('error', function(err){
    throw err;
  })

  archive.pipe(output)

  let suffix = '';
  if (target.innerFolderSuffix === true) {
    suffix = `-${target.name}`;
  } else if (target.innerFolderSuffix !== false) {
    suffix = `-${target.innerFolderSuffix}`;
  }

  archive.directory(`dist/_temp/${target.name}`, `${package.name}${suffix}`)
  archive.finalize()
}

const libPath = path.join('/', 'includes', '/')

rimraf.sync('dist/_temp')

const target_free = {
  name: 'free',
  innerFolderSuffix: false,
  fileBlacklist: [
  ],
  renameFiles: {
    'assets/icon.svg': '../../../../svn/assets/icon.svg',
    'assets/banner-772x250.jpg': '../../../../svn/assets/banner-772x250.jpg',
    'assets/banner-1544x500.jpg': '../../../../svn/assets/banner-1544x500.jpg',
    'assets/icon-128x128.png': '../../../../svn/assets/icon-128x128.png',
    'assets/icon-256x256.png': '../../../../svn/assets/icon-256x256.png',
    'assets/screenshot-1.png': '../../../../svn/assets/screenshot-1.png',
    'assets/screenshot-2.png': '../../../../svn/assets/screenshot-2.png',
    'assets/screenshot-3.png': '../../../../svn/assets/screenshot-3.png',
    'assets/screenshot-4.png': '../../../../svn/assets/screenshot-4.png',
    'assets/screenshot-5.png': '../../../../svn/assets/screenshot-5.png',
    'assets/screenshot-6.png': '../../../../svn/assets/screenshot-6.png',
    'assets/screenshot-7.png': '../../../../svn/assets/screenshot-7.png',
  },
  finally() {
    console.log( `[${this.name}] clean SVN trunk` )
    rimraf.sync('./svn/trunk')
    console.log( `[${this.name}] copy contents to SVN trunk` )
    fse.copySync( `./dist/_temp/${this.name}`, './svn/trunk' )
  }
};
createTarget(target_free)

// const target_premium = {
//   name: 'premium',
//   innerFolderSuffix: true,
//   includeVendorDir: true,
//   fileBlacklist: [
//     'license.txt',
//     'readme.txt',
//     'assets/screenshot-1.png',
//     'assets/screenshot-2.png',
//     'assets/screenshot-3.png',
//     'assets/screenshot-4.png',
//     'assets/screenshot-5.png',
//     'assets/screenshot-6.png',
//     'assets/screenshot-7.png',
//   ],
//   renameFiles: {},
//   replaceFileContent: {
//     'corona-test-results.php': ( content ) => {
//       let newContent = content.replace(/(\r?\n) \* Plugin Name: SVG Color Changer(\r?\n)/, '$1 * Plugin Name: SVG Color Changer (Premium)' + ( isAlpha ? ' [ALPHA-VERSION]' : '' ) + '$2')
//       newContent = newContent.replace(/(Copyright \(C\).*\r?\n)[\s\S]+?\*\//, '$1*/')
//       return newContent
//     }
//   }
// };
// createTarget(target_premium)
