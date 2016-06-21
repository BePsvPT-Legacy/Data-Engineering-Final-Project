import Chokidar from 'chokidar'
import Fs from 'fs'
import Io from 'socket.io-client'
import Md5File from 'md5-file'
import Path from 'path'
import Yargs from 'yargs'

const argv = Yargs.usage('Usage: $0 -s [string] -p [string]').demand(['s','p']).argv

const watcher = Chokidar.watch(argv.p, {
  ignored: /[\/\\]\./, persistent: true
})

const socket = Io.connect(argv.s, {reconnect: true})

socket.on('index', function (data) {
  console.log(data)
})

socket.on('connect', () => {
  // Get server file index
  socket.emit('index');
})

socket.on('disconnect', () => {
  console.log('disconnect')
})

socket.on('error', (err) => {
  console.log(err)
})

let local = path => {
  return `.${Path.sep}local${Path.sep}${path}`
}

const log = console.log.bind(console)

let ready = false

let index = {}

watcher
  .on('add', (path, stats) => {
    path = path.substr(path.indexOf('/') + 1)

    let md5 = Md5File.sync(local(path))

    if (! ready) {
      index[md5] = {
        path: path
      }
    } else {
      Fs.readFile(local(path), (err, content) => {
        socket.emit('addFile', {
          path: path,
          content: content,
          md5: md5
        })

        log(`Upload new file: ${path}`)
      })
    }
  })
  .on('addDir', (path, stats) => {
    // socket.emit('addDir', {
    //   path: path
    // })

    log(`Create new directory: ${path}`)
  })
  .on('change', (path, stats) => {
    log('File', path, 'has been changed')
  })
  .on('unlink', path => {
    log('File', path, 'has been removed')
  })
  .on('unlinkDir', path => {
    log('Directory', path, 'has been removed')
  })

watcher
  .on('ready', () => {
    ready = true
log(index)
    log('Initial scan complete. Ready for changes.')
  })
  .on('error', error => {
    log('Error happened', error)
  })
