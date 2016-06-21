import express from 'express'
import Socket from 'socket.io'

const app = express.createServer()
const io = new Socket(app)

app.listen(32123)
