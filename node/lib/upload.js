// import EventEmitter from 'events'
var path = require('path')
var fs = require('fs')
var stream = require('stream')
var EventEmitter = require('events')
var crypto = require('crypto')

import { dialog } from 'electron' 
import request from 'request'

import registerCommandHandlers from './command'
import { getMainWindow } from './window'
import store from '../serve/store/store'

var sendMessage = null
var c = console.log
var server
var user
var initArgs = () => {
  server = 'http://' + store.getState().config.ip + ':3721'
  user = store.getState().login.obj
}
// describe

// 1 upload operation  
// one upload operation has multiple files (file 0..N or directory 0..N)
// one upload operation has one and only one target

// progress size
// time: start time, estimated time (size to upload / current speed -> last 5 second, upload size)
// concurrency (1)
// cancel -> apply (1) upload operation
// 

// folder task : ready -> running -> end (success or fail) (update children state, reschedule)
// file task: hashless -> hashing -> ready -> running -> end (success or fail (update itself state, reschedule)


let httpRequestConcurrency = 4
let fileHashConcurrency = 4

const scheduleHttpRequest = () => {
  while (runningQueue.length < httpRequestConcurrency && readyQueue.length)
    readyQueue[0].setState('running')
}

const scheduleFileHash = () => {
  while (hashingQueue.length < fileHashConcurrency && hashlessQueue.length) 
    hashlessQueue[0].setState('hashing')
}

/*
 * running queue and ready queue contains both file and folder task
 * runningQueue enter: when scheduling request
 * runningQueue exit: when request finish/callback, may setImmediate / nextTick ???
 * readyQueue enter: folder task create, file hashed
 * readyQueue exit: when scheduling request
 */
const runningQueue = []
const readyQueue = []

const addToRunningQueue = (task) => {
  runningQueue.push(task)
}

const removeOutOfRunningQueue = (task) => {
  runningQueue.splice(runningQueue.indexOf(task), 1)
  scheduleHttpRequest()
}

const addToReadyQueue = (task) => {
  readyQueue.push(task)
  scheduleHttpRequest()
}

const removeOutOfReadyQueue = (task) => {
  readyQueue.splice(readyQueue.indexOf(task), 1)
}

/*
 * hashing queue and hashing ready queue contains only file task
 *
 * hashingQueue enter: when scheduling hashing
 * hashingQueue exit: when hash finish/callback
 * hashlessQueue enter: when file task create
 * hashlessQueue exit: when scheduling hash
 */
const hashingQueue = []
const hashlessQueue = []

const addToHashingQueue = (task) => {
  hashingQueue.push(task)
}

const removeOutOfHashingQueue = (task) => {
  hashingQueue.splice(hashingQueue.indexOf(task),1)
  scheduleFileHash()
}

const addHashlessQueue = (task) => {
  hashlessQueue.push(task)
  scheduleFileHash()
}

const removeOutOfHashlessQueue = (task) => {
  hashlessQueue.splice(hashlessQueue.indexOf(task),1)

}

const userTasks = []

class UserTask extends EventEmitter {

  constructor(type, files, target) {
    super()
    // case 1: multiple folders
    // case 2: multiple files
    this.roots = []
    if (type === 'file') {
      this.type = 'file'
      files.forEach(file => {
        this.roots.push(createFileUploadTask(null, file, target, null))
      })
    }
    else {
      this.type = 'folder'
      files.forEach(folder => {
        this.roots.push(createFolderUploadTask(null, folder, target, null))
      })
    }
  }
}

const createUserTask = (type, files, target) => {
  let userTask = new UserTask(type, files, target)
  userTasks.push(userTask)
  sendUploadMessage()
}

var sendMessage = null
var updateStatusOfupload = () => {
  let mainWindow = getMainWindow()
  mainWindow.webContents.send('refreshStatusOfUpload',userTasks)
}
const sendUploadMessage = () => {
  let isSend = false
    for (var i = 0; i < userTasks.length; i++) {
      for (var j = 0;j < userTasks[i].roots.length;j++) {
        if (userTasks[i].type == 'folder' && userTasks[i].roots[j].finishCount !== userTasks[i].roots[j].children.length ) {
          isSend = true
          break
        }
        if (userTasks[i].type == 'file' && userTasks[i].roots[j].state !== 'finished') {
          isSend = true
          break
        }
      }
    }

  if (isSend && sendMessage==null) {
    c('begin send message ...')
    sendMessage = setInterval(()=> {
        updateStatusOfupload()
        // dispatch(action.setUpload(userTasks))

      },1000)
  }else if(!isSend && sendMessage != null) {
    c('stop send message ...')
    updateStatusOfupload()
    clearInterval(sendMessage)
    sendMessage = null
  }
}

setInterval(() => {
  sendUploadMessage()
},5000)

