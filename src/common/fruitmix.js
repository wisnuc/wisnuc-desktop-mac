import Request from './Request'
import request from 'superagent'
import EventEmitter from 'eventemitter3'

const cloudAddress = 'http://10.10.9.87:4000'

/* this module encapsulate most fruitmix apis */
class Fruitmix extends EventEmitter {
  constructor(address, userUUID, token, stationID) {
    super()

    this.address = address
    this.userUUID = userUUID
    this.token = token
    this.bToken = null // box Token
    this.stationID = stationID

    this.state = {
      address,
      userUUID,
      token,
      stationID,
      request: this.request.bind(this),
      requestAsync: this.requestAsync.bind(this),
      pureRequest: this.pureRequest.bind(this),
      pureRequestAsync: this.pureRequestAsync.bind(this)
    }

    this.reqCloud = (ep, data, type) => {
      const url = `${address}/c/v1/stations/${this.stationID}/json`
      const resource = new Buffer(`/${ep}`).toString('base64')
      // console.log('this.reqCloud', type, ep)
      if (type === 'GET') return request.get(url).set('Authorization', this.token).query({ resource, method: type })
      if (data && data.op) {
        const r = request.post(url).set('Authorization', this.token)
        switch (data.op) {
          case 'mkdir':
            return r.send(Object.assign({ resource, method: type, op: 'mkdir', toName: data.dirname }))
          case 'rename':
            return r.send(Object.assign({ resource, method: type, op: 'rename', toName: data.newName, fromName: data.oldName }))
          case 'remove':
            return r.send(Object.assign({ resource, method: type, op: 'remove', toName: data.entryName, uuid: data.entryUUID }))
          case 'dup':
            return r.send(Object.assign({ resource, method: type, op: 'dup', toName: data.newName, fromName: data.oldName }))
        }
      }
      if (data) return request.post(url).set('Authorization', this.token).send(Object.assign({ resource, method: type }, data))
      return request.post(url).set('Authorization', this.token).send(Object.assign({ resource, method: type }))
    }
  }

  setState(name, nextState) {
    const state = this.state
    this.state = Object.assign({}, state, { [name]: nextState })
    this.emit('updated', state, this.state)
  }

  setRequest(name, props, f, next) {
    if (this[name]) {
      this[name].abort()
      this[name].removeAllListeners()
    }

    this[name] = new Request(props, f)
    this[name].on('updated', (prev, curr) => {
      if (this.stationID && this[name].isFinished() && !this[name].isRejected()) {
        curr.data = curr.data.data
      }
      this.setState(name, curr)

      console.log(`${name} updated`, prev, curr, this[name].isFinished(), typeof next === 'function')

      /* save box token */
      if (name === 'boxToken' && !this[name].isRejected()) this.bToken = curr.data.token

      if (this[name].isFinished() && next) {
        this[name].isRejected()
          ? next(this[name].reason())
          : next(null, this[name].value())
      }
    })

    // emit
    this.setState(name, this[name].state)
  }

  clearRequest(name) {
    if (this[name]) {
      this[name].abort()
      this[name].removeAllListeners()
      this[name] = null
      this.setState(name, null)
    }
  }

  aget(ep) {
    if (this.stationID) return this.reqCloud(ep, null, 'GET')
    return request
      .get(`http://${this.address}:3000/${ep}`)
      .set('Authorization', `JWT ${this.token}`)
  }

  cget(ep) {
    if (this.stationID) return this.reqCloud(ep, null, 'GET')
    return request
      .get(`http://${this.address}:3000/${ep}`)
      .set('Authorization', `JWT ${this.bToken} ${this.token}`)
  }
 
  lget(ep) {
    console.log('lget', `${cloudAddress}/c/v1/${ep}`)
    return request
      .get(`${cloudAddress}/c/v1/${ep}`)
      .set('Authorization', this.token)
  }

  apost(ep, data) {
    if (this.stationID) return this.reqCloud(ep, data, 'POST')
    const r = request
      .post(`${cloudAddress}:3000/${ep}`)
      .set('Authorization', `JWT ${this.token}`)

    return typeof data === 'object'
      ? r.send(data)
      : r
  }

  cpost(ep, data) {
    if (this.stationID) return this.reqCloud(ep, data, 'POST')
    const r = request
      .post(`http://${this.address}:3000/${ep}`)
      .set('Authorization', `JWT ${this.bToken} ${this.token}`)

    return typeof data === 'object'
      ? r.send(data)
      : r
  }

