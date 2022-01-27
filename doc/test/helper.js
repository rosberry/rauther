'use strict'

const api = require('hippie')
const chai = require('chai')
const chaihttp = require('chai-http')

const config = require('./config.js')

chai.use(chaihttp)

class APIClient {
  constructor (baseUrl) {
    this.baseUrl = baseUrl
    this.apiToken = ''
    this.confirmCode = ''
  }

  async auth (deviceID) {
    const client = this
    // console.log("AUTH!", deviceID);

    return api()
      .base(client.baseUrl)
      .post('/auth')
      .json()
      .send({
        device_id: deviceID
      })
      .expectStatus(200)
      .end()
      .then(function (res) {
        client.apiToken = JSON.parse(res.body).token
      })
  }

  async getOTPCode (uid) {
    const client = this
    // console.log("GET OTP CODE!", uid);
    // console.log("[get otp code] this:", this)

    return api()
      .header('Authorization', 'Bearer ' + client.apiToken)
      .base(client.baseUrl)
      .post('/otp/telegram/code')
      .json()
      .send({
        phone: uid
      })
      .expectStatus(200)
      .end()
  }

  async otpAuth (uid, code) {
    const client = this
    // console.log("OTP AUTH!", uid, code);

    return api()
      .header('Authorization', 'Bearer ' + client.apiToken)
      .base(client.baseUrl)
      .post('/otp/telegram/auth')
      .json()
      .send({
        phone: uid,
        code: code
      })
      .expectStatus(200)
      .end()
  }

  async register (uid, password) {
    const client = this
    // console.log("REGISTER!", uid, password)

    return api()
      .header('Authorization', 'Bearer ' + client.apiToken)
      .base(client.baseUrl)
      .post('/register')
      .json()
      .send({
        type: 'email',
        email: uid,
        password: password,
        name: 'Test1'
      })
      .expectStatus(200)
      .end()
  }

  async getProfile () {
    const client = this
    // console.log("PROFILE!")

    let code = ''

    return api()
      .header('Authorization', 'Bearer ' + client.apiToken)
      .base(client.baseUrl)
      .get('/profile')
      .json()
      .expectStatus(200)
      .end()
      .then(function (res) {
        // console.log("res.body", res.body)
        code = JSON.parse(res.body).user.auths.email.confirmCode
        // console.log("res.user.auths.email.confirmCode:", code)
        client.confirmCode = code
      })
  }

  async confirm (uid) {
    const client = this
    // console.log("CONFIRM!", uid, client.confirmCode)

    return api()
      .header('Authorization', 'Bearer ' + client.apiToken)
      .base(client.baseUrl)
      .post('/confirm')
      .json()
      .send({
        type: 'email',
        uid: uid,
        code: client.confirmCode
      })
      .expectStatus(200)
      .end()
  }

  async clearAll (uid) {
    const client = this
    // console.log("CLEAR!")

    return api()
    // .header("Authorization", "Bearer " + client.apiToken)
      .base(client.baseUrl)
      .del('/clearAll')
      .expectStatus(200)
      .end()
  }
}

const client = new APIClient(config.baseUrl)

function newClient () {
  const client = new APIClient(config.baseUrl)
  return client
}

module.exports.client = client
module.exports.newClient = newClient
