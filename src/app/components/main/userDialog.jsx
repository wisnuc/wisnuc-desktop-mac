/**
 * @component Index
 * @description userDialog
 * @time 2016-7-13
 * @author liuhua
 **/
 'use strict';
// require core module
import React, { findDOMNode, Component, PropTypes } from 'react';
import {TextField, FlatButton } from 'material-ui';

class User extends React.Component {
	constructor(props) {
        super(props);
        this.state = {createUser:false };
    }

	render() {
		let login = this.props.login;
		if (this.state.createUser) {
			return (
				<div className='Setting'>
		 			<div className='register-container'>
		 				<TextField
			 			hintText="用户名" ref='username'
			 			/><br />
			 			<TextField
			 			hintText="密码" ref='password'
			 			/><br />
			 			<TextField
			 			hintText="邮箱" ref='email'
			 			/><br />
			 			<FlatButton label="返回" primary={true} onTouchTap={this.toggleUser.bind(this)}/>
	    				<FlatButton label="注册" secondary={true} onTouchTap={this.register.bind(this)}/>
		 			</div>
	 			</div>
				);
		}else {
			return (
				<div className='user-dialog-list-container'>
					{login.obj.allUser.map(item=>{
						return (
							<div key={item.username} className='user-dialog-list'>
								<span>{item.username}</span>
								<span>{item.isAdmin?'管理员':'普通用户'}</span>
								<FlatButton style={item.isAdmin?{marginTop:'10px',opacity:0,cursor:'default'}:{marginTop:'10px'}} label="删除用户" secondary={true} onTouchTap={this.deleteUser.bind(this,item)}/>
							</div>
							);
					})}
					<div>
						<FlatButton style={{marginTop:'10px'}} label="添加新用户" primary={true} onTouchTap={this.toggleUser.bind(this)}/>
					</div>
				</div>
				);
		}
	}
	toggleUser() {
		this.setState({
			createUser: !this.state.createUser
		});
	}

	deleteUser(item) {
		if (item.isAdmin) {return}
		ipc.send('deleteUser',item.uuid);
	}

	register() {
		let u = this.refs.username.input.value;
 		let p = this.refs.password.input.value;
 		let e = this.refs.email.input.value
 		ipc.send('create-new-user',u,p,e);
	}
}

export default User;