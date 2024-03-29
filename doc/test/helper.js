'use strict'

const api = require('hippie')
const chai = require('chai')
const chaihttp = require('chai-http')

const config = require('./config.js')

chai.use(chaihttp)

const endpoints = {
  auth: '/auth',
  passwordRegister: '/register',
  passwordLogin: '/login',
  passwordCondirm: '/confirm',
  passwordInitLink: '/initLink',
  passwordLink: '/link',
  passwordRecovery: '/recover',
  passwordRecoveryValidate: '/recover/validate',
  passwordRecoveryReset: '/recover/reset',
  otpGetCode: '/otp/{key}/code',
  otpTelegramGetCode: '/otp/telegram/code',
  otpTelegram2GetCode: '/otp/telegram2/code',
  otpAuth: '/otp/{key}/auth',
  otpTelegramAuth: '/otp/telegram/auth',
  otpTelegram2Auth: '/otp/telegram2/auth',
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
  cannotMergeSelf: 'cannot_merge_self',
  invalidRequest: 'req_invalid',
  invalidCode: 'invalid_code',
  codeExpired: 'code_expired',
  incorrectPassword: 'incorrect_password',
  mergeWarning: 'merge_warning',
  codeTimeout: 'code_timeout',
  invalidAuthToken: 'invalid_auth_token',
  authLost: 'auth method already exists',
  userNotFoundInProfile: 'not found user in context'
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

  otpGetCode (uid, type = authTypes.otp) {
    this.promise = this.promise.then(() => {
      const body = {
        phone: uid
      }

      let endpoint = null
      switch (type) {
        case authTypes.otp:
          endpoint = endpoints.otpTelegramGetCode
          break
        case authTypes.otp2:
          endpoint = endpoints.otpTelegram2GetCode
          break
      }

      return this.request(endpoint, 'post', body)
    })
    return this
  }

  otpAuth (uid, code, type = authTypes.otp, action = 'auth', name = 'otpUser') {
    this.promise = this.promise.then(() => {
      const body = {
        phone: uid,
        name: name,
        code: code
      }

      if (action === 'merge') {
        body.confirmMerge = true
      }

      let endpoint = null
      switch (type) {
        case authTypes.otp:
          endpoint = endpoints.otpTelegramAuth
          break
        case authTypes.otp2:
          endpoint = endpoints.otpTelegram2Auth
          break
      }

      return this.request(endpoint, 'post', body)
    })
    return this
  }

  otpInitLink (uid, type = authTypes.otp) {
    return this.otpGetCode(uid, type)
  }

  otpLink (uid, code, type = authTypes.otp, action = 'link') {
    return this.otpAuth(uid, code, type, action)
  }

  passwordRegister (uid, password, type = authTypes.password, name = 'Test1') {
    this.promise = this.promise.then(() => {
      const body = {
        type: type,
        email: uid,
        password: password,
        name: name
      }
      return this.request(endpoints.passwordRegister, 'post', body)
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

  passwordInitLink (uid, type = authTypes.password) {
    this.promise = this.promise.then(() => {
      const body = {
        type: type,
        uid: uid
      }
      return this.request(endpoints.passwordInitLink, 'post', body)
    })
    return this
  }

  passwordLink (uid, password, action = 'link', type = authTypes.password, code = staticCodes.password) {
    this.promise = this.promise.then(() => {
      const body = {
        type: type,
        uid: uid,
        password: password,
        code: code
      }

      if (action === 'merge') {
        body.merge = true
        body.confirmMerge = true
      } else {
        body.merge = false
      }

      return this.request(endpoints.passwordLink, 'post', body)
    })
    return this
  }

  socialLogin (token, type = authTypes.social, action = 'auth', name = 'socialUser') {
    this.promise = this.promise.then(() => {
      const body = {
        type: type,
        name: name,
        token: token
      }
      if (action === 'merge') {
        body.confirmMerge = true
      }

      return this.request(endpoints.socialLogin, 'post', body)
    })
    return this
  }

  socialLink (token, type = authTypes.social, action = 'link') {
    return this.socialLogin(token, type, action)
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
