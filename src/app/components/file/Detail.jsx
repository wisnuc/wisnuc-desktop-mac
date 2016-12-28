/**
 * @component Detail
 * @description Detail
 * @time 2016-5-10
 * @author liuhua
 **/
  'use strict';
  // require core module
import React, { findDOMNode, Component, PropTypes } from 'react'
import { connect } from 'react-redux'
 //require material
import { Paper, Menu, MenuItem, Checkbox } from 'material-ui'
import {RadioButton, RadioButtonGroup} from 'material-ui/RadioButton'
import {Tabs, Tab} from 'material-ui/Tabs'
//import file mpdule
import { command } from '../../lib/command'

import Debug from 'debug'

const debug = Debug('detail')



const styles = {
	radioIconStyle : {fill:'#5766bd',marginBottom:'20px'},
	radioLabelStyle : {marginLeft:'-10px'},
	buttonStyle : {position:'absolute',left:'0px'}
}

class ShareRow extends Component {
	constructor(props) {
		super(props)
		this.state = {shared:false,state:'ready'}
	}

	render() {
		return (
			<div>{this.props.item.name}</div>
		)
	}
} 

class Detail extends Component {
 	constructor(props) {
 		super(props)
 		this.state = {type:'custom'}
 	}

 	componentWillReceiveProps(next) {
 		debug('detail receive props')
 		debug(next)
 	}

 	shouldComponentUpdate(nextProps) {
 		let nowDetail = this.props.detail
 		let nextDetail = nextProps.detail
 		let nowDetailList = nowDetail[0] && (typeof nowDetail[0].readlist) == 'object'?nowDetail[0].readlist:undefined
 		let nextDetailList = nextDetail[0] && (typeof nextDetail[0].readlist) == 'object'?nextDetail[0].readlist:undefined
 		if (nowDetail.length == 1 && nextDetail.length == 1
 			&& nowDetail[0].uuid == nextDetail[0].uuid
 			&& nowDetailList == nextDetailList) {
 			debug('detail not update....')
 			return false
 		}else if (nowDetail.length !== 1 && nextDetail.length != 1) {
 			debug('detail not update....')
 			return false
 		}else {
 			debug('detail update....')
 			return true
 		}
 	}

 	render() {
 		return (
 			<div className='detail-container'>
	 			<Tabs tabItemContainerStyle={{backgroundColor:'#f3f3f3',color:'#9a9a9a'}}>
		 			<Tab label='详情' style={{color:'#404040',fontSize:'14px'}}>
		 			{this.getDetail()}
		 			</Tab>
		 			<Tab label='分享' style={{color:'#000'}}>
		 			{this.getShare()}
		 			</Tab>
		 		</Tabs>
	 		</div>
 			)
 	}

 	getDetail() {
 		if (this.props.detail.length !== 1) {
 			return (
 				<div className='detail-not-select'>
 					<svg width='107' height='82' viewBox='0 0 107 82' focusable='false' >
 						<path fill='#999' d='M0,4a4,4,0,0,1,4,-4h89a4,4,0,0,1,4,4v18.5l-23.5,40.5h-69.5a4,4,0,0,1,-4,-4ZM74.5,65l23,-39.15l1,0l7,4.1l1,1l-23,39.15ZM74,65.8l9.5,5.5l-9,4ZM97,51v8a4,4,0,0,1,-4,4h-3ZM21,63v19l23,-19Z'></path>
 					</svg>
 					<div className='detail-title'>请选择一个文件或者文件夹</div>
 				</div>)
 		}
 		let data=this.props.detail[0]
 		return (
 			<div>
	 			<div className='file-infor'>
	 				<div className='file-detail-line'><div></div></div>
		 			<div>类型&nbsp;&nbsp;:&nbsp;&nbsp;{data.type?data.type=='folder'?'文件夹':'文件':null}</div>
		 			<div>name&nbsp;&nbsp;:&nbsp;&nbsp;{data.name||null}</div>
		 			<div>大小&nbsp;&nbsp;:&nbsp;&nbsp;{data.type=='folder'?null:(this.getSize(data.size)||null)}</div>
		 			<div title={data.path||null}>位置&nbsp;&nbsp;:&nbsp;&nbsp;{data.path||null}</div>
		 			<div>所有者&nbsp;&nbsp;:&nbsp;&nbsp;{this.getOwner(data.owner)||null}</div>
		 			<div>上传时间&nbsp;&nbsp;:&nbsp;&nbsp;{data.mtime||null}</div>
		 			<div>修改时间&nbsp;&nbsp;:&nbsp;&nbsp;{data.mtime||null}</div>
		 			<div className='file-detail-line'><div></div></div>
	 			</div>
 			</div>
 			)
 	}

