import React from 'react'
import Debug from 'debug'
import Radium from 'radium'
import { Avatar, CircularProgress, Divider } from 'material-ui'
import RightIcon from 'material-ui/svg-icons/hardware/keyboard-arrow-right'
import CloudDoneIcon from 'material-ui/svg-icons/file/cloud-done'
import CloudOffIcon from 'material-ui/svg-icons/file/cloud-off'
import WifiIcon from 'material-ui/svg-icons/notification/wifi'
import LocalLogin from './LocalLogin'
import FlatButton from '../common/FlatButton'
import Checkmark from '../common/Checkmark'
import { Barcelona } from '../common/Svg'

const debug = Debug('component:Login')
const duration = 300

/* 
  http://res.wx.qq.com/connect/zh_CN/htmledition/js/wxLogin.js
*/

let wxiframe
const wxlogin = function (a, b, c) {
  function d(a) {
    let c = 'default'
    a.self_redirect === !0 ? c = 'true' : a.self_redirect === !1 && (c = 'false')
    const d = b.createElement('iframe')
    wxiframe = d
    let e = `https://open.weixin.qq.com/connect/qrconnect?appid=${a.appid}&scope=${a.scope}&redirect_uri=${a.redirect_uri}&state=${a.state}&login_type=jssdk&self_redirect=${c}`;
    e += a.style ? `&style=${a.style}` : ''
    e += a.href ? `&href=${a.href}` : ''
    d.src = e
    d.frameBorder = '0'
    d.allowTransparency = 'true'
    d.scrolling = 'no'
    d.width = '300px'
    d.height = '400px'
    const f = b.getElementById(a.id);
    f.innerHTML = ''
    f.appendChild(d)
  }
  a.WxLogin = d
}

wxlogin(window, document)

@Radium
class DeviceList extends React.PureComponent {
  render() {
    const { list, primaryColor } = this.props
    return (
      <div
        style={{
          height: 72,
          width: '100%',
          paddingLeft: 48,
          boxSizing: 'border-box',
          display: 'flex',
          alignItems: 'center',
          ':hover': { backgroundColor: '#EEEEEE' }
        }}
      >
        {
          list.type === 'remote'
            ? list.accessible
            ? <CloudDoneIcon color={primaryColor} />
            : <CloudOffIcon color="rgba(0,0,0,0.54)" />
            : list.accessible
            ? <WifiIcon color={primaryColor} />
            : <WifiIcon color="rgba(0,0,0,0.54)" />
        }
        <div style={{ marginLeft: 24 }}>
          <div style={{ color: 'rgba(0,0,0,0.87)', lineHeight: '24px' }}>
            { list.name }
          </div>
          <div style={{ color: 'rgba(0,0,0,0.54)', fontSize: 14, lineHeight: '20px' }}>
            { list.type === 'remote' ? 'remote' : list.ip }
          </div>
        </div>
      </div>
    )
  }
}

class LoginApp extends React.Component {

