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
  passwordInitLink: '/initLink',
  passwordLink: '/link',
  otpGetCode: '/otp/{key}/code',
  otpTelegramGetCode: '/otp/telegram/code',
  otpAuth: '/otp/{key}/auth',
  otpTelegramAuth: '/otp/telegram/auth',
  socialLogin: '/social/login',
  profile: '/profile',
  clearAll: '/clearAll'
}

const authTypes = {
  password: 'email',
  social: 'google',
  otp: 'telegram',

  password2: 'email2',
  social2: 'apple',
  otp2: 'telegram2'
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
  codeTimeout: 'code_timeout'
}

const staticCodes = {
  password: '456123',
  password2: '098765',
  otp: '123321',
  otp2: '565656'
}

class APIClient {
  constructor (deviceID = null, baseUrl) {
    this.baseUrl = baseUrl
    this.apiToken = ''
    this.state = null
    this.promise = Promise.resolve()
    if (deviceID !== null) {
      this.auth(deviceID)
    }
  }

  async request (url, type, data, paramsCfg) {
    const params = {
      hasToken: true,
      status: 200,
      pathParams: {}
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
          console.log(err.message)
          reject(err)
        })
    })
  }

  auth (deviceID) {
    this.promise = this.promise.then(async () => {
      const body = {
        device_id: deviceID
      }
      const res = await this.request(endpoints.auth, 'post', body, { hasToken: false })
      this.apiToken = JSON.parse(res.body).token
    })
    return this
  }

  getOTPCode (uid) {
    this.promise = this.promise.then(() => {
      const body = {
        phone: uid
      }
      return this.request(endpoints.otpTelegramGetCode, 'post', body)
    })
    return this
  }

  otpAuth (uid, code) {
    this.promise = this.promise.then(() => {
      const body = {
        phone: uid,
        code: code
      }
      return this.request('/otp/telegram/auth', 'post', body)
    })
    return this
  }

  passwordRegister (uid, password, type = authTypes.password, name = 'Test1') {
    this.promise = this.promise.then(() => {
      const body = {
        type: type,
        email: uid,
        password: password,
        name: name
      }
      return this.request(endpoints.passwordReg, 'post', body)
    })
    return this
  }

  passwordConfirm (uid, type = authTypes.password) {
    this.promise = this.promise.then(() => {
      let code = ''
      if (this.state !== null && typeof this.state.auths[type] !== 'undefined') {
        code = this.state.auths[type].confirmCode
      }
      const body = {
        type: type,
        uid: uid,
        code: code
      }
      return this.request(endpoints.passwordCondirm, 'post', body)
    })
    return this
  }

  socialLogin (token, type = authTypes.social) {
    this.promise = this.promise.then(() => {
      const body = {
        type: type,
        token: token
      }
      return this.request(endpoints.socialLogin, 'post', body)
    })
    return this
  }

  getProfile () {
    this.promise = this.promise.then(() => {
      return this.request(endpoints.profile, 'get', null)
        .then((res) => {
          this.state = JSON.parse(res.body).user
        })
    })
    return this
  }

  async end () {
    return this.promise.then(() => {
      return this
    })
  }
}

function newClient (deviceID = null) {
  const client = new APIClient(deviceID, config.baseUrl)
  return client
}

function clearAll () {
  return api()
    .base(config.baseUrl)
    .del(endpoints.clearAll)
    .expectStatus(200)
    .end()
}

async function sleep (timeout) {
  return new Promise(resolve => setTimeout(resolve, timeout))
}

module.exports.endpoints = endpoints
module.exports.authTypes = authTypes
module.exports.errors = errors
module.exports.staticCodes = staticCodes

module.exports.NewClient = newClient
module.exports.clearAll = clearAll
module.exports.sleep = sleep
