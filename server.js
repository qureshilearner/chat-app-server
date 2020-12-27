var express = require('express')
var body = require('body-parser')
let passport = require('passport')
var { MongoClient, ObjectId } = require('mongodb')

var app = express()
const server = require('http').createServer(app)
var io = require('socket.io')(server)

let port = 4000 || process.env
let db
// currentUser = ''

app.use(body.json())
app.use(body.urlencoded({ extended: true }))
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.set('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE')
  res.header('Access-Control-Allow-Headers', '*')
  next()
})

let clint,
  onlineUsers = []
io.on('connection', (client) => {
  clint = client
  console.log('Connected')
  client.on('disconnect', (_) => console.log('User Is Dissconnected'))
  client.on('isActive', (t) => console.log(t))
  client.on('onlineUser', async (name) => {
    const res = await db.collection('onlineUsers').find({}).toArray()
    if (res.length > 0) {
      console.log(name)
      console.log(res[0].names)
      onlineUsers = res[0].names
      client.broadcast.emit('onlineNow', onlineUsers)
      client.emit('onlineNow', onlineUsers)
    }
    // const removeUser = await db.collection("onlineUsers").update({}, { $pull: { names: "xyz" } });
  })

  client.on('broadCastMsg', (msg) => {
    client.broadcast.emit('getMsg', msg), client.emit('getMsg', msg)
  })
})
// mongodb+srv://faizan36268:<password>@cluster0.jqusc.mongodb.net/<dbname>?retryWrites=true&w=majority
;(function mongo() {
  // const url = "mongodb://localhost:27017";
  const url =
    'mongodb+srv://faizan36268:faizan36268@cluster0.jqusc.mongodb.net/testdb?retryWrites=true&w=majority'
  // const dbName = "letsChat";
  // let client;
  try {
    MongoClient.connect(
      url,
      {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      },
      (err, dataBase) => {
        if (err) console.log(err)
        else {
          console.log('Connected successfully to server')
          db = dataBase.db('testdb')
          // db.db()
          server.listen(port, function () {
            console.log(`listen on ${port}`)
          })
        }
      }
    )
  } catch (err) {
    console.log('Not Connected....')
  }
})()

app.get('/m', async function (req, res) {
  try {
    const messages = await db.collection('msgs').find({}).toArray()
    messages.length
      ? res.json({ success: true, messages })
      : res.json({ success: false })
  } catch (err) {
    res.send('err')
  }
})

app.post('/msg', async (req, res) => {
  let { from, date, body } = req.body
  try {
    const data = await db.collection('msgs').insertOne({ from, date, body })
    let msg = await data.ops[0]
    clint.broadcast.emit('getMsg', msg)
    clint.emit('getMsg', msg)
    res.json({ success: true })
  } catch {
    res.json({ success: false })
  }
})

app.post('/authenticate', async (req, res) => {
  let { userName, password } = req.body
  let emitUser
  console.log(userName, password)
  try {
    const data = await db
      .collection('accounts')
      .find({ userName, password })
      .toArray()
    console.log(data)
    data.length > 0
      ? ((emitUser = await db
          .collection('onlineUsers')
          .updateOne(
            { names: { $nin: [userName] } },
            { $push: { names: { $each: [userName], $position: 0 } } },
            { upsert: true }
          )),
        console.log(emitUser.result.n),
        emitUser.result.n > 0
          ? (onlineUsers.unshift(userName),
            clint.broadcast.emit('onlineNow', onlineUsers),
            clint.emit('onlineNow', onlineUsers))
          : null,
        res.json({ success: true }))
      : res.json({ success: false })
  } catch (err) {
    console.log(err)
    res.json({ success: false })
  }
})

app.post('/create-user', async (req, res) => {
  let { email, userName, password } = req.body
  console.log(email, userName, password)
  try {
    const data = await db.collection('accounts').find({ userName }).toArray()
    data.length > 0
      ? res.json({ success: false })
      : await db
          .collection('accounts')
          .insertOne({ email, userName, password }),
      res.json({ success: true })
  } catch (e) {
    console.log(e)
    res.json({ success: false })
  }
})

app.get('/', (_, res) => {
  res.send(<h1>Compiled!</h1>)
})

app.post('/logout', async (req, res) => {
  let { userName } = req.body
  const removeUser = await db
    .collection('onlineUsers')
    .updateOne({}, { $pull: { names: userName } })
  console.log(removeUser.result.n)
  removeUser.result.n > 0
    ? (onlineUsers.splice(onlineUsers.indexOf(userName), 1),
      console.log('Array After Remove : ', onlineUsers),
      clint.broadcast.emit('onlineNow', onlineUsers),
      res.json({ success: true }))
    : res.json({ success: false })
})