  constructor(props) {
    super(props)

    this.state = {
      local: false,
      dim: true,
      hello: true,
      error: '', // '', 'net', 'wisnuc'
      wechatLogin: '', // '', 'progress', 'authorization', 'getingList', 'success', 'lastDevice', 'list', 'fail'
      count: 3,
      lists: [
        {
          name: '公司的闻上盒子',
          ip: '120.160.23.1',
          type: 'remote',
          accessible: true,
          token: 'token123'
        },
        {
          name: '书房的NAS',
          ip: '192.0.0.103',
          type: 'local',
          accessible: true,
          token: 'token123'
        },
        {
          name: '朋友A',
          ip: '110.198.54.9',
          type: 'remote',
          accessible: false,
          token: ''
        },
        {
          name: '新盒子',
          ip: '192.0.0.104',
          type: 'local',
          accessible: false,
          token: ''
        }
      ]
    }

    this.toggleMode = () => {
      clearInterval(this.interval)
      this.setState({ local: !this.state.local, wechatLogin: '', count: 3 })
    }

    this.done = (view, device, user) => {
      this.doneAsync(view, device, user).asCallback()
    }

    this.autologin = () => {
      debug(this.props)
      if (!this.props.selectedDevice) return

      const users = this.props.selectedDevice.users
      if (users.isPending() || users.isRejected()) return

      const uuid = '511eecb5-0362-41a2-ac79-624ac5e9c03f'
      const password = 'w'
      this.props.selectedDevice.request('token', { uuid, password }, (err) => {
        if (err) {
          console.log(`err:${err}`)
          this.setState({ wechatLogin: 'fail' })
        } else {
          this.done('LOGIN', this.props.selectedDevice, this.props.selectedDevice.users.data[0])
        }
      })
    }

    this.countDown = () => {
      clearInterval(this.interval)
      let count = 3
      this.interval = setInterval(() => {
        if (count > 0) {
          count -= 1
          this.setState({ count: this.state.count -= 1 })
        } else {
          clearInterval(this.interval)
          this.autologin()
        }
      }, 1000)
    }

    this.QRScaned = () => {
      clearInterval(this.interval)
      this.setState({ wechatLogin: 'connecting', count: 3 })
      setTimeout(() => this.setState({ wechatLogin: 'authorization' }), 500)
      setTimeout(() => this.setState({ wechatLogin: 'getingList' }), 1000)
      setTimeout(() => this.setState({ wechatLogin: 'success' }), 1500)
      setTimeout(() => this.setState({ wechatLogin: 'lastDevice' }, this.countDown), 3000)
    }

    this.enterList = () => {
      this.setState({ wechatLogin: 'list' })
    }

    this.resetWCL = () => {
      this.setState({ wechatLogin: '' })
    }

    this.login = () => {
      this.setState({ login: true }, () => {
        const wxArgs = new WxLogin({
          id: 'login_container',
          appid: 'wxd7e08af781bea6a2',
          scope: 'snsapi_login',
          redirect_uri: 'http%3A%2F%2Fwxlogin.siyouqun.com',
          state: 'uuid',
          style: '',
          href: ''
        })
      })
    }
  }

  componentDidMount() {
    setTimeout(() => {
      this.setState({ hello: false })
      this.login()
    }, 300)

    /* catch CODE of wechat login */
    window.onbeforeunload = () => {
      return true
      console.log(wxiframe.contentWindow.wx_code)
      return false // This will stop the redirecting.
    }
  }

  async doneAsync(view, device, user) {
    await Promise.delay(360)
    if (view === 'maintenance') { this.props.maintain() } else {
      this.props.ipcRenderer.send('LOGIN', device, user)
      this.props.login()
    }
  }