const folderStats = (abspath, callback) => {
  fs.readdir(abspath, (err, entries) => {
    if (err) return callback(err)
    if (entries.length === 0) 
      return callback(null, [])
    let count = entries.length
    let xstats = []
    entries.forEach(entry => {
      fs.lstat(path.join(abspath, entry), (err, stats) => {
        if (!err) {
          if (stats.isFile() || stats.isDirectory())
            xstats.push(Object.assign(stats, { abspath: path.join(abspath, entry) }))
        }
        if (!--count) callback(null, xstats)
      })
    })
  })
}

const hashFile = (abspath, callback) => {
  c(' ')
  c('hash : ' + path.basename(abspath))
  let hash = crypto.createHash('sha256')
  hash.setEncoding('hex')
  let fileStream = fs.createReadStream(abspath)
  fileStream.on('end',(err) => {
      if (err) {
        callback(err)
      }
      hash.end()
      let sha = hash.read()
      c(path.basename(abspath) + ' hash value : ' + sha)
      callback(null,sha)
    }
  )
  fileStream.pipe(hash) 
}

const createFileUploadTask = (parent, file, target, root) => {
  c(' ')
  c('create file : ' + path.basename(file.abspath))
  let task = new fileUploadTask(parent, file, target, root)
  task.setState('hashless')
  return task
}

class fileUploadTask extends EventEmitter {

  constructor(parent, file, target, root) {
    super()
    this.abspath = file.abspath
    this.size = file.size
    this.progress = 0
    this.target = target
    this.parent = parent
    this.type = 'file'
    this.name = path.basename(file.abspath)
    this.isRoot = true
    if (this.parent) {
      this.parent.children.push(this)
      this.root = root
      this.isRoot = false
    }
    this.state = null
  }

  setState(newState,...args) {
    c(' ')
    // c('setState : ' + newState + '(' + this.state +')' + ' ' + path.basename(this.abspath))
    switch (this.state) {
      case 'hashless':
        this.exitHashlessState()
        break;
      case 'hashing':
        this.exitHashingState()
        break;
      case 'ready':
        this.exitReadyState()
        break;
      case 'running':
        this.exitRunningState()
        break;
      default:
        break
    }

    switch (newState) {
      case 'hashless':
        this.enterHashlessState(...args)
        break
      case 'hashing':
        this.enterHashingState(...args)
        break
      case 'ready':
        this.enterReadyState(...args)
        break
      case 'running':
        this.enterRunningState(...args)
        break
      case 'finished':
        this.enterFinishedState(...args)
        break
      default:
        break
    }
  }

  enterHashlessState() {
    this.state = 'hashless'
    addHashlessQueue(this)
  }

  exitHashlessState() {
    removeOutOfHashlessQueue(this)
  }

  enterHashingState() {
    this.state = 'hashing'
    addToHashingQueue(this)
    hashFile(this.abspath, (err,sha) => {
      if (err) {
        this.setState('finish',err)
        return
      }
      this.sha = sha
      this.setState('ready')
    })
  }

  exitHashingState() {
    removeOutOfHashingQueue(this)
  }

  enterReadyState() {
    this.state = 'ready'
    addToReadyQueue(this)
  }

  exitReadyState() {
    removeOutOfReadyQueue(this)
  }

  enterRunningState() {
    var _this = this
    this.state = 'running'
    addToRunningQueue(this)
    let body = 0
    let transform = new stream.Transform({
      transform: function(chunk, encoding, next) {
        body+=chunk.length;
        _this.progress = body / _this.size
        this.push(chunk)
        next();
      }
    })
    var tempStream = fs.createReadStream(this.abspath).pipe(transform);
    tempStream.path = this.abspath
    var options = {
      url:server+'/files/' + this.target,
      method:'post',
      headers: {
        Authorization: user.type+' '+user.token
      },
      formData : {
        'sha256' : this.sha,
        'file' : tempStream
      }
    }
    this.handle = request(options, (err, res, body) => {
      if (!err && res.statusCode == 200) {
        c('upload file ' + path.basename(_this.abspath) + 'success')
        if (_this.root) {
          _this.root.success++
        }
        _this.progress = 1
        _this.setState('finished', null, JSON.parse(body).uuid)
      }else {
        c('upload file ' + path.basename(_this.abspath) + 'failed')
        if (_this.root) {
          _this.root.failed++
        }
        _this.progress = 1.01
        _this.setState('finished', err, null)
      }
    })
  }

  exitRunningState() {
    this.handle = null
    removeOutOfRunningQueue(this)
  }

  enterFinishedState(err,uuid) {
    if (this.parent) {
      this.parent.childrenFinish()
    }
    this.state = 'finished'
    this.message = err ? err.message : null
  }
}

// factory 
const createFolderUploadTask = (parent, folder, target, root) => {
  c(' ')
  c('create folder : ' + path.basename(folder.abspath))
  c(folder)
  let task = new folderUploadTask(parent, folder, target, root)
  // task.enterReadyState()
  task.setState('ready')
  return task
}

