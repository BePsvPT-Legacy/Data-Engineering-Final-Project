import fs from 'fs'
import path from 'path'
import express from 'express'
import http from 'http'
import Socket from 'socket.io'
import Promise from 'bluebird'
import { indexDir } from './helpers'

const app = express()
const server = http.Server(app)
const io = new Socket(server)
const cloudPath = path.join.bind(path, 'cloud')

io.on('connection', (socket) => {
  console.log('New connection')
  indexDir().then((data) => {
    socket.emit('index', data)
  })

  socket.on('index', () => {
    indexDir().then((data) => {
      socket.emit('index', data)
    })
  })

  socket.on('add', (data) => {
    console.log('Add', data.path)
    console.log(data)
    Promise.fromCallback((cb) => {
      fs.mkdirs(path.dirname(data.path))
    }).then(() => {
      return Promise.fromCallback(
        (cb) => fs.writeFile(path.join('cloud', data.path), data.content, cb)
      )
    }).then(() => {
       console.log(data.path, 'writed')
    }).catch((err) => {
      console.log('Write error', err)
    })
  })

  socket.on('rename', (data) => {
    console.log('Rename', data)
    Promise.fromCallback((cb) => {
      fs.move(data.old, data.new, cb)
    }).then(() => {
       console.log(data.old, ' -> ', data.new, ' success')
    }).catch((err) => {
      console.log('Rename error', err)
    })
  })

  socket.on('unlink', (data) => {
    console.log('Remove', data.path)
    Promise.fromCallback((cb) => {
      fs.unlink(cloudPath(data.path), cb)
    }).then(() => {
       console.log(data.path, 'delete')
    }).catch((err) => {
      console.log('Delete error', err)
    })
  })

  socket.on('download', ({ path }) => {
    Promise.fromCallback((cb) => fs.readFile(cloudPath(path), 'utf8', cb))
      .then((content) => {
        socket.emit('download', {
          path,
          content
        })
      })
  })
})

server.listen(32123, '0.0.0.0')
console.log('Server start')
