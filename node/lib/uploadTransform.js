const Promise = require('bluebird')
const fs = Promise.promisifyAll(require('fs'))
const path = require('path')
const childProcess = require('child_process')
const debug = require('debug')('node:lib:uploadTransform:')
const request = require('request')

const Transform = require('./transform')
const { readXattr, setXattr } = require('./xattr')
const { createFoldAsync, UploadMultipleFiles, serverGetAsync } = require('./server')
const { getMainWindow } = require('./window')
const { Tasks, sendMsg } = require('./transmissionUpdate')

/* return a new file name */
const getName = (name, nameSpace) => {
  let checkedName = name
  const extension = name.replace(/^.*\./, '')
  for (let i = 1; nameSpace.includes(checkedName); i++) {
    if (!extension || extension === name) {
      checkedName = `${name}(${i})`
    } else {
      const pureName = name.match(/^.*\./)[0]
      checkedName = `${pureName.slice(0, pureName.length - 1)}(${i}).${extension}`
    }
  }
  return checkedName
}

class Task {
  constructor(props) {
    /* props: { uuid, entries, dirUUID, driveUUID, taskType, createTime, isNew, policies } */

    this.initStatus = () => {
      Object.assign(this, props)
      this.props = props
      this.completeSize = 0
      this.lastTimeSize = 0
      this.count = 0
      this.finishCount = 0
      this.finishDate = 0
      this.name = props.policies[0] && props.policies[0].checkedName || props.entries[0].replace(/^.*\//, '')
      this.paused = true
      this.restTime = 0
      this.size = 0
      this.speed = 0
      this.lastSpeed = 0
      this.state = 'visitless'
      this.trsType = 'upload'
      this.errors = []
    }

    this.initStatus()

    this.countSpeedFunc = () => {
      if (this.paused) {
        this.speed = 0
        this.restTime = 0
        sendMsg()
        clearInterval(this.countSpeed)
        return
      }
      const speed = this.completeSize - this.lastTimeSize
      this.speed = (this.lastSpeed + speed) / 2
      this.lastSpeed = speed
      this.restTime = this.speed && (this.size - this.completeSize) / this.speed
      this.lastTimeSize = this.completeSize
      sendMsg()
    }

    this.reqHandles = []

    /* Transform must be an asynchronous function !!! */
    this.readDir = new Transform({
      name: 'readDir',
      concurrency: 4,
      transform(x, callback) {
        const read = async (entries, dirUUID, driveUUID, policies, task) => {
          const files = []
          for (let i = 0; i < entries.length; i++) {
            if (task.paused) throw Error('task paused !')
            const entry = entries[i]
            const policy = policies[i]
            const stat = await fs.lstatAsync(path.resolve(entry))
            task.count += 1
            if (stat.isDirectory()) {
              /* create fold and return the uuid */
              const dirname = policy.mode === 'rename' ? policy.checkedName : entry.replace(/^.*\//, '')
              const dirEntry = await createFoldAsync(driveUUID, dirUUID, dirname, entries, policy)
              const uuid = dirEntry.uuid

              /* read child */
              const children = await fs.readdirAsync(path.resolve(entry))
              const newEntries = []
              children.forEach(c => newEntries.push(path.join(entry, c)))

              /* mode 'merge' should apply to children */
              const childPolicies = []
              childPolicies.length = newEntries.length
              childPolicies.fill({ mode: policy.mode }) // !!! fill with one object, all shared !!!
              if (policy.mode === 'rename' || policy.mode === 'replace') childPolicies.fill({ mode: 'normal' })
              // debug('childPolicies', childPolicies)
              this.push({ entries: newEntries, dirUUID: uuid, driveUUID, policies: childPolicies, task })
            } else {
              task.size += stat.size
            }
            files.push({ entry, stat, policy })
          }
          return ({ files, dirUUID, driveUUID, task, entries })
        }
        const { entries, dirUUID, driveUUID, policies, task } = x
        read(entries, dirUUID, driveUUID, policies, task).then(y => callback(null, y)).catch(callback)
      }
    })

    this.hash = new Transform({
      name: 'hash',
      concurrency: 4,
      push(x) {
        const { files, dirUUID, driveUUID, task } = x
        // debug('this.hash push', { files, dirUUID, driveUUID })
        files.forEach((f) => {
          if (f.stat.isDirectory()) {
            this.outs.forEach(t => t.push(Object.assign({}, f, { dirUUID, driveUUID, task, type: 'directory' })))
          } else {
            this.pending.push(Object.assign({}, f, { dirUUID, driveUUID, task }))
            this.schedule()
          }
        })
      },
      transform: (x, callback) => {
        const { entry, dirUUID, driveUUID, stat, policy, task } = x
        if (task.state !== 'uploading' && task.state !== 'diffing') task.state = 'hashing'
        readXattr(entry, (error, attr) => {
          if (!error && attr && attr.parts) {
            callback(null, { entry, dirUUID, driveUUID, parts: attr.parts, type: 'file', stat, policy, task })
            return
          }
          const options = {
            env: { absPath: entry, size: stat.size, partSize: 1024 * 1024 * 1024 },
            encoding: 'utf8',
            cwd: process.cwd()
          }
          const child = childProcess.fork(path.join(__dirname, './filehash'), [], options)
          child.on('message', (result) => {
            setXattr(entry, result, (err, xattr) => {
              callback(null, { entry, dirUUID, driveUUID, parts: xattr && xattr.parts, type: 'file', stat, policy, task })
            })
          })
          child.on('error', callback)
        })
      }
    })

    this.diff = new Transform({
      name: 'diff',
      concurrency: 4,
      push(x) {
        if (x.type === 'directory' || !(x.policy.mode === 'merge' || x.policy.mode === 'overwrite') && x.task.isNew) {
          this.outs.forEach(t => t.push([x]))
        } else {
          /* combine to one post */
          const { dirUUID, policy } = x
          const i = this.pending.findIndex(p => p[0].dirUUID === dirUUID && policy.mode === p[0].policy.mode)
          if (i > -1) {
            this.pending[i].push(x)
          } else {
            this.pending.push([x])
          }
          this.schedule()
        }
      },

      transform: (X, callback) => {
        const diffAsync = async (local, driveUUID, dirUUID, task) => {
          const listNav = await serverGetAsync(`drives/${driveUUID}/dirs/${dirUUID}`)
          const remote = listNav.entries
          if (!remote.length) return local
          const map = new Map() // compare hash and name
          const nameMap = new Map() // only same name
          const nameSpace = [] // used to check name
          local.forEach((l) => {
            const name = l.policy.mode === 'rename' ? l.policy.checkedName : l.entry.replace(/^.*\//, '')
            const key = name.concat(l.parts[l.parts.length - 1].fingerprint) // local file's key: name + fingerprint
            map.set(key, l)
            nameMap.set(name, key)
            nameSpace.push(name)
          })
          // debug('diffAsync map', map, remote)
          remote.forEach((r) => {
            const rKey = r.name.concat(r.hash) // remote file's key: name + hash
            if (map.has(rKey)) {
              task.finishCount += 1
              // debug('this.diff transform find already finished', task.finishCount, r.name)
              task.completeSize += map.get(rKey).stat.size
              map.delete(rKey)
            }
            if (nameMap.has(r.name)) nameMap.delete(r.name)
            else nameSpace.push(r.name)
          })
          const result = [...map.values()] // local files that need to upload

          /* get files with same name but different hash */
          const nameValue = [...nameMap.values()]
          nameValue.forEach(key => map.delete(key))
          const mapValue = [...map.values()]
          debug('this.diff transform', X.length, X[0].entry, mapValue)
          if (mapValue.length) {
            let mode = mapValue[0].policy.mode
            if (mode === 'merge') mode = 'rename'
            if (mode === 'overwrite') mode = 'replace'
            mapValue.forEach((l) => {
              const name = l.entry.replace(/^.*\//, '') // TODO mode rename but still same name ?
              const checkedName = getName(name, nameSpace)
              const remoteUUID = remote.find(r => r.name === name).uuid
              debug('get files with same name but different hash', { entry: l.entry, mode, checkedName, remoteUUID })
              l.policy = Object.assign({}, { mode, checkedName, remoteUUID }) // important: assign a new object !
            })
          }
          if (!result.length && task.finishCount === task.count && this.readDir.isSelfStopped() && this.hash.isSelfStopped()) {
            task.finishDate = (new Date()).getTime()
            task.state = 'finished'
            clearInterval(task.countSpeed)
            task.updateStore()
            sendMsg()
          }
          return result
        }

        const { driveUUID, dirUUID, task } = X[0]
        if (task.state !== 'uploading') task.state = 'diffing'

        diffAsync(X, driveUUID, dirUUID, task).then(value => callback(null, value)).catch(callback)
      }
    })

    this.upload = new Transform({
      name: 'upload',
      concurrency: 1,
      isBlocked: () => this.paused,
      push(X) {
        X.forEach((x) => {
          if (x.type === 'directory') {
            x.task.finishCount += 1
            this.root().emit('data', x)
          } else {
            /* combine to one post */
            const { dirUUID, policy } = x
            const i = this.pending.findIndex(p => p.length < 10 && p[0].dirUUID === dirUUID && policy.mode === p[0].policy.mode)
            if (i > -1) {
              this.pending[i].push(x)
            } else {
              this.pending.push([x])
            }
          }
        })
        this.schedule()
      },
      transform: (X, callback) => {
        // debug('upload transform start', X.length, X[0].policy)

        const Files = X.map((x) => {
          const { entry, parts, policy, task } = x
          const name = policy.mode === 'rename' ? policy.checkedName : entry.replace(/^.*\//, '')
          const readStreams = parts.map(part => fs.createReadStream(entry, { start: part.start, end: part.end, autoClose: true }))
          for (let i = 0; i < parts.length; i++) {
            const rs = readStreams[i]
            rs.on('data', (chunk) => {
              sendMsg()
              if (task.paused) return
              task.completeSize += chunk.length
            })
            rs.on('end', () => {
              if (task.paused) return
              task.finishCount += 1
              sendMsg()
            })
          }
          return ({ entry, name, parts, readStreams, policy })
        })

        const { driveUUID, dirUUID, task } = X[0]
        task.state = 'uploading'
        const handle = new UploadMultipleFiles(driveUUID, dirUUID, Files, (error) => {
          task.reqHandles.splice(task.reqHandles.indexOf(handle), 1)
          if (error) {
            task.finishCount -= 1
          }
          callback(error, { driveUUID, dirUUID, Files, task })
        })
        task.reqHandles.push(handle)
        handle.upload()
      }
    })

    this.readDir.pipe(this.hash).pipe(this.diff).pipe(this.upload)

    this.readDir.on('data', (x) => {
      const { dirUUID, task } = x
      getMainWindow().webContents.send('driveListUpdate', { uuid: dirUUID })
      // debug('this.readDir.on data', task.finishCount, task.count, this.readDir.isStopped())
      if (task.finishCount === task.count && this.readDir.isStopped() && !task.errors.length) {
        task.finishDate = (new Date()).getTime()
        task.state = 'finished'
        task.compactStore()
        clearInterval(task.countSpeed)
      }
      task.updateStore()
      sendMsg()
    })

    this.readDir.on('step', () => {
      const preLength = this.errors.length
      this.errors.length = 0
      const pipes = ['readDir', 'hash', 'diff', 'upload']
      pipes.forEach((p) => {
        if (!this[p].failed.length) return
        this[p].failed.forEach((x) => {
          if (Array.isArray(x)) x.forEach(c => this.errors.push(Object.assign({ pipe: p }, c, { task: c.task.uuid })))
          else this.errors.push(Object.assign({ pipe: p }, x, { task: x.task.uuid }))
        })
      })
      if (this.errors.length !== preLength) this.updateStore()
      if (this.errors.length > 15 || (this.readDir.isStopped() && this.errors.length)) {
        debug('errorCount', this.errors.length)
        this.paused = true
        clearInterval(this.countSpeed)
        this.state = 'failed'
        this.updateStore()
        sendMsg()
      }
    })
  }

  run() {
    this.paused = false
    this.countSpeed = setInterval(this.countSpeedFunc, 1000)
    this.readDir.push({ entries: this.entries, dirUUID: this.dirUUID, driveUUID: this.driveUUID, policies: this.policies, task: this })
  }

  status() {
    return Object.assign({}, this.props, {
      completeSize: this.completeSize,
      lastTimeSize: this.lastTimeSize,
      count: this.count,
      finishCount: this.finishCount,
      finishDate: this.finishDate,
      name: this.name,
      paused: this.paused,
      restTime: this.restTime,
      size: this.size,
      speed: this.speed,
      lastSpeed: this.lastSpeed,
      state: this.state,
      errors: this.errors,
      trsType: this.trsType
    })
  }

  createStore() {
    if (!this.isNew) return
    const data = Object.assign({}, { _id: this.uuid }, this.status())
    global.db.task.insert(data, err => err && debug(this.name, 'createStore error: ', err))
  }

  updateStore() {
    global.db.task.update({ _id: this.uuid }, { $set: this.status() }, {}, err => err && debug(this.name, 'updateStore error: ', err))
  }

  compactStore() {
    /* it's necessary to compact the data file to avoid size of db growing too large */
    global.db.task.persistence.compactDatafile()
  }

  pause() {
    if (this.paused) return
    this.paused = true
    this.reqHandles.forEach(h => h.abort())
    clearInterval(this.countSpeed)
    this.updateStore()
    sendMsg()
  }

  resume() {
    this.readDir.clear()
    this.initStatus()
    this.isNew = false
    this.run()
    sendMsg()
  }
}

const createTask = (uuid, entries, dirUUID, driveUUID, taskType, createTime, isNew, policies, preStatus) => {
  const task = new Task({ uuid, entries, dirUUID, driveUUID, taskType, createTime, isNew, policies })
  Tasks.push(task)
  task.createStore()
  debug('createTask', preStatus)
  if (preStatus) Object.assign(task, preStatus, { isNew: false, paused: true, speed: 0, restTime: 0 })
  else task.run()
  sendMsg()
}


export { createTask }