  apatch(ep, data) {
    if (this.stationID) return this.reqCloud(ep, data, 'PATCH')
    const r = request
      .patch(`http://${this.address}:3000/${ep}`)
      .set('Authorization', `JWT ${this.token}`)

    return typeof data === 'object'
      ? r.send(data)
      : r
  }

  cpatch(ep, data) {
    if (this.stationID) return this.reqCloud(ep, data, 'PATCH')
    const r = request
      .patch(`http://${this.address}:3000/${ep}`)
      .set('Authorization', `JWT ${this.bToken} ${this.token}`)

    return typeof data === 'object'
      ? r.send(data)
      : r
  }

  aput(ep, data) {
    if (this.stationID) return this.reqCloud(ep, data, 'PUT')
    const r = request
      .put(`http://${this.address}:3000/${ep}`)
      .set('Authorization', `JWT ${this.token}`)

    return typeof data === 'object'
      ? r.send(data)
      : r
  }

  adel(ep, data) {
    if (this.stationID) return this.reqCloud(ep, data, 'DELETE')
    const r = request
      .del(`http://${this.address}:3000/${ep}`)
      .set('Authorization', `JWT ${this.token}`)

    return typeof data === 'object'
      ? r.send(data)
      : r
  }

  cdel(ep, data) {
    if (this.stationID) return this.reqCloud(ep, data, 'DELETE')
    const r = request
      .del(`http://${this.address}:3000/${ep}`)
      .set('Authorization', `JWT ${this.bToken} ${this.token}`)

    return typeof data === 'object'
      ? r.send(data)
      : r
  }