  renderWechatLogin() {
    let text = ''
    const wcl = this.state.wechatLogin
    switch (wcl) {
      case 'connecting' :
        text = '连接服务器中...'
        break
      case 'authorization' :
        text = '正在进行权限认证...'
        break
      case 'getingList' :
        text = '正在获取设备列表...'
        break
      case 'success' :
        text = '成功获取设备列表'
        break
      default:
        text = ''
        break
    }

    if (!wcl) return (<div />)

    if (wcl === 'fail') {
      return (
        <div style={{ width: 380, height: 540, backgroundColor: '#FAFAFA', zIndex: 100 }}>
          {/* title */}
          <div style={{ height: 72, backgroundColor: '#FAFAFA', display: 'flex', alignItems: 'center' }} >
            <div style={{ marginLeft: 24 }} >
              { '登录失败' }
            </div>
          </div>
          <Divider />
          <div style={{ height: 24 }} />

          {/* content */}
          <div style={{ height: 400, marginLeft: 24, width: 332 }}>
            <div style={{ fontSize: 16, marginBottom: 12, color: 'rgba(0,0,0,0.87)' }}>
              请确定您是否拥有WISNUC品牌硬件产品或正在使用安装有WISNUC OS的硬件设备。
            </div>
            <div style={{ height: 24 }} />
            <div style={{ fontSize: 16, marginBottom: 12, color: 'rgba(0,0,0,0.87)' }}>
              1. 您可能尚未初始化设备
            </div>
            <div style={{ height: 24 }} />
            <div style={{ fontSize: 16, marginBottom: 12, color: 'rgba(0,0,0,0.87)' }}>
              2. 您可能尚未绑定微信
            </div>
            <div style={{ height: 24 }} />
            <div style={{ fontSize: 16, marginBottom: 12, color: 'rgba(0,0,0,0.87)' }}>
              3. 您可能尚未加入私有群
            </div>
          </div>

          {/* button */}
          <div style={{ display: 'flex' }}>
            <div style={{ flexGrow: 1 }} />
            <FlatButton
              label="返回"
              labelStyle={{ color: '#424242', fontWeight: 500 }}
              onTouchTap={this.resetWCL}
            />
          </div>
        </div>
      )
    }


    return (
      <div style={{ width: 380, height: 540, backgroundColor: '#FAFAFA', zIndex: 100 }}>
        <div style={{ height: 72, backgroundColor: '#FAFAFA', display: 'flex', alignItems: 'center' }} >
          <div style={{ marginLeft: 24 }} >
            { wcl === 'lastDevice' ? '上次登录的设备' : wcl === 'list' ? '请选择登录设备' : '登录设备' }
          </div>
        </div>
        <Divider />
        {
          wcl === 'lastDevice'
            ? <div>
              <div style={{ height: 312, marginLeft: 24, width: 332, display: 'flex', flexDirection: 'column' }}>
                <div style={{ flexGrow: 1 }} />

                {/* Icon */}
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <div style={{ borderRadius: 48, width: 96, height: 96, overflow: 'hidden' }}>
                    <img
                      width={96}
                      height={96}
                      alt=""
                      src="../../Desktop/test.jpg"
                      style={{ filter: 'grayscale(10%)' }}
                    />
                  </div>
                </div>

                {/* Name */}
                <div style={{ height: 24 }} />
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  { 'Test' }
                </div>
                <div style={{ flexGrow: 1 }} />
                <div style={{ display: 'flex' }}>
                  <div style={{ height: 80, width: 80, display: 'flex', alignItems: 'center' }}>
                    <Barcelona color="rgba(0,0,0,0.54)" style={{ width: 56, height: 56 }} />
                  </div>
                  <div>
                    <div style={{ height: 8 }} />
                    <div style={{ fontSize: 16, lineHeight: '24px', color: 'rgba(0,0,0,0.87)' }}> { '闻上盒子' } </div>
                    <div style={{ fontSize: 14, lineHeight: '20px', color: 'rgba(0,0,0,0.54)' }}> { 'ws215i' } </div>
                    <div style={{ fontSize: 14, lineHeight: '20px', color: 'rgba(0,0,0,0.54)' }}> { '10.10.9.103' } </div>
                  </div>
                </div>
                <div style={{ height: 8 }} />
              </div>
              <Divider />
              <div style={{ height: 32 }} />
              <div
                style={{
                  height: 80,
                  fontSize: 16,
                  fontWeight: 500,
                  color: 'rgba(0,0,0,0.87)',
                  textAlign: 'center'
                }}
              >
                <span style={{ fontSize: 34 }}> { this.state.count } </span> 秒后将登录
              </div>
              <div style={{ display: 'flex' }}>
                <div style={{ flexGrow: 1 }} />
                <FlatButton
                  label="可登录设备列表"
                  labelPosition="before"
                  labelStyle={{ color: '#424242', fontWeight: 500 }}
                  onTouchTap={this.enterList}
                  icon={<RightIcon color="#424242" />}
                />
              </div>
            </div>
            :
            <div>
              <div style={{ height: 16 }} />
              <div style={{ height: 270, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {
                  wcl === 'list'
                  ? <div style={{ width: '100%' }}>
                    {
                      this.state.lists.map(list => (<DeviceList list={list} primaryColor={this.props.primaryColor} key={list.name} />))
                    }
                  </div>
                  : wcl === 'success'
                  ? <Checkmark delay={300} color={this.props.primaryColor} />
                  : <CircularProgress size={64} thickness={5} />
                }
              </div>
              <div style={{ height: 36 }} />
              <div style={{ textAlign: 'center', color: 'rgba(0,0,0,0.87)', fontSize: 20, height: 36 }}>
                { text }
              </div>
            </div>
        }
      </div>
    )
  }

  renderCard() {
    return (
      <div style={{ zIndex: 100, opacity: this.state.hello ? 0 : 1, transition: `opacity ${duration}ms` }}>
        {
          !this.state.error ?
            <div style={{ width: 380, height: 540, backgroundColor: '#FAFAFA' }}>
              <div style={{ height: 42 }} />
              {/* <div style={{ width: 270, height: 270, margin: 'auto', backgroundColor: 'grey' }} /> */}
              <div style={{ height: 406, width: 300, margin: 'auto' }} id="login_container" />
              <div style={{ height: 36 }} />
              {/*
              <div style={{ textAlign: 'center', color: 'rgba(0,0,0,0.87)', fontSize: 20 }}>
                请使用手机微信扫码登陆
              </div>
              <div style={{ height: 24 }} />
              <div style={{ textAlign: 'center', color: 'rgba(0,0,0,0.54)', fontSize: 16 }}>
                客户端远程登陆需要配合手机使用
              </div>
              */}
            </div>
            :
            <div style={{ width: 380, height: 540, backgroundColor: '#FAFAFA' }}>
              <div
                style={{
                  width: 270,
                  height: 270,
                  margin: '42px auto 12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <img
                  width={96}
                  height={96}
                  alt=""
                  src="../src/assets/images/index/icon.png"
                  style={{ filter: 'grayscale(100%)' }}
                />
              </div>
              <div style={{ height: 24 }} />
              <div style={{ textAlign: 'center', color: 'rgba(0,0,0,0.87)', fontSize: 20 }}>
                { this.state.error === 'net' ? '网络连接已断开' : '云服务已断开' }
              </div>
              <div style={{ height: 24 }} />
              <div style={{ textAlign: 'center', color: 'rgba(0,0,0,0.54)', fontSize: 20 }}>
                { this.state.error === 'net' ? '请检查您的网络设置' : '请您稍后登录或局域网登录' }
              </div>
            </div>
        }
      </div>
    )
  }

  render() {
    return (
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        {/* background */}
        <div
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            filter: 'blur(4px)',
            opacity: this.state.hello ? 0 : 1,
            transition: `opacity ${duration}ms`
          }}
        >
          <img
            style={{ position: 'absolute', width: '100%', height: '100%', zIndex: -1000 }}
            src="../src/assets/images/index/index.jpg"
            alt=""
          />
        </div>

        {/* Icon */}
        <div style={{ position: 'absolute', top: -16, left: 24 }} >
          <img
            width={96}
            height={96}
            alt=""
            src="../src/assets/images/index/wisnuc.png"
            style={{ filter: 'brightness(5000%)' }}
            onTouchTap={this.QRScaned}
          />
        </div>

        {/* change mode button */}
        <div
          style={{
            position: 'absolute',
            top: 32,
            right: 16,
            display: 'flex',
            alignItems: 'center'
          }}
        >
          <FlatButton
            label={this.state.local ? '微信扫码登录' : '局域网登录'}
            labelPosition="before"
            labelStyle={{ color: '#FAFAFA', fontWeight: 500 }}
            onTouchTap={this.toggleMode}
            icon={<RightIcon color="#FAFAFA" />}
          />
        </div>

        {/* copyright */}
        <div
          style={{
            position: 'absolute',
            bottom: 24,
            right: 24,
            fontSize: 14,
            color: '#FAFAFA',
            display: 'flex',
            alignItems: 'center'
          }}
        >
          ©2016 - 2017 上海闻上信息科技有限公司 版权所有
        </div>

        {/* login card */}
        { !this.state.local ? this.state.wechatLogin ? this.renderWechatLogin() : this.renderCard() : <LocalLogin {...this.props} />}
      </div>
    )
  }
}

export default LoginApp
