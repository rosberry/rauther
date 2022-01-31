'use strict'

const api = require('hippie')
const chai = require('chai')
const chaihttp = require('chai-http')

const config = require('./config.js')

chai.use(chaihttp)

const endpoints = {
  auth: '/auth',
  passwordReg: '/register',
  passwordCondirm: '/confirm',
  otpGetCode: '/otp/telegram/code',
  otpAuth: '/otp/telegram/auth',
  socialLogin: '/social/login',
  profile: '/profile',
}

const authTypes = {
  password: 'email',
  social: 'google',
  otp: 'telegram',

  password2: 'email2',
  social2: 'apple',
  otp2: 'telegram2',
}

const errors = {
  userNotFound: 'user_not_found',
  userNotConfirmed: 'user_not_confirmed',
  userExist: 'user_exist',
  alreadyAuth: 'already_auth',
  authIdentityAlreadyExists: 'auth_identity_already_exists',
  invalidRequest: 'req_invalid',
  invalidCode: 'invalid_code',
  codeExpired: 'code_expired',
  incorrectPassword: 'incorrect_password',
  mergeWarning: 'merge_warning',
}

class APIClient {
  apiToken = ''
  state = null

  constructor(baseUrl) {
    this.baseUrl = baseUrl
  }

  async auth(deviceID) {
    const body = {
      device_id: deviceID
    }
    return this.request(endpoints.auth, 'post', body, { hasToken: false })
      .then((res) => {
        this.apiToken = JSON.parse(res.body).token
      })
  }

  async getOTPCode(uid) {
    const body = {
      phone: uid
    }
    return this.request(endpoints.otpGetCode, 'post', body)
  }

  async otpAuth(uid, code) {
    const body = {
      phone: uid,
      code: code
    }
    return this.request(endpoints.otpAuth, 'post', body)
  }

  async register(uid, password, type = authTypes.password, name = 'Test1') {
    const body = {
      type: type,
      email: uid,
      password: password,
      name: name
    }
    return this.request(endpoints.passwordReg, 'post', body)
  }

  async getProfile() {
    return this.request(endpoints.profile, 'get', null)
      .then((res) => {
        this.state = JSON.parse(res.body).user
      })
  }

  async confirm(uid, type = authTypes.password) {
    let code = ''
    if (this.state !== null && typeof this.state.auths[type] !== 'undefined') {
      code = this.state.auths[type].confirmCode
    }
    const body = {
      type: type,
      uid: uid,
      code: code,
    }
    return this.request(endpoints.passwordCondirm, 'post', body)
  }

  async socialLogin(token, type = authTypes.social) {
    const body = {
      type: authTypes.social,
      token: token
    }
    return this.request(endpoints.socialLogin, 'post', body)
  }

  async request(url, type, data, paramsCfg) {
    const params = {
      hasToken: true,
      status: 200,
      pathParams: {},
    }

    if (typeof paramsCfg !== 'undefined') {
      Object.assign(params, paramsCfg)
    }

    let h = api()

    if (params.hasToken) {
      h = h.header('Authorization', 'Bearer ' + this.apiToken)
    }

    h = h.base(this.baseUrl)
      .url(url)
      .method(type.toUpperCase())
      .pathParams(params.pathParams)
      .json()
      .expectStatus(params.status)

    if (data !== null) {
      h = h.send(data)
    }

    return new Promise((resolve, reject) => {
      h.end()
        .then((res) => {
          resolve(res)
        })
        .catch((err) => {
          console.log(err)
          reject(err)
        })
    })


  }
}

function newClient() {
  const client = new APIClient(config.baseUrl)
  return client
}

class ClientBuilder {
  client = null
  promise = null
  constructor(deviceID = null, client = null) {
    this.client = client !== null ? client : newClient()
    this.promise = Promise.resolve()
    if (deviceID !== null) {
      this.addAuth(deviceID)
    }
  }

  addAuth(deviceID) {
    this.promise = this.promise.then(() => {
      return this.client.auth(deviceID)
    })
    return this
  }

  addGetOTPCode(uid) {
    this.promise = this.promise.then(() => {
      return this.client.getOTPCode(uid)
    })
    return this
  }

  addOTPAuth(uid, code) {
    this.promise = this.promise.then(() => {
      return this.client.otpAuth(uid, code)
    })
    return this
  }

  addPasswordRegister(uid, password, type = 'email', name = 'Test1') {
    this.promise = this.promise.then(() => {
      return this.client.register(uid, password, type, name)
    })
    return this
  }

  addPasswordConfirm(uid, type = authTypes.password) {
    this.promise = this.promise.then(() => {
      return this.client.confirm(uid, type)
    })
    return this
  }

  addSocialLogin(token) {
    this.promise = this.promise.then(() => {
      return this.client.socialLogin(token)
    })
    return this
  }

  addGetProfile() {
    this.promise = this.promise.then(() => {
      return this.client.getProfile()
    })
    return this
  }

  async build() {
    return this.promise.then(() => {
      return this.client
    })
  }
}

function clearAll() {
  return api()
    .base(config.baseUrl)
    .del('/clearAll')
    .expectStatus(200)
    .end()
}

module.exports.endpoints = endpoints
module.exports.authTypes = authTypes
module.exports.errors = errors

module.exports.newClient = newClient
module.exports.ClientBuilder = ClientBuilder
module.exports.clearAll = clearAll