  request(name, args, next) {
    let r

    switch (name) {
      case 'getToken':
        if (this.stationID) {
          r = this.aget('token')
        } else {
          r = request
            .get(`http://${this.address}:3000/token`)
            .auth(args.uuid, args.password)
            .set('Accept', 'application/json')
        }
        break

      case 'users':
        r = this.aget('users')
        break

      case 'drives':
        r = this.aget('drives')
        break

      /* account APIs */
      case 'account':
        r = this.aget(`users/${this.userUUID}`)
        break

      case 'updateAccount':
        r = this.apatch(`users/${this.userUUID}`, args)
        break

      case 'updatePassword':
        if (this.stationID) { // connecting via Cloud, reset password
          r = this.aput(`users/${this.userUUID}/password`, { password: args.newPassword })
        } if (args.stationID) { // login via WeChat and connecting via LAN, rest password
          const url = `${cloudAddress}/c/v1/stations/${args.stationID}/json`
          const resource = Buffer.from(`/users/${this.userUUID}/password`).toString('base64')
          r = request.post(url).set('Authorization', args.token).send({ resource, method: 'PUT', password: args.newPassword })
        } else {
          r = request
            .put(`http://${this.address}:3000/users/${this.userUUID}/password`, { password: args.newPassword })
            .auth(this.userUUID, args.prePassword)
            .set('Accept', 'application/json')
        }
        break

      /* admins APIs */
      case 'adminUsers':
        r = this.aget('admin/users')
        break

      case 'adminUpdateUsers':
        r = this.apatch(`users/${args.userUUID}`, {
          isAdmin: args.isAdmin,
          disabled: args.disabled
        })
        break

      case 'adminCreateUser':
        r = this.apost('users', {
          username: args.username,
          password: args.password
        })
        break

      case 'adminCreateDrive':
        r = this.apost('drives', {
          label: args.label,
          writelist: args.writelist
        })
        break

      case 'adminUpdateDrive':
        r = this.apatch(`drives/${args.uuid}`, {
          label: args.label,
          writelist: args.writelist
        })
        break

      /* File APIs */
      case 'listDir':
        r = this.aget(`drives/${args.driveUUID}`)
        break

      case 'listNavDir':
        r = this.aget(`drives/${args.driveUUID}/dirs/${args.dirUUID}`)
          .query({ metadata: true })
          .query({ counter: true })
        break

      case 'mkdir':
        if (this.stationID) {
          r = this.apost(`drives/${args.driveUUID}/dirs/${args.dirUUID}/entries`, Object.assign({}, args, { op: 'mkdir' }))
        } else {
          r = this.apost(`drives/${args.driveUUID}/dirs/${args.dirUUID}/entries`)
            .field(args.dirname, JSON.stringify({ op: 'mkdir' }))
        }
        break

      case 'renameDirOrFile':
        if (this.stationID) {
          r = this.apost(`drives/${args.driveUUID}/dirs/${args.dirUUID}/entries`, Object.assign({}, args, { op: 'rename' }))
        } else {
          r = this.apost(`drives/${args.driveUUID}/dirs/${args.dirUUID}/entries`)
            .field(`${args.oldName}|${args.newName}`, JSON.stringify({ op: 'rename' }))
        }
        break

      case 'deleteDirOrFile':
        if (this.stationID) {
          r = this.apost(`drives/${args.driveUUID}/dirs/${args.dirUUID}/entries`, Object.assign({}, args, { op: 'remove' }))
        } else {
          r = this.apost(`drives/${args[0].driveUUID}/dirs/${args[0].dirUUID}/entries`)
          for (let i = 0; i < args.length; i++) {
            r.field(args[i].entryName, JSON.stringify({ op: 'remove', uuid: args[i].entryUUID }))
          }
        }
        break

      case 'dupFile':
        if (this.stationID) {
          r = this.apost(`drives/${args.driveUUID}/dirs/${args.dirUUID}/entries`, Object.assign({}, args, { op: 'dup' }))
        } else {
          r = this.apost(`drives/${args.driveUUID}/dirs/${args.dirUUID}/entries`)
            .field(`${args.oldName}|${args.newName}`, JSON.stringify({ op: 'dup' }))
        }
        break

      case 'copy':
        r = this.apost('tasks', args)
        break

      case 'task':
        r = this.aget(`tasks/${args.taskUUID}`)
        break

      /* Ext APIs */
      case 'extDrives':
        r = this.aget('files/external/fs')
        break

      case 'extListDir':
        r = this.aget(`files/external/fs/${args.path}`)
        break

      case 'extMkdir':
        break

      case 'extRenameDirOrFile':
        break

      case 'extDeleteDirOrFile':
        break

      /* Media API */
      case 'media':
        r = this.aget('media')
        break

      case 'blacklist':
        r = this.aget(`users/${this.userUUID}/media-blacklist`)
        break

      case 'addBlacklist':
        if (this.stationID) r = this.apost(`users/${this.userUUID}/media-blacklist`, { blacklist: args })
        else r = this.apost(`users/${this.userUUID}/media-blacklist`, args)
        break

      case 'putBlacklist':
        if (this.stationID) r = this.aput(`users/${this.userUUID}/media-blacklist`, { blacklist: args })
        else r = this.aput(`users/${this.userUUID}/media-blacklist`, args)
        break

      case 'subtractBlacklist':
        if (this.stationID) r = this.adel(`users/${this.userUUID}/media-blacklist`, { blacklist: args })
        else r = this.adel(`users/${this.userUUID}/media-blacklist`, args)
        break

      /* Docker API */
      case 'docker':
        r = request.get('http://10.10.9.86:3000/server')
        break

      /* BT Download API */
      case 'BTList':
        r = this.aget('download')
        break

      case 'addMagnet':
        r = this.apost('download/magnet', { magnetURL: args.magnetURL, dirUUID: args.dirUUID })
        break

      case 'handleMagnet': // op: 'pause', 'resume', 'destroy'
        r = this.apatch(`download/${args.id}`, { op: args.op })
        break

      /* Plugin API */
      case 'samba':
        r = this.aget('features/samba/status')
        break

      case 'dlna':
        r = this.aget('features/dlna/status')
        break

      case 'bt':
        r = this.aget('download/switch')
        break

      /* Box API */
      case 'boxToken':
        r = this.aget('cloudToken').query({ guid: args.guid })
        break

      default:
        break
    }

    if (!r) console.log(`no request handler found for ${name}`)
    else this.setRequest(name, args, cb => r.end(cb), next)
  }

  async requestAsync(name, args) {
    return Promise.promisify(this.request).bind(this)(name, args)
  }