 	getShare() {
 		if (this.props.detail.length !== 1) {
 			return (
 				<div className='detail-not-select'>
 					<svg width='107' height='82' viewBox='0 0 107 82' focusable='false' >
 						<path fill='#999' d='M0,4a4,4,0,0,1,4,-4h89a4,4,0,0,1,4,4v18.5l-23.5,40.5h-69.5a4,4,0,0,1,-4,-4ZM74.5,65l23,-39.15l1,0l7,4.1l1,1l-23,39.15ZM74,65.8l9.5,5.5l-9,4ZM97,51v8a4,4,0,0,1,-4,4h-3ZM21,63v19l23,-19Z'></path>
 					</svg>
 					<div className='detail-title'>请选择一个文件或者文件夹</div>
 				</div>)
 		}
 		let data=this.props.detail[0]
 		return (
 			<div className='file-share'>
 				<div className='file-detail-line'><div></div></div>
		 		<RadioButtonGroup name="typeSelect" valueSelected={this.state.type} onChange ={this.changeShareType.bind(this)}>
			 		<RadioButton value='all' label='所有人' iconStyle={styles.radioIconStyle} labelStyle={styles.radioLabelStyle}/>
			 		<RadioButton value='custom' label='自定义' iconStyle={styles.radioIconStyle} labelStyle={styles.radioLabelStyle}/>
		 		</RadioButtonGroup>
		 		<div className='file-detail-line'><div></div></div>
		 		<div className='custom-share-container' style={this.state.type=='all'?{display:'none'}:{}}>
		 		{this.getShareList(data)}
		 		</div>
		 	</div>
 			)
 	}

 	getShareList(data) {
 		var _this = this
 		if (data.type == 'file') {
 			return <div>文件无法进行分享</div>
 		}
 		let users = window.store.getState().node.server.users
 		return users.map(item => {
 			let checked = false
 			if(data.readlist) {
 				let index = data.readlist.findIndex(i => {
 					return i == item.uuid
 				})
 				if (index != -1) {
 					checked = true
 				}
 			}
 			// return (
 			// 	<ShareRow item={item}/>
 			// 	)
 			return (
 				<Checkbox
 				key={item.uuid}
 				defaultChecked={checked}
 				label={item.username}
 				labelPosition="left"
 				iconStyle={{fill:'5766bd'}}
 				onCheck={this.checkUser.bind(_this,data,item.uuid)}
 				/>
 				)
 		})
 	}

 	getOwner(owner) {
 		// let o = this.props.login.obj.users.find(item=>{
    let o = window.store.getState().node.server.users.find(item => {
 			return item.uuid == owner[0]
 		});
 		if (o != undefined) {
 			return o.username
 		}else {
 			return false
 		}
 	}
 	getSize(size) {
		size = parseFloat(size);
		if (size < 1024) {
			return size.toFixed(2)+' B'
		}else if (size < 1024*1024) {
			return (size/1024).toFixed(2)+' KB'
		}else if(size<1024*1024*1024) {
			return (size/1024/1024).toFixed(2)+ ' M'
		}else {
			return (size/1024/1024/1024).toFixed(2)+ ' G'
		}
	}

	changeShareType(o,value) {
		if (value == 'all') {
			let index = this.props.view.menu.index
			let files = [this.props.file.children[index].uuid]
			let users = []
			// this.props.login.obj.users.forEach( item => {
      	this.props.node.server.users.forEach(item => {
				if ((item.uuid != this.props.login.obj.uuid) && (typeof item.uuid == 'string') ) {
					users.push(item.uuid)
				}
			})
			ipc.send('share',files,users)
		}
		this.setState({
			type:value
		})
	}

	checkUser(file,userUUID,event,checked) {
		debug('check user ......')
		debug(file.readlist)
		debug(checked)
		var _this = this
		let users = file.readlist
		let directoryUUID = this.props.directory.uuid
		if (users == undefined) {
			debug('user not exist')
			users = []
		}
		if (checked) {
			users.push(userUUID)
			debug('push user')
			debug(users)
		}else {
			let index = users.findIndex(item => item == userUUID)
			if (index != -1) {
				users.splice(index,1)
			}
			debug('delete user')
			debug(users)
		}
		command('','FILE_SHARE',{fileUUID:file.uuid, users ,directoryUUID},(err,data) => {
				if (err) {
					debug('share failed')
					debug(err)
				}else {
					debug('share success')
					debug(JSON.parse(data))
					_this.props.updateFileNode(JSON.parse(data))
				}
			})
	}

	cloneFun(obj){
	  if(!obj||"object" != typeof obj){
	    return null;
	  }
	  var result = (obj instanceof Array)?[]:{};
	  for(var i in obj){
	    result[i] = ("object" != typeof obj[i])?obj[i]:cloneFun(obj[i]);
	  }
	  return result;
	}
}

 export default Detail