// state machine pattern
// ready -> running -> end
class folderUploadTask extends EventEmitter {

  constructor(parent, folder, target, root) {

    super()
    this.abspath = folder.abspath
    this.name = path.basename(folder.abspath)
    this.progress = 0
    this.target = target // uuid
    this.type = 'folder'
    // structural
    this.parent = parent
    this.children = []
    this.isRoot = true
    if (this.parent) {
      this.parent.children.push(this)
      this.root = root
      this.isRoot = false
    }else {
      this.root = this
      this.success = 0
      this.failed = 0
    }
    this.state = null
    this.finishCount = 0
  }

  setState(newState, ...args) {
    c(' ')
    // c('setState : ' + newState + '(' + this.state +')' + ' ' + path.basename(this.abspath))
    switch (this.state) {
      case 'ready':
        this.exitReadyState()
        break
      case 'running':
        this.exitRunningState()
        break
      case 'probing':
        this.exitProbingState()
        break
      default:
        break
    }

    switch (newState) {
      case 'ready':
        this.enterReadyState(...args)
        break
      case 'running':
        this.enterRunningState(...args)
        break
      case 'probing':
        this.enterProbingState(...args)
        break
      case 'finished':
        this.enterFinishedState(...args)
        break
      default:
        break
    }
  }

  enterReadyState() {
    this.state = 'ready'
    addToReadyQueue(this)
  }

  exitReadyState() {
    removeOutOfReadyQueue(this)
  }

  enterRunningState() {
    var _this = this
    this.state = 'running'
    addToRunningQueue(this)

    var options = {
      url:server+'/files/'+this.target,
      method:'post',
      headers: {
        Authorization: user.type+' '+user.token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name:path.basename(this.abspath)
      })
    }
    this.handle = request(options,function (err,res,body) {
      if (!err && res.statusCode == 200) {
        c('create folder ' + path.basename(_this.abspath) + ' success')
        if (_this.root) {
          _this.root.success++
        }
        _this.uuid = JSON.parse(body).uuid
        // c('uuid is : ' + _this.uuid)
        _this.setState('probing')
      }else {
        if (_this.root) {
          _this.root.failed++
        }
        c('create folder ' + path.basename(_this.abspath) + ' failed')
        c(err)
        _this.setState('finished', err)
      }
    })
  }

  exitRunningState() {
    this.handle = null
    removeOutOfRunningQueue(this)
  }

  enterProbingState() {
    this.state = 'probing'
    let _this = this
    folderStats(this.abspath, (err, xstats) => {
      // event handler
      if (err) {
        this.setState('finished', err)
        return
      }
  
      xstats.forEach(xstat => {
        let r = _this.root?_this.root:_this
        if (xstat.isDirectory()) {
          createFolderUploadTask(_this, xstat, _this.uuid, r)
        }
        else if (xstat.isFile()) {
          createFileUploadTask(_this, xstat, _this.uuid, r)
        }
      })

      this.setState('finished')
    })    
  }

  exitProbingState() {
    if (!this.children.length && this.parent) {
      this.parent.childrenFinish()
    }
  }

  enterFinishedState(err) {
    this.state = 'finished'
    this.message = err ? err.message : null
  }

  childrenFinish() {
    // c(path.basename(this.abspath) + ' run children finish : ' + ' ___________________________________')
    this.finishCount++
    // c('finish count is ' + this.finishCount)
    // c('children length is ' + this.children.length)
    if (this.finishCount == this.children.length && this.parent) {
      // c(path.basename(this.abspath) + ' is over------------------------------------------------')
      this.parent.childrenFinish()
    }else if (this.finishCount == this.children.length && !this.parent) {
      c(path.basename(this.abspath) + ' is absolute over------------------------------------------------')
      updateStatusOfupload()
    }
  }
}

const uploadHandle = (args, callback) => {
  initArgs()
  let folderUUID = args.folderUUID
  let dialogType = args.type=='folder'?'openDirectory':'openFile'
  dialog.showOpenDialog({properties: [ dialogType,'multiSelections','createDirectory']},function(data){
    if (!data) {
      callback('get list err',null)
      return
    }
    let index = 0
    let count = data.length
    let uploadArr = []
    let readUploadInfor = (abspath) => {
      fs.stat(abspath,(err, infor) => {
        if (err) {

        }else {
          uploadArr.push(Object.assign({},infor,{abspath:abspath})) 
        }
        index++
        if(index < count) {
          readUploadInfor(data[index])
        }else {
          createUserTask(args.type,uploadArr,folderUUID,callback)
        }
      })
    }
    readUploadInfor(data[index])
  })
}

const uploadCommandMap = new Map([
  ['UPLOAD_FOLDER', uploadHandle],
  ['UPLOAD_FILE', uploadHandle]
])

registerCommandHandlers(uploadCommandMap)