  pureRequest(name, args, next) {
    let r
    let isCloud = !!this.stationID
    switch (name) {
      /* file api */
      case 'listNavDir':
        r = this.aget(`drives/${args.driveUUID}/dirs/${args.dirUUID}`)
          .query({ metadata: true })
        break

      case 'media':
        r = this.aget('media')
        break

      case 'blacklist':
        r = this.aget(`users/${this.userUUID}/media-blacklist`)
        break

      case 'randomSrc':
        r = this.aget(`media/${args.hash}`)
          .query({ alt: 'random' })
        break

      /* task api */
      case 'tasks':
        r = this.aget('tasks')
        break

      case 'task':
        r = this.aget(`tasks/${args.uuid}`)
        break

      case 'deleteTask':
        r = this.adel(`tasks/${args.uuid}`)
        break

      case 'handleTask':
        r = this.apatch(`tasks/${args.taskUUID}/nodes/${args.nodeUUID}`, { policy: args.policy })
        break

      /* Ticket and Wechat API */
      case 'info':
        r = request.get(`http://${this.address}:3000/station/info`)
        break

      case 'creatTicket':
        r = this.apost('station/tickets/', { type: 'bind' })
        break

      case 'getTicket':
        r = this.aget(`station/tickets/${args.ticketId}`)
        break

      case 'getWechatToken':
        r = request
          .get(`${cloudAddress}/c/v1/token`)
          .query({ code: args.code })
          .query({ platform: args.platform })
        isCloud = true
        break

      case 'fillTicket':
        r = request
          .post(`${cloudAddress}/c/v1/tickets/${args.ticketId}/users`)
          .set('Authorization', args.token)
        isCloud = true
        break

      case 'confirmTicket':
        r = this.apost(`station/tickets/wechat/${args.ticketId}`, {
          guid: args.guid,
          state: args.state
        })
        break

      case 'handlePlugin':
        r = this.apost(`features/${args.type}/${args.action}`)
        break

      case 'switchBT':
        r = this.apatch('download/switch', { op: args.op })
        break

      /* box API */
      case 'createBox':
        r = this.cpost('boxes', { name: args.name, users: args.users })
        break

      case 'box':
        if (this.stationID) r = this.lget(`boxes/${args.uuid}`)
        else r = this.cget(`boxes/${args.uuid}`)
        break

      case 'boxes':
        if (this.stationID) r = this.lget('boxes')
        else r = this.cget('boxes')
        break

      case 'delBox':
        r = this.cdel(`boxes/${args.boxUUID}`)
        break

      case 'tweets':
        r = this.cget(`boxes/${args.boxUUID}/tweets`).query({ first: args.first, last: args.last, count: args.count, metadata: true })
        break

      case 'createTweet':
        r = this.cpost(`boxes/${args.boxUUID}/tweets`, { comment: args.comment })
        break

      case 'delTweet':
        r = this.cdel(`boxes/${args.boxUUID}/tweets`, { indexArr: args.indexs })
        break

      case 'nasTweets':
        if (this.stationID) {
          const ep = `boxes/${args.boxUUID}/tweets`
          const url = `${this.address}/c/v1/stations/${this.stationID}/pipe`
          const resource = Buffer.from(`/${ep}`).toString('base64')
          r = request.post(url).set('Authorization', this.token).field('manifest', JSON.stringify({
            resource, method: 'POST', comment: args.comment, type: args.type, indrive: args.list
          }))
        } else {
          r = this.cpost(`boxes/${args.boxUUID}/tweets`)
            .field('list', JSON.stringify({ comment: args.comment, type: args.type, indrive: args.list }))
        }

        break

      case 'handleBoxUser':
        r = this.cpatch(`boxes/${args.boxUUID}`, { users: { op: args.op, value: args.guids } })
        break

      case 'boxName':
        r = this.cpatch(`boxes/${args.boxUUID}`, { name: args.name })
        break

      default:
        break
    }

    if (!r) console.log(`no request handler found for ${name}`)
    else {
      r.end((err, res) => (typeof next === 'function') &&
        next(err, isCloud ? res && res.body && res.body.data : res && res.body))
    }
  }

  async pureRequestAsync(name, args) {
    return Promise.promisify(this.pureRequest).bind(this)(name, args)
  }

  start() {
    this.request('account')
    this.request('users')
    this.requestAsync('drives').asCallback((err, drives) => {
      if (drives) {
        const drive = drives.find(d => d.tag === 'home')
        this.request('listNavDir', { driveUUID: drive.uuid, dirUUID: drive.uuid })
      }
    })
  }
}

export default Fruitmix
