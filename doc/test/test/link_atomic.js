/* eslint-disable no-unused-expressions */
'use strict'

const SwaggerParser = require('swagger-parser')
const parser = new SwaggerParser()
const hippie = require('hippie-swagger')
const expect = require('chai').expect
const chai = require('chai')
const chaihttp = require('chai-http')
const config = require('../config.js')
const helper = require('../helper.js')

let spec
const googleToken = process.env.GOOGLE_TOKEN || ''
const googleToken2 = process.env.GOOGLE_TOKEN2 || ''
const appleToken = process.env.APPLE_TOKEN || ''

const authTypes = helper.authTypes
const endpoints = helper.endpoints
const errors = helper.errors
const staticCodes = helper.staticCodes

chai.use(chaihttp)

const baseUrl = config.baseUrl
const specFile = config.specFile

const userName = 'Petya'

describe('Check link account flow:', function () {
  this.timeout(60000) // very large swagger files may take a few seconds to parse
  this.slow(200)

  before(function (done) {
    // if using mocha, dereferencing can be performed prior during initialization via the delay flag:
    // https://mochajs.org/#delayed-root-suite
    parser.dereference(specFile, function (err, api) {
      if (err) {
        return done(err)
      }
      spec = api
      done()
    })
  })

  // #1 Link password
  // Password: Expected group
  // Password: base link
  describe('I want to test password linking', function () {
    context('Given user 1 with OTP account', function () {
      const deviceID = 'test' + (Math.floor(Math.random() * 99999))
      let apiToken = ''

      const phone = '+7' + (Math.floor(Math.random() * 999999999))
      const otpCode = staticCodes.otp

      const email = 'test' + (Math.floor(Math.random() * 99999)) + '@example.com'
      const password = 'password1'
      const pswdCode = staticCodes.password

      before(async function () {
        // main client
        const otpClient = await new helper.NewClient(deviceID)
          .otpGetCode(phone)
          .otpAuth(phone, otpCode)
          .end()

        apiToken = otpClient.apiToken
      })

      after(async function () {
        await helper.clearAll()
      })

      describe('When user 1 requests for init linking password account', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken)
            .base(baseUrl)
            .post(endpoints.passwordInitLink)
            .json()
            .send({
              type: authTypes.password,
              uid: email
            })
            .expectStatus(200)
            .end(function (_, raw, res) {
              resData = res
              done.apply(null, arguments)
            })
        })

        it('Then request should return result true', function (done) {
          expect(resData).to.have.property('result').that.is.true
          expect(resData).to.not.have.property('error')
          done()
        })

        it('Then property action should equal "link"', function (done) {
          expect(resData).to.have.property('action').that.equals('link')
          done()
        })

        it('Then property confirmCodeRequired should equal true', function (done) {
          expect(resData).to.have.property('confirmCodeRequired').is.true
          done()
        })
      })

      describe('When user 1 requests for link password account', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken)
            .base(baseUrl)
            .post(endpoints.passwordLink)
            .json()
            .send({
              type: authTypes.password,
              uid: email,
              password: password,
              code: pswdCode
            })
            .expectStatus(200)
            .end(function (_, raw, res) {
              resData = res
              done.apply(null, arguments)
            })
        })

        it('Then request should return result true', function (done) {
          expect(resData).to.have.property('result').that.is.true
          expect(resData).to.not.have.property('error')
          done()
        })
      })

      describe('When user 1 requests profile', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken)
            .base(baseUrl)
            .get(endpoints.profile)
            .json()
            .expectStatus(200)
            .end(function (_, raw, res) {
              resData = res
              done.apply(null, arguments)
            })
        })

        it('Then request should return true', function (done) {
          expect(resData).to.have.property('result').that.is.true
          expect(resData).to.not.have.property('error')
          expect(resData).to.have.property('user').that.is.an('object')
          expect(resData.user).to.have.property('guest').that.is.false
          done()
        })

        it(`Then property auths should contain ${authTypes.otp} type that is confirmed`, function (done) {
          const auths = resData.user.auths
          expect(auths).to.have.property(authTypes.otp).that.is.an('object')
          expect(auths[authTypes.otp]).to.have.property('confirmed').that.is.true
          done()
        })

        it(`Then property auths should contain ${authTypes.password} type that is confirmed`, function (done) {
          const auths = resData.user.auths
          expect(auths).to.have.property(authTypes.password).that.is.an('object')
          expect(auths[authTypes.password]).to.have.property('confirmed').that.is.true
          done()
        })
      })
    })
  })

  // Password: same password type and differrent auth keys
  describe('I want to test linking with same password type and different auth key', function () {
    context('Given user 1 with password confirmed account and auth identity with the same auth type and different auth key', function () {
      const deviceID = 'test' + (Math.floor(Math.random() * 99999))
      let apiToken = ''

      const email = 'test' + (Math.floor(Math.random() * 99999)) + '@example.com'
      const email2 = 'test' + (Math.floor(Math.random() * 99999)) + '@example.com'
      const password = 'password1'
      const password2 = 'password2'
      const pswdCode2 = staticCodes.password2

      before(async function () {
        // main client
        const passwordClient = await new helper.NewClient(deviceID)
          .passwordRegister(email, password)
          .getProfile()
          .passwordConfirm(email)
          .end()

        apiToken = passwordClient.apiToken
      })

      after(async function () {
        await helper.clearAll()
      })

      describe('When user 1 requests for init linking password account', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken)
            .base(baseUrl)
            .post(endpoints.passwordInitLink)
            .json()
            .send({
              type: authTypes.password2,
              uid: email2
            })
            .expectStatus(200)
            .end(function (_, raw, res) {
              resData = res
              done.apply(null, arguments)
            })
        })

        it('Then request should return result true', function (done) {
          expect(resData).to.have.property('result').that.is.true
          expect(resData).to.not.have.property('error')
          done()
        })

        it('Then property action should equal "link"', function (done) {
          expect(resData).to.have.property('action').that.equals('link')
          done()
        })

        it('Then property confirmCodeRequired should equal true', function (done) {
          expect(resData).to.have.property('confirmCodeRequired').is.true
          done()
        })
      })

      describe('When user 1 requests for link password account', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken)
            .base(baseUrl)
            .post(endpoints.passwordLink)
            .json()
            .send({
              type: authTypes.password2,
              uid: email2,
              password: password2,
              code: pswdCode2
            })
            .expectStatus(200)
            .end(function (_, raw, res) {
              resData = res
              done.apply(null, arguments)
            })
        })

        it('Then request should return result true', function (done) {
          expect(resData).to.have.property('result').that.is.true
          expect(resData).to.not.have.property('error')
          done()
        })
      })

      describe('When user 1 requests profile', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken)
            .base(baseUrl)
            .get(endpoints.profile)
            .json()
            .expectStatus(200)
            .end(function (_, raw, res) {
              resData = res
              done.apply(null, arguments)
            })
        })

        it('Then request should return true', function (done) {
          expect(resData).to.have.property('result').that.is.true
          expect(resData).to.not.have.property('error')
          expect(resData).to.have.property('user').that.is.an('object')
          expect(resData.user).to.have.property('guest').that.is.false
          done()
        })

        it(`Then property auths should contain ${authTypes.password} type that is confirmed`, function (done) {
          const auths = resData.user.auths
          expect(auths).to.have.property(authTypes.password).that.is.an('object')
          expect(auths[authTypes.password]).to.have.property('confirmed').that.is.true
          done()
        })

        it(`Then uid property of auths.${authTypes.password} should equal uid of email 1 and not equals of email 2`, function (done) {
          const uid = resData.user.auths[authTypes.password].uid
          expect(uid).equals(email)
          expect(uid).not.equals(email2)
          done()
        })

        it(`Then property auths should contain ${authTypes.password2} type that is confirmed`, function (done) {
          const auths = resData.user.auths
          expect(auths).to.have.property(authTypes.password2).that.is.an('object')
          expect(auths[authTypes.password2]).to.have.property('confirmed').that.is.true
          done()
        })

        it(`Then uid property of auths.${authTypes.password2} should equal uid of email 2 and not equals of email 1`, function (done) {
          const uid = resData.user.auths[authTypes.password2].uid
          expect(uid).not.equals(email)
          expect(uid).equals(email2)
          done()
        })
      })
    })
  })

  // Password: same password type and auth key
  describe('I want to test password linking with the same auth key and auth type', function () {
    context('Given user 1 with password account and auth identity with the same auth keys and auth types', function () {
      const deviceID = 'test' + (Math.floor(Math.random() * 99999))
      let apiToken = ''

      const email = 'test' + (Math.floor(Math.random() * 99999)) + '@example.com'
      const email2 = 'test' + (Math.floor(Math.random() * 99999)) + '@example.com'
      const password = 'password1'
      const password2 = 'password1'
      const pswdCode = staticCodes.password

      before(async function () {
        // main client
        const passwordClient = await new helper.NewClient(deviceID)
          .passwordRegister(email, password)
          .getProfile()
          .passwordConfirm(email)
          .end()

        apiToken = passwordClient.apiToken
      })

      after(async function () {
        await helper.clearAll()
      })

      describe('When user 1 requests for init link password account', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken)
            .base(baseUrl)
            .post(endpoints.passwordInitLink)
            .json()
            .send({
              type: authTypes.password,
              uid: email2
            })
            .expectStatus(400)
            .end(function (_, raw, res) {
              resData = res
              done.apply(null, arguments)
            })
        })

        it('Then request should return result false', function (done) {
          expect(resData).to.have.property('result').that.is.false
          expect(resData).to.have.property('error')
          done()
        })

        it(`Then property code of error should equal ${errors.authIdentityAlreadyExists}`, function (done) {
          expect(resData.error).to.have.property('code').that.equals(errors.authIdentityAlreadyExists)
          done()
        })
      })

      describe('When user 1 requests for link password account', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken)
            .base(baseUrl)
            .post(endpoints.passwordLink)
            .json()
            .send({
              type: authTypes.password,
              uid: email2,
              password: password2,
              code: pswdCode
            })
            .expectStatus(400)
            .end(function (_, raw, res) {
              resData = res
              done.apply(null, arguments)
            })
        })

        it('Then request should return result false', function (done) {
          expect(resData).to.have.property('result').that.is.false
          expect(resData).to.have.property('error')
          done()
        })

        it(`Then property code of error should equal ${errors.userNotFound}`, function (done) {
          expect(resData.error).to.have.property('code').that.equals(errors.userNotFound)
          done()
        })
      })

      describe('When user 1 requests profile', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken)
            .base(baseUrl)
            .get(endpoints.profile)
            .json()
            .expectStatus(200)
            .end(function (_, raw, res) {
              resData = res
              done.apply(null, arguments)
            })
        })

        it('Then request should return true', function (done) {
          expect(resData).to.have.property('result').that.is.true
          expect(resData).to.not.have.property('error')
          expect(resData).to.have.property('user').that.is.an('object')
          expect(resData.user).to.have.property('guest').that.is.false
          done()
        })

        it(`Then property auths should contain ${authTypes.password} type that is confirmed`, function (done) {
          const auths = resData.user.auths
          expect(auths).to.have.property(authTypes.password).that.is.an('object')
          expect(auths[authTypes.password]).to.have.property('confirmed').that.is.true
          done()
        })

        it(`Then uid property of auths.${authTypes.password} should equal uid of email 1 and not equals of email 2`, function (done) {
          const uid = resData.user.auths[authTypes.password].uid
          expect(uid).equals(email)
          expect(uid).not.equals(email2)
          done()
        })
      })
    })
  })

  // Password: not confirmed base account
  // TODO: user_not_found? May be user_not_confirmed?
  describe('I want to test linking not confirmed password account', function () {
    context('Given user 1 with not confirmed password account', function () {
      const deviceID = 'test' + (Math.floor(Math.random() * 99999))
      let apiToken = ''

      const email = 'test' + (Math.floor(Math.random() * 99999)) + '@example.com'
      const email2 = 'test' + (Math.floor(Math.random() * 99999)) + '@example.com'
      const password = 'password1'
      const password2 = 'password2'
      const code2 = staticCodes.password2

      before(async function () {
        // main client
        const passwordClient = await new helper.NewClient(deviceID)
          .passwordRegister(email, password)
          .end()

        apiToken = passwordClient.apiToken
      })

      after(async function () {
        await helper.clearAll()
      })

      describe('When user 1 requests for init linking password account', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken)
            .base(baseUrl)
            .post(endpoints.passwordInitLink)
            .json()
            .send({
              type: authTypes.password2,
              uid: email2
            })
            .expectStatus(400)
            .end(function (_, raw, res) {
              resData = res
              done.apply(null, arguments)
            })
        })

        it('Then request should return result false', function (done) {
          expect(resData).to.have.property('result').that.is.false
          expect(resData).to.have.property('error')
          done()
        })

        it(`Then property code of error should equal ${errors.userNotConfirmed}`, function (done) {
          expect(resData.error).to.have.property('code').that.equals(errors.userNotConfirmed)
          done()
        })
      })

      describe('When user 1 requests for link password account', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken)
            .base(baseUrl)
            .post(endpoints.passwordLink)
            .json()
            .send({
              type: authTypes.password2,
              uid: email2,
              password: password2,
              code: code2
            })
            .expectStatus(400)
            .end(function (_, raw, res) {
              resData = res
              done.apply(null, arguments)
            })
        })

        it('Then request should return result false', function (done) {
          expect(resData).to.have.property('result').that.is.false
          expect(resData).to.have.property('error')
          done()
        })

        it(`Then property code of error should equal ${errors.userNotFound}`, function (done) {
          expect(resData.error).to.have.property('code').that.equals(errors.userNotFound)
          done()
        })
      })

      describe('When user 1 requests profile', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken)
            .base(baseUrl)
            .get(endpoints.profile)
            .json()
            .expectStatus(200)
            .end(function (_, raw, res) {
              resData = res
              done.apply(null, arguments)
            })
        })

        it('Then request should return true', function (done) {
          expect(resData).to.have.property('result').that.is.true
          expect(resData).to.not.have.property('error')
          expect(resData).to.have.property('user').that.is.an('object')
          expect(resData.user).to.have.property('guest').that.is.false
          done()
        })

        it(`Then property auths should contain ${authTypes.password} type that is not confirmed`, function (done) {
          const auths = resData.user.auths
          expect(auths).to.have.property(authTypes.password).that.is.an('object')
          expect(auths[authTypes.password]).to.have.property('confirmed').that.is.false
          done()
        })

        it(`Then property auths should not contain ${authTypes.password2}`, function (done) {
          expect(resData.user.auths).to.not.have.property(authTypes.password2)
          done()
        })
      })
    })
  })

  // Password: not found temp user in profile
  describe('I want to test that after the initialization of the password linking, this auth identity does not yet exists after profile request', function () {
    context('Given user 1 with OTP auth identity, initialised linking for password auth identity', function () {
      const deviceID = 'test' + (Math.floor(Math.random() * 99999))
      let apiToken = ''

      const phone = '+7' + (Math.floor(Math.random() * 999999999))
      const otpCode = staticCodes.otp

      const email = 'test' + (Math.floor(Math.random() * 99999)) + '@example.com'

      before(async function () {
        // main client
        const user1 = await new helper.NewClient(deviceID)
          .otpGetCode(phone)
          .otpAuth(phone, otpCode)
          .passwordInitLink(email)
          .end()

        apiToken = user1.apiToken
      })

      after(async function () {
        await helper.clearAll()
      })

      describe('When user 1 requests profile', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken)
            .base(baseUrl)
            .get(endpoints.profile)
            .json()
            .expectStatus(200)
            .end(function (_, raw, res) {
              resData = res
              done.apply(null, arguments)
            })
        })

        it('Then request should return true', function (done) {
          expect(resData).to.have.property('result').that.is.true
          expect(resData).to.not.have.property('error')
          expect(resData).to.have.property('user').that.is.an('object')
          expect(resData.user).to.have.property('guest').that.is.false
          done()
        })

        it(`Then property auths should contain ${authTypes.otp} type that is confirmed`, function (done) {
          const auths = resData.user.auths
          expect(auths).to.have.property(authTypes.otp).that.is.an('object')
          expect(auths[authTypes.otp]).to.have.property('confirmed').that.is.true
          done()
        })

        it(`Then property auths should not contain ${authTypes.password} type`, function (done) {
          expect(resData.user.auths).to.not.have.property(authTypes.password)
          done()
        })
      })
    })
  })

  // Password: link already registered confirmed account flow (user exists) (requirements: no merge mode)
  describe('I want to test password linking with already registered confirmed account', function () {
    context('Given user 1 with OTP account and user 2 with confirmed password account', function () {
      const deviceID = 'test' + (Math.floor(Math.random() * 99999))
      const deviceID2 = 'test' + (Math.floor(Math.random() * 99999))
      let apiToken = ''

      const phone = '+7' + (Math.floor(Math.random() * 999999999))
      const otpCode = staticCodes.otp

      const email = 'test' + (Math.floor(Math.random() * 99999)) + '@example.com'
      const password = 'password1'
      const pswdCode = staticCodes.password

      before(async function () {
        if (config.merge) {
          this.skip()
        }
        // main client
        const otpClient = await new helper.NewClient(deviceID)
          .otpGetCode(phone)
          .otpAuth(phone, otpCode)
          .end()

        apiToken = otpClient.apiToken

        await new helper.NewClient(deviceID2)
          .passwordRegister(email, password)
          .getProfile()
          .passwordConfirm(email)
          .end()
      })

      after(async function () {
        await helper.clearAll()
      })

      describe('When user 1 requests for init linking password account', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken)
            .base(baseUrl)
            .post(endpoints.passwordInitLink)
            .json()
            .send({
              type: authTypes.password,
              uid: email
            })
            .expectStatus(400)
            .end(function (_, raw, res) {
              resData = res
              done.apply(null, arguments)
            })
        })

        it('Then request should return result false', function (done) {
          expect(resData).to.have.property('result').that.is.false
          expect(resData).to.have.property('error')
          done()
        })

        it(`Then property code of error should equal ${errors.userExist}`, function (done) {
          expect(resData.error).to.have.property('code').that.equals(errors.userExist)
          done()
        })
      })

      describe('When user 1 requests for link password account', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken)
            .base(baseUrl)
            .post(endpoints.passwordLink)
            .json()
            .send({
              type: authTypes.password,
              uid: email,
              password: password,
              code: pswdCode
            })
            .expectStatus(400)
            .end(function (_, raw, res) {
              resData = res
              done.apply(null, arguments)
            })
        })

        it('Then request should return result false', function (done) {
          expect(resData).to.have.property('result').that.is.false
          expect(resData).to.have.property('error')
          done()
        })

        it(`Then property code of error should equal ${errors.userExist}`, function (done) {
          expect(resData.error).to.have.property('code').that.equals(errors.userExist)
          done()
        })
      })

      describe('When user 1 requests profile', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken)
            .base(baseUrl)
            .get(endpoints.profile)
            .json()
            .expectStatus(200)
            .end(function (_, raw, res) {
              resData = res
              done.apply(null, arguments)
            })
        })

        it('Then request should return true', function (done) {
          expect(resData).to.have.property('result').that.is.true
          expect(resData).to.not.have.property('error')
          expect(resData).to.have.property('user').that.is.an('object')
          expect(resData.user).to.have.property('guest').that.is.false
          done()
        })

        it(`Then property auths should contain ${authTypes.otp} type that is confirmed`, function (done) {
          const auths = resData.user.auths
          expect(auths).to.have.property(authTypes.otp).that.is.an('object')
          expect(auths[authTypes.otp]).to.have.property('confirmed').that.is.true
          done()
        })

        it(`Then property auths should not contain ${authTypes.password}`, function (done) {
          expect(resData.user.auths).to.not.have.property(authTypes.password)
          done()
        })
      })
    })
  })

  // Password: link already registered not confirmed account flow (user exists) (requirements: no merge mode)
  describe('I want to test password linking with already registered not confirmed account', function () {
    context('Given user 1 with OTP account and user 2 with not confirmed password account', function () {
      const deviceID = 'test' + (Math.floor(Math.random() * 99999))
      const deviceID2 = 'test' + (Math.floor(Math.random() * 99999))
      let apiToken = ''

      const phone = '+7' + (Math.floor(Math.random() * 999999999))
      const otpCode = staticCodes.otp

      const email = 'test' + (Math.floor(Math.random() * 99999)) + '@example.com'
      const password = 'password1'
      const pswdCode = staticCodes.password

      before(async function () {
        if (config.merge) {
          this.skip()
        }
        // main client
        const otpClient = await new helper.NewClient(deviceID)
          .otpGetCode(phone)
          .otpAuth(phone, otpCode)
          .end()

        apiToken = otpClient.apiToken

        await new helper.NewClient(deviceID2)
          .passwordRegister(email, password)
          .end()
      })

      after(async function () {
        await helper.clearAll()
      })

      describe('When user 1 requests for init linking password account', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken)
            .base(baseUrl)
            .post(endpoints.passwordInitLink)
            .json()
            .send({
              type: authTypes.password,
              uid: email
            })
            .expectStatus(400)
            .end(function (_, raw, res) {
              resData = res
              done.apply(null, arguments)
            })
        })

        it('Then request should return result false', function (done) {
          expect(resData).to.have.property('result').that.is.false
          expect(resData).to.have.property('error')
          done()
        })

        it(`Then property code of error should equal ${errors.userExist}`, function (done) {
          expect(resData.error).to.have.property('code').that.equals(errors.userExist)
          done()
        })
      })

      describe('When user 1 requests for link password account', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken)
            .base(baseUrl)
            .post(endpoints.passwordLink)
            .json()
            .send({
              type: authTypes.password,
              uid: email,
              password: password,
              code: pswdCode
            })
            .expectStatus(400)
            .end(function (_, raw, res) {
              resData = res
              done.apply(null, arguments)
            })
        })

        it('Then request should return result false', function (done) {
          expect(resData).to.have.property('result').that.is.false
          expect(resData).to.have.property('error')
          done()
        })

        it(`Then property code of error should equal ${errors.userExist}`, function (done) {
          expect(resData.error).to.have.property('code').that.equals(errors.userExist)
          done()
        })
      })

      describe('When user 1 requests profile', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken)
            .base(baseUrl)
            .get(endpoints.profile)
            .json()
            .expectStatus(200)
            .end(function (_, raw, res) {
              resData = res
              done.apply(null, arguments)
            })
        })

        it('Then request should return true', function (done) {
          expect(resData).to.have.property('result').that.is.true
          expect(resData).to.not.have.property('error')
          expect(resData).to.have.property('user').that.is.an('object')
          expect(resData.user).to.have.property('guest').that.is.false
          done()
        })

        it(`Then property auths should contain ${authTypes.otp} type that is confirmed`, function (done) {
          const auths = resData.user.auths
          expect(auths).to.have.property(authTypes.otp).that.is.an('object')
          expect(auths[authTypes.otp]).to.have.property('confirmed').that.is.true
          done()
        })

        it(`Then property auths should not contain ${authTypes.password}`, function (done) {
          expect(resData.user.auths).to.not.have.property(authTypes.password)
          done()
        })
      })
    })
  })

  // Password: login to linked account by another user
  describe('I want to test that after the password linking, the account does exist and it is possible to login from another session', function () {
    context('Given user 1 with OTP auth identity, linked password auth identity and user 2 without account', function () {
      const deviceID = 'test' + (Math.floor(Math.random() * 99999))
      const deviceID2 = 'test' + (Math.floor(Math.random() * 99999))
      let apiToken2 = ''

      const phone = '+7' + (Math.floor(Math.random() * 999999999))
      const otpCode = staticCodes.otp

      const email = 'test' + (Math.floor(Math.random() * 99999)) + '@example.com'
      const password = 'password1'

      before(async function () {
        // main client
        await new helper.NewClient(deviceID)
          .otpGetCode(phone)
          .otpAuth(phone, otpCode)
          .passwordInitLink(email)
          .passwordLink(email, password)
          .end()

        const user2 = await new helper.NewClient(deviceID2).end()

        apiToken2 = user2.apiToken
      })

      after(async function () {
        await helper.clearAll()
      })

      describe('When user 2 requests login with credentials of linked auth identity', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken2)
            .base(baseUrl)
            .post(endpoints.passwordLogin)
            .json()
            .send({
              type: authTypes.password,
              email: email,
              password: password
            })
            .expectStatus(200)
            .end(function (_, raw, res) {
              resData = res
              done.apply(null, arguments)
            })
        })

        it('Then request should return result true', function (done) {
          expect(resData).to.have.property('result').that.is.true
          expect(resData).to.not.have.property('error')
          done()
        })
      })
    })
  })

  // Password: inject register after link init flow
  describe('I want to test that if the user has not completed the linking of the password account to the end, then under these credentials you can register and the original user will not be able to complete the linking', function () {
    context('Given user 1 with OTP account and user 2 without account, user 1 initialized linking password account', function () {
      const deviceID = 'test' + (Math.floor(Math.random() * 99999))
      const deviceID2 = 'test' + (Math.floor(Math.random() * 99999))
      let apiToken = ''
      let apiToken2 = ''

      const phone = '+7' + (Math.floor(Math.random() * 999999999))
      const otpCode = staticCodes.otp

      const email = 'test' + (Math.floor(Math.random() * 99999)) + '@example.com'
      const password = 'password1'

      before(async function () {
        // main client
        const user1 = await new helper.NewClient(deviceID)
          .otpGetCode(phone)
          .otpAuth(phone, otpCode)
          .passwordInitLink(email)
          .end()

        const user2 = await new helper.NewClient(deviceID2).end()

        apiToken = user1.apiToken
        apiToken2 = user2.apiToken
      })

      after(async function () {
        await helper.clearAll()
      })

      describe('When user 2 requests for register password account', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken2)
            .base(baseUrl)
            .post(endpoints.passwordRegister)
            .json()
            .send({
              type: authTypes.password,
              email: email,
              password: password,
              name: userName
            })
            .expectStatus(200)
            .end(function (_, raw, res) {
              resData = res
              done.apply(null, arguments)
            })
        })

        it('Then request should return result true', function (done) {
          expect(resData).to.have.property('result').that.is.true
          expect(resData).to.not.have.property('error')
          done()
        })
      })

      describe('When user 1 requests for link account', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken)
            .base(baseUrl)
            .post(endpoints.passwordLink)
            .json()
            .send({
              type: authTypes.password,
              uid: email,
              password: password
            })
            .expectStatus(400)
            .end(function (_, raw, res) {
              resData = res
              done.apply(null, arguments)
            })
        })

        it('Then request should return result false', function (done) {
          expect(resData).to.have.property('result').that.is.false
          expect(resData).to.have.property('error')
          done()
        })

        it(`Then property code of error should equal ${errors.userExist}`, function (done) {
          expect(resData.error).to.have.property('code').that.equals(errors.userExist)
          done()
        })
      })
    })
  })

  // Password: link account by 2 users
  describe('I want to test that we can initialize password linking from different accounts, but only one can complete it, for another user it will no longer be available', function () {
    context('Given user 1 with OTP account and user 2 with OTP account, user 1 initialized password linking with base timeount', function () {
      const deviceID = 'test' + (Math.floor(Math.random() * 99999))
      const deviceID2 = 'test' + (Math.floor(Math.random() * 99999))
      let apiToken = ''
      let apiToken2 = ''

      const phone = '+7' + (Math.floor(Math.random() * 999999999))
      const phone2 = '+7' + (Math.floor(Math.random() * 999999999))
      const otpCode = staticCodes.otp
      const otpCode2 = staticCodes.otp2

      const email = 'test' + (Math.floor(Math.random() * 99999)) + '@example.com'
      const password = 'password1'
      const pswdCode = staticCodes.password

      before(async function () {
        // main client
        const user1 = await new helper.NewClient(deviceID)
          .otpGetCode(phone, authTypes.otp)
          .otpAuth(phone, otpCode, authTypes.otp)
          .end()

        const user2 = await new helper.NewClient(deviceID2)
          .otpGetCode(phone2, authTypes.otp2)
          .otpAuth(phone2, otpCode2, authTypes.otp2)
          .end()

        await user1.passwordInitLink(email).end()

        await helper.sleep(config.sentCodeTimeout)

        apiToken = user1.apiToken
        apiToken2 = user2.apiToken
      })

      after(async function () {
        await helper.clearAll()
      })

      describe('When user 2 requests for init linking password account', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken2)
            .base(baseUrl)
            .post(endpoints.passwordInitLink)
            .json()
            .send({
              type: authTypes.password,
              uid: email
            })
            .expectStatus(200)
            .end(function (_, raw, res) {
              resData = res
              done.apply(null, arguments)
            })
        })

        it('Then request should return result true', function (done) {
          expect(resData).to.have.property('result').that.is.true
          expect(resData).to.not.have.property('error')
          done()
        })
      })

      describe('When user 1 requests for link password account', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken)
            .base(baseUrl)
            .post(endpoints.passwordLink)
            .json()
            .send({
              type: authTypes.password,
              uid: email,
              password: password,
              code: pswdCode
            })
            .expectStatus(200)
            .end(function (_, raw, res) {
              resData = res
              done.apply(null, arguments)
            })
        })

        it('Then request should return result true', function (done) {
          expect(resData).to.have.property('result').that.is.true
          expect(resData).to.not.have.property('error')
          done()
        })
      })

      describe('When user 2 requests for link password account', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken2)
            .base(baseUrl)
            .post(endpoints.passwordLink)
            .json()
            .send({
              type: authTypes.password,
              uid: email,
              password: password,
              code: pswdCode
            })
            .expectStatus(400)
            .end(function (_, raw, res) {
              resData = res
              done.apply(null, arguments)
            })
        })

        it('Then request should return result false', function (done) {
          expect(resData).to.have.property('result').that.is.false
          expect(resData).to.have.property('error')
          done()
        })

        it(`Then property code of error should equal ${errors.userExist}`, function (done) {
          expect(resData.error).to.have.property('code').that.equals(errors.userExist)
          done()
        })
      })

      describe('When user 1 requests profile', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken)
            .base(baseUrl)
            .get(endpoints.profile)
            .json()
            .expectStatus(200)
            .end(function (_, raw, res) {
              resData = res
              done.apply(null, arguments)
            })
        })

        it('Then request should return true', function (done) {
          expect(resData).to.have.property('result').that.is.true
          expect(resData).to.not.have.property('error')
          expect(resData).to.have.property('user').that.is.an('object')
          expect(resData.user).to.have.property('guest').that.is.false
          done()
        })

        it(`Then property auths should contain ${authTypes.otp} type that is confirmed`, function (done) {
          const auths = resData.user.auths
          expect(auths).to.have.property(authTypes.otp).that.is.an('object')
          expect(auths[authTypes.otp]).to.have.property('confirmed').that.is.true
          done()
        })

        it(`Then property auths should contain ${authTypes.password} type that is confirmed`, function (done) {
          const auths = resData.user.auths
          expect(auths).to.have.property(authTypes.password).that.is.an('object')
          expect(auths[authTypes.password]).to.have.property('confirmed').that.is.true
          done()
        })
      })

      describe('When user 2 requests profile', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken2)
            .base(baseUrl)
            .get(endpoints.profile)
            .json()
            .expectStatus(200)
            .end(function (_, raw, res) {
              resData = res
              done.apply(null, arguments)
            })
        })

        it('Then request should return true', function (done) {
          expect(resData).to.have.property('result').that.is.true
          expect(resData).to.not.have.property('error')
          expect(resData).to.have.property('user').that.is.an('object')
          expect(resData.user).to.have.property('guest').that.is.false
          done()
        })

        it(`Then property auths should contain ${authTypes.otp2} type that is confirmed`, function (done) {
          const auths = resData.user.auths
          expect(auths).to.have.property(authTypes.otp2).that.is.an('object')
          expect(auths[authTypes.otp2]).to.have.property('confirmed').that.is.true
          done()
        })

        it(`Then property auths should not contain ${authTypes.password} type`, function (done) {
          expect(resData.user.auths).to.not.have.property(authTypes.password).that.is.an('object')
          done()
        })
      })
    })
  })

  // Password: Experimental group
  // Password: link without init (userNotFound)
  describe('I want to test password linking without linking initialisation', function () {
    context('Given user 1 with OTP account', function () {
      const deviceID = 'test' + (Math.floor(Math.random() * 99999))
      let apiToken = ''

      const phone = '+7' + (Math.floor(Math.random() * 999999999))
      const otpCode = staticCodes.otp

      const email = 'test' + (Math.floor(Math.random() * 99999)) + '@example.com'
      const password = 'password1'
      const pswdCode = staticCodes.password

      before(async function () {
        // main client
        const otpClient = await new helper.NewClient(deviceID)
          .otpGetCode(phone)
          .otpAuth(phone, otpCode)
          .end()

        apiToken = otpClient.apiToken
      })

      after(async function () {
        await helper.clearAll()
      })

      describe('When user 1 requests for link password account', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken)
            .base(baseUrl)
            .post(endpoints.passwordLink)
            .json()
            .send({
              type: authTypes.password,
              uid: email,
              password: password,
              code: pswdCode
            })
            .expectStatus(400)
            .end(function (_, raw, res) {
              resData = res
              done.apply(null, arguments)
            })
        })

        it('Then request should return result false', function (done) {
          expect(resData).to.have.property('result').that.is.false
          expect(resData).to.have.property('error')
          done()
        })

        it(`Then property code of error should equal ${errors.userNotFound}`, function (done) {
          expect(resData.error).to.have.property('code').that.equals(errors.userNotFound)
          done()
        })
      })

      describe('When user 1 requests profile', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken)
            .base(baseUrl)
            .get(endpoints.profile)
            .json()
            .expectStatus(200)
            .end(function (_, raw, res) {
              resData = res
              done.apply(null, arguments)
            })
        })

        it('Then request should return true', function (done) {
          expect(resData).to.have.property('result').that.is.true
          expect(resData).to.not.have.property('error')
          expect(resData).to.have.property('user').that.is.an('object')
          expect(resData.user).to.have.property('guest').that.is.false
          done()
        })

        it(`Then property auths should contain ${authTypes.otp} type that is confirmed`, function (done) {
          const auths = resData.user.auths
          expect(auths).to.have.property(authTypes.otp).that.is.an('object')
          expect(auths[authTypes.otp]).to.have.property('confirmed').that.is.true
          done()
        })

        it(`Then property auths should not contain ${authTypes.password} type`, function (done) {
          expect(resData.user.auths).to.not.have.property(authTypes.password).that.is.an('object')
          done()
        })
      })
    })
  })

  // Password: login to temp user by another user (user not found)
  describe('I want to test that after the initialization of the password linking, the account does not yet exist and it is impossible to login from another session', function () {
    context('Given user 1 with OTP auth identity, initialised linking for password auth identity and user 2 without account', function () {
      const deviceID = 'test' + (Math.floor(Math.random() * 99999))
      const deviceID2 = 'test' + (Math.floor(Math.random() * 99999))
      let apiToken2 = ''

      const phone = '+7' + (Math.floor(Math.random() * 999999999))
      const otpCode = staticCodes.otp

      const email = 'test' + (Math.floor(Math.random() * 99999)) + '@example.com'
      const password = 'password1'

      before(async function () {
        // main client
        await new helper.NewClient(deviceID)
          .otpGetCode(phone)
          .otpAuth(phone, otpCode)
          .passwordInitLink(email)
          .end()

        const user2 = await new helper.NewClient(deviceID2).end()

        apiToken2 = user2.apiToken
      })

      after(async function () {
        await helper.clearAll()
      })

      describe('When user 2 requests password login with credentials of not linked auth identity', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken2)
            .base(baseUrl)
            .post(endpoints.passwordLogin)
            .json()
            .send({
              type: authTypes.password,
              email: email,
              password: password
            })
            .expectStatus(400)
            .end(function (_, raw, res) {
              resData = res
              done.apply(null, arguments)
            })
        })

        it('Then request should return result false', function (done) {
          expect(resData).to.have.property('result').that.is.false
          expect(resData).to.have.property('error')
          done()
        })

        it(`Then property code of error should equal ${errors.userNotFound}`, function (done) {
          expect(resData.error).to.have.property('code').that.equals(errors.userNotFound)
          done()
        })
      })
    })
  })

  // Password: recovery temp user
  describe('I want to test that after the initialization of the password linking, recovery flow should not work', function () {
    context('Given user 1 with OTP auth identity, initialised linking for password auth identity and user 2 without account', function () {
      const deviceID = 'test' + (Math.floor(Math.random() * 99999))
      const deviceID2 = 'test' + (Math.floor(Math.random() * 99999))
      let apiToken2 = ''

      const phone = '+7' + (Math.floor(Math.random() * 999999999))
      const otpCode = staticCodes.otp

      const email = 'test' + (Math.floor(Math.random() * 99999)) + '@example.com'
      const password = 'password1'
      const code = staticCodes.password

      before(async function () {
        // main client
        await new helper.NewClient(deviceID)
          .otpGetCode(phone)
          .otpAuth(phone, otpCode)
          .passwordInitLink(email)
          .end()

        const user2 = await new helper.NewClient(deviceID2).end()

        apiToken2 = user2.apiToken
      })

      after(async function () {
        await helper.clearAll()
      })

      describe('When user 2 requests to recovery with the same password credentials', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken2)
            .base(baseUrl)
            .post(endpoints.passwordRecovery)
            .json()
            .send({
              type: authTypes.password,
              uid: email
            })
            .expectStatus(400)
            .end(function (_, raw, res) {
              resData = res
              done.apply(null, arguments)
            })
        })

        it('Then request should return result false', function (done) {
          expect(resData).to.have.property('result').that.is.false
          expect(resData).to.have.property('error')
          done()
        })

        it(`Then property code of error should equal ${errors.userNotFound}`, function (done) {
          expect(resData.error).to.have.property('code').that.equals(errors.userNotFound)
          done()
        })
      })

      describe('When user 2 requests to recovery validate with the same password credentials', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken2)
            .base(baseUrl)
            .post(endpoints.passwordRecoveryValidate)
            .json()
            .send({
              type: authTypes.password,
              uid: email,
              code: code
            })
            .expectStatus(400)
            .end(function (_, raw, res) {
              resData = res
              done.apply(null, arguments)
            })
        })

        it('Then request should return result false', function (done) {
          expect(resData).to.have.property('result').that.is.false
          expect(resData).to.have.property('error')
          done()
        })

        it(`Then property code of error should equal ${errors.userNotFound}`, function (done) {
          expect(resData.error).to.have.property('code').that.equals(errors.userNotFound)
          done()
        })
      })

      describe('When user 2 requests to recovery reset with the same password credentials', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken2)
            .base(baseUrl)
            .post(endpoints.passwordRecoveryReset)
            .json()
            .send({
              type: authTypes.password,
              uid: email,
              code: code,
              password: password
            })
            .expectStatus(400)
            .end(function (_, raw, res) {
              resData = res
              done.apply(null, arguments)
            })
        })

        it('Then request should return result false', function (done) {
          expect(resData).to.have.property('result').that.is.false
          expect(resData).to.have.property('error')
          done()
        })

        it(`Then property code of error should equal ${errors.userNotFound}`, function (done) {
          expect(resData.error).to.have.property('code').that.equals(errors.userNotFound)
          done()
        })
      })
    })
  })

  // Password: recovery linked user
  describe('I want to test that after the password linking, recovery flow should work', function () {
    context('Given user 1 with OTP auth identity, linked password auth identity and user 2 without account', function () {
      const deviceID = 'test' + (Math.floor(Math.random() * 99999))
      const deviceID2 = 'test' + (Math.floor(Math.random() * 99999))
      let apiToken2 = ''

      const phone = '+7' + (Math.floor(Math.random() * 999999999))
      const otpCode = staticCodes.otp

      const email = 'test' + (Math.floor(Math.random() * 99999)) + '@example.com'
      const password = 'password1'
      const code = staticCodes.password

      before(async function () {
        // main client
        await new helper.NewClient(deviceID)
          .otpGetCode(phone)
          .otpAuth(phone, otpCode)
          .passwordInitLink(email)
          .passwordLink(email, password)
          .end()

        const user2 = await new helper.NewClient(deviceID2).end()

        apiToken2 = user2.apiToken
      })

      after(async function () {
        await helper.clearAll()
      })

      describe('When user 2 requests to recovery with the same password credentials', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken2)
            .base(baseUrl)
            .post(endpoints.passwordRecovery)
            .json()
            .send({
              type: authTypes.password,
              uid: email
            })
            .expectStatus(200)
            .end(function (_, raw, res) {
              resData = res
              done.apply(null, arguments)
            })
        })

        it('Then request should return result true', function (done) {
          expect(resData).to.have.property('result').that.is.true
          expect(resData).to.not.have.property('error')
          done()
        })
      })

      describe('When user 2 requests to recovery validate with the same password credentials', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken2)
            .base(baseUrl)
            .post(endpoints.passwordRecoveryValidate)
            .json()
            .send({
              type: authTypes.password,
              uid: email,
              code: code
            })
            .expectStatus(200)
            .end(function (_, raw, res) {
              resData = res
              done.apply(null, arguments)
            })
        })

        it('Then request should return result true', function (done) {
          expect(resData).to.have.property('result').that.is.true
          expect(resData).to.not.have.property('error')
          done()
        })
      })

      describe('When user 2 requests to recovery reset with the same password credentials', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken2)
            .base(baseUrl)
            .post(endpoints.passwordRecoveryReset)
            .json()
            .send({
              type: authTypes.password,
              uid: email,
              code: code,
              password: password
            })
            .expectStatus(200)
            .end(function (_, raw, res) {
              resData = res
              done.apply(null, arguments)
            })
        })

        it('Then request should return result true', function (done) {
          expect(resData).to.have.property('result').that.is.true
          expect(resData).to.not.have.property('error')
          done()
        })
      })
    })
  })

  // Password: link account by 2 users without init by another user
  describe('I want to test that one user can initialize password linking, but another user can complete linking and it will no longer be available even if this user initialized linking', function () {
    context('Given user 1 with OTP account and user 2 with OTP account, user 1 initialized password linking with base timeount', function () {
      const deviceID = 'test' + (Math.floor(Math.random() * 99999))
      const deviceID2 = 'test' + (Math.floor(Math.random() * 99999))
      let apiToken = ''
      let apiToken2 = ''

      const phone = '+7' + (Math.floor(Math.random() * 999999999))
      const phone2 = '+7' + (Math.floor(Math.random() * 999999999))
      const otpCode = staticCodes.otp
      const otpCode2 = staticCodes.otp2

      const email = 'test' + (Math.floor(Math.random() * 99999)) + '@example.com'
      const password = 'password1'
      const pswdCode = staticCodes.password

      before(async function () {
        // main client
        const user1 = await new helper.NewClient(deviceID)
          .otpGetCode(phone, authTypes.otp)
          .otpAuth(phone, otpCode, authTypes.otp)
          .end()

        const user2 = await new helper.NewClient(deviceID2)
          .otpGetCode(phone2, authTypes.otp2)
          .otpAuth(phone2, otpCode2, authTypes.otp2)
          .end()

        await user1.passwordInitLink(email).end()

        await helper.sleep(config.sentCodeTimeout)

        apiToken = user1.apiToken
        apiToken2 = user2.apiToken
      })

      after(async function () {
        await helper.clearAll()
      })

      describe('When user 2 requests for link password account', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken2)
            .base(baseUrl)
            .post(endpoints.passwordLink)
            .json()
            .send({
              type: authTypes.password,
              uid: email,
              password: password,
              code: pswdCode
            })
            .expectStatus(200)
            .end(function (_, raw, res) {
              resData = res
              done.apply(null, arguments)
            })
        })

        it('Then request should return result true', function (done) {
          expect(resData).to.have.property('result').that.is.true
          expect(resData).to.not.have.property('error')
          done()
        })
      })

      describe('When user 1 requests for link password account', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken)
            .base(baseUrl)
            .post(endpoints.passwordLink)
            .json()
            .send({
              type: authTypes.password,
              uid: email,
              password: password,
              code: pswdCode
            })
            .expectStatus(400)
            .end(function (_, raw, res) {
              resData = res
              done.apply(null, arguments)
            })
        })

        it('Then request should return result false', function (done) {
          expect(resData).to.have.property('result').that.is.false
          expect(resData).to.have.property('error')
          done()
        })

        it(`Then property code of error should equal ${errors.userExist}`, function (done) {
          expect(resData.error).to.have.property('code').that.equals(errors.userExist)
          done()
        })
      })

      describe('When user 1 requests profile', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken)
            .base(baseUrl)
            .get(endpoints.profile)
            .json()
            .expectStatus(200)
            .end(function (_, raw, res) {
              resData = res
              done.apply(null, arguments)
            })
        })

        it('Then request should return true', function (done) {
          expect(resData).to.have.property('result').that.is.true
          expect(resData).to.not.have.property('error')
          expect(resData).to.have.property('user').that.is.an('object')
          expect(resData.user).to.have.property('guest').that.is.false
          done()
        })

        it(`Then property auths should contain ${authTypes.otp} type that is confirmed`, function (done) {
          const auths = resData.user.auths
          expect(auths).to.have.property(authTypes.otp).that.is.an('object')
          expect(auths[authTypes.otp]).to.have.property('confirmed').that.is.true
          done()
        })

        it(`Then property auths should not contain ${authTypes.password} type`, function (done) {
          expect(resData.user.auths).to.not.have.property(authTypes.password).that.is.an('object')
          done()
        })
      })

      describe('When user 2 requests profile', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken2)
            .base(baseUrl)
            .get(endpoints.profile)
            .json()
            .expectStatus(200)
            .end(function (_, raw, res) {
              resData = res
              done.apply(null, arguments)
            })
        })

        it('Then request should return true', function (done) {
          expect(resData).to.have.property('result').that.is.true
          expect(resData).to.not.have.property('error')
          expect(resData).to.have.property('user').that.is.an('object')
          expect(resData.user).to.have.property('guest').that.is.false
          done()
        })

        it(`Then property auths should contain ${authTypes.otp2} type that is confirmed`, function (done) {
          const auths = resData.user.auths
          expect(auths).to.have.property(authTypes.otp2).that.is.an('object')
          expect(auths[authTypes.otp2]).to.have.property('confirmed').that.is.true
          done()
        })

        it(`Then property auths should contain ${authTypes.password} type that is confirmed`, function (done) {
          const auths = resData.user.auths
          expect(auths).to.have.property(authTypes.password).that.is.an('object')
          expect(auths[authTypes.password]).to.have.property('confirmed').that.is.true
          done()
        })
      })
    })
  })

  // #2 Link OTP
  // OTP: base link
  describe('I want to test OTP linking', function () {
    context('Given user 1 with confirmed password account', function () {
      const deviceID = 'test' + (Math.floor(Math.random() * 99999))
      let apiToken = ''

      const phone = '+7' + (Math.floor(Math.random() * 999999999))
      const otpCode = staticCodes.otp

      const email = 'test' + (Math.floor(Math.random() * 99999)) + '@example.com'
      const password = 'password1'

      before(async function () {
        // main client
        const passwordClient = await new helper.NewClient(deviceID)
          .passwordRegister(email, password)
          .getProfile()
          .passwordConfirm(email)
          .end()

        apiToken = passwordClient.apiToken
      })

      after(async function () {
        await helper.clearAll()
      })

      describe('When user 1 requests for init linking OTP account', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken)
            .base(baseUrl)
            .post(endpoints.otpGetCode)
            .pathParams({
              key: authTypes.otp
            })
            .json()
            .send({
              phone: phone
            })
            .expectStatus(200)
            .end(function (_, raw, res) {
              resData = res
              done.apply(null, arguments)
            })
        })

        it('Then request should return result true', function (done) {
          expect(resData).to.have.property('result').that.is.true
          expect(resData).to.not.have.property('error')
          done()
        })
      })

      describe('When user 1 requests for link OTP account', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken)
            .base(baseUrl)
            .post(endpoints.otpAuth)
            .pathParams({
              key: authTypes.otp
            })
            .json()
            .send({
              phone: phone,
              code: otpCode
            })
            .expectStatus(200)
            .end(function (_, raw, res) {
              resData = res
              done.apply(null, arguments)
            })
        })

        it('Then request should return result true', function (done) {
          expect(resData).to.have.property('result').that.is.true
          expect(resData).to.not.have.property('error')
          done()
        })
      })

      describe('When user 1 requests profile', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken)
            .base(baseUrl)
            .get(endpoints.profile)
            .json()
            .expectStatus(200)
            .end(function (_, raw, res) {
              resData = res
              done.apply(null, arguments)
            })
        })

        it('Then request should return true', function (done) {
          expect(resData).to.have.property('result').that.is.true
          expect(resData).to.not.have.property('error')
          expect(resData).to.have.property('user').that.is.an('object')
          expect(resData.user).to.have.property('guest').that.is.false
          done()
        })

        it(`Then property auths should contain ${authTypes.password} type that is confirmed`, function (done) {
          const auths = resData.user.auths
          expect(auths).to.have.property(authTypes.password).that.is.an('object')
          expect(auths[authTypes.password]).to.have.property('confirmed').that.is.true
          done()
        })

        it(`Then property auths should contain ${authTypes.otp} type that is confirmed`, function (done) {
          const auths = resData.user.auths
          expect(auths).to.have.property(authTypes.otp).that.is.an('object')
          expect(auths[authTypes.otp]).to.have.property('confirmed').that.is.true
          done()
        })
      })
    })
  })

  // OTP: same otp type and differrent auth keys
  describe('I want to test linking with same OTP type and different auth key', function () {
    context('Given user 1 with OTP account and auth identity with the same auth type and different auth key', function () {
      const deviceID = 'test' + (Math.floor(Math.random() * 99999))
      let apiToken = ''

      const phone = '+7' + (Math.floor(Math.random() * 999999999))
      const phone2 = '+7' + (Math.floor(Math.random() * 999999999))
      const otpCode = staticCodes.otp
      const otpCode2 = staticCodes.otp2

      before(async function () {
        // main client
        const otpClient = await new helper.NewClient(deviceID)
          .otpGetCode(phone)
          .otpAuth(phone, otpCode)
          .end()

        apiToken = otpClient.apiToken
      })

      after(async function () {
        await helper.clearAll()
      })

      describe('When user 1 requests for init linking OTP account', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken)
            .base(baseUrl)
            .post(endpoints.otpGetCode)
            .pathParams({
              key: authTypes.otp2
            })
            .json()
            .send({
              phone: phone2
            })
            .expectStatus(200)
            .end(function (_, raw, res) {
              resData = res
              done.apply(null, arguments)
            })
        })

        it('Then request should return result true', function (done) {
          expect(resData).to.have.property('result').that.is.true
          expect(resData).to.not.have.property('error')
          done()
        })
      })

      describe('When user 1 requests for link OTP account', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken)
            .base(baseUrl)
            .post(endpoints.otpAuth)
            .pathParams({
              key: authTypes.otp2
            })
            .json()
            .send({
              phone: phone2,
              code: otpCode2
            })
            .expectStatus(200)
            .end(function (_, raw, res) {
              resData = res
              done.apply(null, arguments)
            })
        })

        it('Then request should return result true', function (done) {
          expect(resData).to.have.property('result').that.is.true
          expect(resData).to.not.have.property('error')
          done()
        })
      })

      describe('When user 1 requests profile', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken)
            .base(baseUrl)
            .get(endpoints.profile)
            .json()
            .expectStatus(200)
            .end(function (_, raw, res) {
              resData = res
              done.apply(null, arguments)
            })
        })

        it('Then request should return true', function (done) {
          expect(resData).to.have.property('result').that.is.true
          expect(resData).to.not.have.property('error')
          expect(resData).to.have.property('user').that.is.an('object')
          expect(resData.user).to.have.property('guest').that.is.false
          done()
        })

        it(`Then property auths should contain ${authTypes.otp} type that is confirmed`, function (done) {
          const auths = resData.user.auths
          expect(auths).to.have.property(authTypes.otp).that.is.an('object')
          expect(auths[authTypes.otp]).to.have.property('confirmed').that.is.true
          done()
        })

        it(`Then uid property of auths.${authTypes.otp} should equal uid of phone 1 and not equals of phone 2`, function (done) {
          const uid = resData.user.auths[authTypes.otp].uid
          expect(uid).equals(phone)
          expect(uid).not.equals(phone2)
          done()
        })

        it(`Then property auths should contain ${authTypes.otp2} type that is confirmed`, function (done) {
          const auths = resData.user.auths
          expect(auths).to.have.property(authTypes.otp2).that.is.an('object')
          expect(auths[authTypes.otp2]).to.have.property('confirmed').that.is.true
          done()
        })

        it(`Then uid property of auths.${authTypes.otp2} should equal uid of phone 2 and not equals of phone 1`, function (done) {
          const uid = resData.user.auths[authTypes.otp2].uid
          expect(uid).not.equals(phone)
          expect(uid).equals(phone2)
          done()
        })
      })
    })
  })

  // OTP: same otp type and auth key
  describe('I want to test OTP linking with the same auth key and auth type', function () {
    context('Given user 1 with OTP account and auth identity with the same auth keys and auth types', function () {
      const deviceID = 'test' + (Math.floor(Math.random() * 99999))
      let apiToken = ''

      const phone = '+7' + (Math.floor(Math.random() * 999999999))
      const phone2 = '+7' + (Math.floor(Math.random() * 999999999))
      const otpCode = staticCodes.otp

      before(async function () {
        // main client
        const otpClient = await new helper.NewClient(deviceID)
          .otpGetCode(phone)
          .otpAuth(phone, otpCode)
          .end()

        apiToken = otpClient.apiToken
      })

      after(async function () {
        await helper.clearAll()
      })

      describe('When user 1 requests for init link OTP account', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken)
            .base(baseUrl)
            .post(endpoints.otpGetCode)
            .pathParams({
              key: authTypes.otp
            })
            .json()
            .send({
              phone: phone2
            })
            .expectStatus(400)
            .end(function (_, raw, res) {
              resData = res
              done.apply(null, arguments)
            })
        })

        it('Then request should return result false', function (done) {
          expect(resData).to.have.property('result').that.is.false
          expect(resData).to.have.property('error')
          done()
        })

        it(`Then property code of error should equal ${errors.authIdentityAlreadyExists}`, function (done) {
          expect(resData.error).to.have.property('code').that.equals(errors.authIdentityAlreadyExists)
          done()
        })
      })

      describe('When user 1 requests for link OTP account', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken)
            .base(baseUrl)
            .post(endpoints.otpAuth)
            .pathParams({
              key: authTypes.otp
            })
            .json()
            .send({
              phone: phone2,
              code: otpCode
            })
            .expectStatus(400)
            .end(function (_, raw, res) {
              resData = res
              done.apply(null, arguments)
            })
        })

        it('Then request should return result false', function (done) {
          expect(resData).to.have.property('result').that.is.false
          expect(resData).to.have.property('error')
          done()
        })

        it(`Then property code of error should equal ${errors.userNotFound}`, function (done) {
          expect(resData.error).to.have.property('code').that.equals(errors.userNotFound)
          done()
        })
      })

      describe('When user 1 requests profile', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken)
            .base(baseUrl)
            .get(endpoints.profile)
            .json()
            .expectStatus(200)
            .end(function (_, raw, res) {
              resData = res
              done.apply(null, arguments)
            })
        })

        it('Then request should return true', function (done) {
          expect(resData).to.have.property('result').that.is.true
          expect(resData).to.not.have.property('error')
          expect(resData).to.have.property('user').that.is.an('object')
          expect(resData.user).to.have.property('guest').that.is.false
          done()
        })

        it(`Then property auths should contain ${authTypes.otp} type that is confirmed`, function (done) {
          const auths = resData.user.auths
          expect(auths).to.have.property(authTypes.otp).that.is.an('object')
          expect(auths[authTypes.otp]).to.have.property('confirmed').that.is.true
          done()
        })

        it(`Then uid property of auths.${authTypes.otp} should equal uid of phone 1 and not equals of phone 2`, function (done) {
          const uid = resData.user.auths[authTypes.otp].uid
          expect(uid).equals(phone)
          expect(uid).not.equals(phone2)
          done()
        })
      })
    })
  })

  // OTP: not confirmed base account
  // TODO: user_not_found? May be user_not_confirmed?
  describe('I want to test OTP linking with not confirmed existing password account', function () {
    context('Given user 1 with password account and OTP auth identity', function () {
      const deviceID = 'test' + (Math.floor(Math.random() * 99999))
      let apiToken = ''

      const email = 'test' + (Math.floor(Math.random() * 99999)) + '@example.com'
      const password = 'password1'

      const phone = '+7' + (Math.floor(Math.random() * 999999999))
      const otpCode = staticCodes.otp

      before(async function () {
        // main client
        const passwordClient = await new helper.NewClient(deviceID)
          .passwordRegister(email, password)
          .end()

        apiToken = passwordClient.apiToken
      })

      after(async function () {
        await helper.clearAll()
      })

      describe('When user 1 requests for init linking OTP account', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken)
            .base(baseUrl)
            .post(endpoints.otpGetCode)
            .pathParams({
              key: authTypes.otp
            })
            .json()
            .send({
              phone: phone
            })
            .expectStatus(400)
            .end(function (_, raw, res) {
              resData = res
              done.apply(null, arguments)
            })
        })

        it('Then request should return result false', function (done) {
          expect(resData).to.have.property('result').that.is.false
          expect(resData).to.have.property('error')
          done()
        })

        it(`Then property code of error should equal ${errors.userNotConfirmed}`, function (done) {
          expect(resData.error).to.have.property('code').that.equals(errors.userNotConfirmed)
          done()
        })
      })

      describe('When user 1 requests for link OTP account', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken)
            .base(baseUrl)
            .post(endpoints.otpAuth)
            .pathParams({
              key: authTypes.otp
            })
            .json()
            .send({
              phone: phone,
              code: otpCode
            })
            .expectStatus(400)
            .end(function (_, raw, res) {
              resData = res
              done.apply(null, arguments)
            })
        })

        it('Then request should return result false', function (done) {
          expect(resData).to.have.property('result').that.is.false
          expect(resData).to.have.property('error')
          done()
        })

        it(`Then property code of error should equal ${errors.userNotFound}`, function (done) {
          expect(resData.error).to.have.property('code').that.equals(errors.userNotFound)
          done()
        })
      })

      describe('When user 1 requests profile', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken)
            .base(baseUrl)
            .get(endpoints.profile)
            .json()
            .expectStatus(200)
            .end(function (_, raw, res) {
              resData = res
              done.apply(null, arguments)
            })
        })

        it('Then request should return true', function (done) {
          expect(resData).to.have.property('result').that.is.true
          expect(resData).to.not.have.property('error')
          expect(resData).to.have.property('user').that.is.an('object')
          expect(resData.user).to.have.property('guest').that.is.false
          done()
        })

        it(`Then property auths should contain ${authTypes.password} type that is not confirmed`, function (done) {
          const auths = resData.user.auths
          expect(auths).to.have.property(authTypes.password).that.is.an('object')
          expect(auths[authTypes.password]).to.have.property('confirmed').that.is.false
          done()
        })

        it(`Then property auths should not contain ${authTypes.otp}`, function (done) {
          expect(resData.user.auths).to.not.have.property(authTypes.otp)
          done()
        })
      })
    })
  })

  // OTP: not found temp user in profile
  describe('I want to test that after the initialization of the OTP linking, this auth identity does not yet exists after profile request', function () {
    context('Given user 1 with confirmed password auth identity, initialised linking for OTP auth identity', function () {
      const deviceID = 'test' + (Math.floor(Math.random() * 99999))
      let apiToken = ''

      const phone = '+7' + (Math.floor(Math.random() * 999999999))

      const email = 'test' + (Math.floor(Math.random() * 99999)) + '@example.com'
      const password = 'password1'

      before(async function () {
        // main client
        const user1 = await new helper.NewClient(deviceID)
          .passwordRegister(email, password)
          .getProfile()
          .passwordConfirm(email)
          .otpGetCode(phone)
          .end()

        apiToken = user1.apiToken
      })

      after(async function () {
        await helper.clearAll()
      })

      describe('When user 1 requests profile', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken)
            .base(baseUrl)
            .get(endpoints.profile)
            .json()
            .expectStatus(200)
            .end(function (_, raw, res) {
              resData = res
              done.apply(null, arguments)
            })
        })

        it('Then request should return true', function (done) {
          expect(resData).to.have.property('result').that.is.true
          expect(resData).to.not.have.property('error')
          expect(resData).to.have.property('user').that.is.an('object')
          expect(resData.user).to.have.property('guest').that.is.false
          done()
        })

        it(`Then property auths should contain ${authTypes.password} type that is confirmed`, function (done) {
          const auths = resData.user.auths
          expect(auths).to.have.property(authTypes.password).that.is.an('object')
          expect(auths[authTypes.password]).to.have.property('confirmed').that.is.true
          done()
        })

        it(`Then property auths should not contain ${authTypes.otp} type`, function (done) {
          expect(resData.user.auths).to.not.have.property(authTypes.otp)
          done()
        })
      })
    })
  })

  // OTP: link already registered confirmed account flow (user exists) (requirements: no merge mode)
  describe('I want to test OTP linking with already registered account', function () {
    context('Given user 1 with confirmed password account and user 2 with OTP account', function () {
      const deviceID = 'test' + (Math.floor(Math.random() * 99999))
      const deviceID2 = 'test' + (Math.floor(Math.random() * 99999))
      let apiToken = ''

      const phone = '+7' + (Math.floor(Math.random() * 999999999))
      const otpCode = staticCodes.otp

      const email = 'test' + (Math.floor(Math.random() * 99999)) + '@example.com'
      const password = 'password1'

      before(async function () {
        if (config.merge) {
          this.skip()
        }
        // main client
        const passwordClient = await new helper.NewClient(deviceID)
          .passwordRegister(email, password)
          .getProfile()
          .passwordConfirm(email)
          .end()

        await new helper.NewClient(deviceID2)
          .otpGetCode(phone)
          .otpAuth(phone, otpCode)
          .end()

        apiToken = passwordClient.apiToken
      })

      after(async function () {
        await helper.clearAll()
      })

      describe('When user 1 requests for init linking OTP account', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken)
            .base(baseUrl)
            .post(endpoints.otpGetCode)
            .pathParams({
              key: authTypes.otp
            })
            .json()
            .send({
              phone: phone
            })
            .expectStatus(400)
            .end(function (_, raw, res) {
              resData = res
              done.apply(null, arguments)
            })
        })

        it('Then request should return result false', function (done) {
          expect(resData).to.have.property('result').that.is.false
          expect(resData).to.have.property('error')
          done()
        })

        it(`Then property code of error should equal ${errors.userExist}`, function (done) {
          expect(resData.error).to.have.property('code').that.equals(errors.userExist)
          done()
        })
      })

      describe('When user 1 requests for link OTP account', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken)
            .base(baseUrl)
            .post(endpoints.otpAuth)
            .pathParams({
              key: authTypes.otp
            })
            .json()
            .send({
              phone: phone,
              code: otpCode
            })
            .expectStatus(400)
            .end(function (_, raw, res) {
              resData = res
              done.apply(null, arguments)
            })
        })

        it('Then request should return result false', function (done) {
          expect(resData).to.have.property('result').that.is.false
          expect(resData).to.have.property('error')
          done()
        })

        it(`Then property code of error should equal ${errors.userExist}`, function (done) {
          expect(resData.error).to.have.property('code').that.equals(errors.userExist)
          done()
        })
      })

      describe('When user 1 requests profile', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken)
            .base(baseUrl)
            .get(endpoints.profile)
            .json()
            .expectStatus(200)
            .end(function (_, raw, res) {
              resData = res
              done.apply(null, arguments)
            })
        })

        it('Then request should return true', function (done) {
          expect(resData).to.have.property('result').that.is.true
          expect(resData).to.not.have.property('error')
          expect(resData).to.have.property('user').that.is.an('object')
          expect(resData.user).to.have.property('guest').that.is.false
          done()
        })

        it(`Then property auths should contain ${authTypes.password} type that is confirmed`, function (done) {
          const auths = resData.user.auths
          expect(auths).to.have.property(authTypes.password).that.is.an('object')
          expect(auths[authTypes.password]).to.have.property('confirmed').that.is.true
          done()
        })

        it(`Then property auths should not contain ${authTypes.otp}`, function (done) {
          expect(resData.user.auths).to.not.have.property(authTypes.otp)
          done()
        })
      })
    })
  })

  // OTP: login to linked account by another user
  describe('I want to test that after the OTP linking, the account does exist and it is possible to login from another session', function () {
    context('Given user 1 with confirmed password auth identity, linked OTP auth identity and user 2 without account', function () {
      const deviceID = 'test' + (Math.floor(Math.random() * 99999))
      const deviceID2 = 'test' + (Math.floor(Math.random() * 99999))
      let apiToken2 = ''

      const phone = '+7' + (Math.floor(Math.random() * 999999999))
      const otpCode = staticCodes.otp

      const email = 'test' + (Math.floor(Math.random() * 99999)) + '@example.com'
      const password = 'password1'

      before(async function () {
        // main client
        await new helper.NewClient(deviceID)
          .passwordRegister(email, password)
          .getProfile()
          .passwordConfirm(email)
          .otpGetCode(phone)
          .otpAuth(phone, otpCode)
          .end()

        const user2 = await new helper.NewClient(deviceID2).end()

        apiToken2 = user2.apiToken
      })

      after(async function () {
        await helper.clearAll()
      })

      describe('When user 2 requests OTP get code with credentials of linked auth identity', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken2)
            .base(baseUrl)
            .post(endpoints.otpGetCode)
            .pathParams({
              key: authTypes.otp
            })
            .json()
            .send({
              phone: phone
            })
            .expectStatus(200)
            .end(function (_, raw, res) {
              resData = res
              done.apply(null, arguments)
            })
        })

        it('Then request should return result true', function (done) {
          expect(resData).to.have.property('result').that.is.true
          expect(resData).to.not.have.property('error')
          done()
        })
      })

      describe('When user 2 requests OTP auth with credentials of linked auth identity', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken2)
            .base(baseUrl)
            .post(endpoints.otpAuth)
            .pathParams({
              key: authTypes.otp
            })
            .json()
            .send({
              phone: phone,
              code: otpCode
            })
            .expectStatus(200)
            .end(function (_, raw, res) {
              resData = res
              done.apply(null, arguments)
            })
        })

        it('Then request should return result true', function (done) {
          expect(resData).to.have.property('result').that.is.true
          expect(resData).to.not.have.property('error')
          done()
        })
      })
    })
  })

  // OTP: inject register after link init flow (requirements: no merge mode)
  describe('I want to test that if the user has not completed the linking of the OTP account to the end, then under these credentials you can register and the original user will not be able to complete the linking', function () {
    context('Given user 1 with password account and user 2 without account, user 1 initialized linking OTP account and base timeout', function () {
      const deviceID = 'test' + (Math.floor(Math.random() * 99999))
      const deviceID2 = 'test' + (Math.floor(Math.random() * 99999))
      let apiToken = ''
      let apiToken2 = ''

      const phone = '+7' + (Math.floor(Math.random() * 999999999))
      const otpCode = staticCodes.otp

      const email = 'test' + (Math.floor(Math.random() * 99999)) + '@example.com'
      const password = 'password1'

      before(async function () {
        if (config.merge) {
          this.skip()
        }
        // main client
        const user1 = await new helper.NewClient(deviceID)
          .passwordRegister(email, password)
          .getProfile()
          .passwordConfirm(email)
          .otpGetCode(phone)
          .end()

        const user2 = await new helper.NewClient(deviceID2).end()

        await helper.sleep(config.sentCodeTimeout)

        apiToken = user1.apiToken
        apiToken2 = user2.apiToken
      })

      after(async function () {
        await helper.clearAll()
      })

      describe('When user 2 requests get otp code account', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken2)
            .base(baseUrl)
            .post(endpoints.otpGetCode)
            .pathParams({
              key: authTypes.otp
            })
            .json()
            .send({
              phone: phone
            })
            .expectStatus(200)
            .end(function (_, raw, res) {
              resData = res
              done.apply(null, arguments)
            })
        })

        it('Then request should return result true', function (done) {
          expect(resData).to.have.property('result').that.is.true
          expect(resData).to.not.have.property('error')
          done()
        })
      })

      describe('When user 2 requests otp auth account', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken2)
            .base(baseUrl)
            .post(endpoints.otpAuth)
            .pathParams({
              key: authTypes.otp
            })
            .json()
            .send({
              phone: phone,
              code: otpCode
            })
            .expectStatus(200)
            .end(function (_, raw, res) {
              resData = res
              done.apply(null, arguments)
            })
        })

        it('Then request should return result true', function (done) {
          expect(resData).to.have.property('result').that.is.true
          expect(resData).to.not.have.property('error')
          done()
        })
      })

      describe('When user 1 requests for link account', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken)
            .base(baseUrl)
            .post(endpoints.otpAuth)
            .pathParams({
              key: authTypes.otp
            })
            .json()
            .send({
              phone: phone,
              code: otpCode
            })
            .expectStatus(400)
            .end(function (_, raw, res) {
              resData = res
              done.apply(null, arguments)
            })
        })

        it('Then request should return result false', function (done) {
          expect(resData).to.have.property('result').that.is.false
          expect(resData).to.have.property('error')
          done()
        })

        it(`Then property code of error should equal ${errors.userExist}`, function (done) {
          expect(resData.error).to.have.property('code').that.equals(errors.userExist)
          done()
        })
      })
    })
  })

  // OTP: link account by 2 users (requirements: no merge mode)
  describe('I want to test that we can initialize OTP linking from different accounts, but only one can complete it, for another user it will no longer be available', function () {
    context('Given user 1 with password account and user 2 with password account, user 1 initialized OTP linking with base timeount', function () {
      const deviceID = 'test' + (Math.floor(Math.random() * 99999))
      const deviceID2 = 'test' + (Math.floor(Math.random() * 99999))
      let apiToken = ''
      let apiToken2 = ''

      const phone = '+7' + (Math.floor(Math.random() * 999999999))
      const otpCode = staticCodes.otp

      const email = 'test' + (Math.floor(Math.random() * 99999)) + '@example.com'
      const email2 = 'test' + (Math.floor(Math.random() * 99999)) + '@example.com'
      const password = 'password1'
      const password2 = 'password2'

      before(async function () {
        if (config.merge) {
          this.skip()
        }
        // main client
        const user1 = await new helper.NewClient(deviceID)
          .passwordRegister(email, password, authTypes.password)
          .getProfile()
          .passwordConfirm(email, authTypes.password)
          .end()

        const user2 = await new helper.NewClient(deviceID2)
          .passwordRegister(email2, password2, authTypes.password2)
          .getProfile()
          .passwordConfirm(email2, authTypes.password2)
          .end()

        await user1.otpGetCode(phone).end()

        await helper.sleep(config.sentCodeTimeout)

        apiToken = user1.apiToken
        apiToken2 = user2.apiToken
      })

      after(async function () {
        await helper.clearAll()
      })

      describe('When user 2 requests for init linking OTP account', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken2)
            .base(baseUrl)
            .post(endpoints.otpGetCode)
            .pathParams({
              key: authTypes.otp
            })
            .json()
            .send({
              phone: phone
            })
            .expectStatus(200)
            .end(function (_, raw, res) {
              resData = res
              done.apply(null, arguments)
            })
        })

        it('Then request should return result true', function (done) {
          expect(resData).to.have.property('result').that.is.true
          expect(resData).to.not.have.property('error')
          done()
        })
      })

      describe('When user 1 requests for link OTP account', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken)
            .base(baseUrl)
            .post(endpoints.otpAuth)
            .pathParams({
              key: authTypes.otp
            })
            .json()
            .send({
              phone: phone,
              code: otpCode
            })
            .expectStatus(200)
            .end(function (_, raw, res) {
              resData = res
              done.apply(null, arguments)
            })
        })

        it('Then request should return result true', function (done) {
          expect(resData).to.have.property('result').that.is.true
          expect(resData).to.not.have.property('error')
          done()
        })
      })

      describe('When user 2 requests for link password account', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken2)
            .base(baseUrl)
            .post(endpoints.otpAuth)
            .pathParams({
              key: authTypes.otp
            })
            .json()
            .send({
              phone: phone,
              code: otpCode
            })
            .expectStatus(400)
            .end(function (_, raw, res) {
              resData = res
              done.apply(null, arguments)
            })
        })

        it('Then request should return result false', function (done) {
          expect(resData).to.have.property('result').that.is.false
          expect(resData).to.have.property('error')
          done()
        })

        it(`Then property code of error should equal ${errors.userExist}`, function (done) {
          expect(resData.error).to.have.property('code').that.equals(errors.userExist)
          done()
        })
      })

      describe('When user 1 requests profile', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken)
            .base(baseUrl)
            .get(endpoints.profile)
            .json()
            .expectStatus(200)
            .end(function (_, raw, res) {
              resData = res
              done.apply(null, arguments)
            })
        })

        it('Then request should return true', function (done) {
          expect(resData).to.have.property('result').that.is.true
          expect(resData).to.not.have.property('error')
          expect(resData).to.have.property('user').that.is.an('object')
          expect(resData.user).to.have.property('guest').that.is.false
          done()
        })

        it(`Then property auths should contain ${authTypes.password} type that is confirmed`, function (done) {
          const auths = resData.user.auths
          expect(auths).to.have.property(authTypes.password).that.is.an('object')
          expect(auths[authTypes.password]).to.have.property('confirmed').that.is.true
          done()
        })

        it(`Then property auths should contain ${authTypes.otp} type that is confirmed`, function (done) {
          const auths = resData.user.auths
          expect(auths).to.have.property(authTypes.otp).that.is.an('object')
          expect(auths[authTypes.otp]).to.have.property('confirmed').that.is.true
          done()
        })
      })

      describe('When user 2 requests profile', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken2)
            .base(baseUrl)
            .get(endpoints.profile)
            .json()
            .expectStatus(200)
            .end(function (_, raw, res) {
              resData = res
              done.apply(null, arguments)
            })
        })

        it('Then request should return true', function (done) {
          expect(resData).to.have.property('result').that.is.true
          expect(resData).to.not.have.property('error')
          expect(resData).to.have.property('user').that.is.an('object')
          expect(resData.user).to.have.property('guest').that.is.false
          done()
        })

        it(`Then property auths should contain ${authTypes.password2} type that is confirmed`, function (done) {
          const auths = resData.user.auths
          expect(auths).to.have.property(authTypes.password2).that.is.an('object')
          expect(auths[authTypes.password2]).to.have.property('confirmed').that.is.true
          done()
        })

        it(`Then property auths should not contain ${authTypes.otp} type`, function (done) {
          expect(resData.user.auths).to.not.have.property(authTypes.otp).that.is.an('object')
          done()
        })
      })
    })
  })

  // OTP: Experimental group
  // OTP: link without init (userNotFound)
  describe('I want to test OTP linking without linking initialisation', function () {
    context('Given user 1 with password account', function () {
      const deviceID = 'test' + (Math.floor(Math.random() * 99999))
      let apiToken = ''

      const phone = '+7' + (Math.floor(Math.random() * 999999999))
      const otpCode = staticCodes.otp

      const email = 'test' + (Math.floor(Math.random() * 99999)) + '@example.com'
      const password = 'password1'

      before(async function () {
        // main client
        const passwordClient = await new helper.NewClient(deviceID)
          .passwordRegister(email, password)
          .getProfile()
          .passwordConfirm(email)
          .end()

        apiToken = passwordClient.apiToken
      })

      after(async function () {
        await helper.clearAll()
      })

      describe('When user 1 requests for link otp account', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken)
            .base(baseUrl)
            .post(endpoints.otpAuth)
            .pathParams({
              key: authTypes.otp
            })
            .json()
            .send({
              phone: phone,
              code: otpCode
            })
            .expectStatus(400)
            .end(function (_, raw, res) {
              resData = res
              done.apply(null, arguments)
            })
        })

        it('Then request should return result false', function (done) {
          expect(resData).to.have.property('result').that.is.false
          expect(resData).to.have.property('error')
          done()
        })

        it(`Then property code of error should equal ${errors.userNotFound}`, function (done) {
          expect(resData.error).to.have.property('code').that.equals(errors.userNotFound)
          done()
        })
      })

      describe('When user 1 requests profile', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken)
            .base(baseUrl)
            .get(endpoints.profile)
            .json()
            .expectStatus(200)
            .end(function (_, raw, res) {
              resData = res
              done.apply(null, arguments)
            })
        })

        it('Then request should return true', function (done) {
          expect(resData).to.have.property('result').that.is.true
          expect(resData).to.not.have.property('error')
          expect(resData).to.have.property('user').that.is.an('object')
          expect(resData.user).to.have.property('guest').that.is.false
          done()
        })

        it(`Then property auths should contain ${authTypes.password} type that is confirmed`, function (done) {
          const auths = resData.user.auths
          expect(auths).to.have.property(authTypes.password).that.is.an('object')
          expect(auths[authTypes.password]).to.have.property('confirmed').that.is.true
          done()
        })

        it(`Then property auths should not contain ${authTypes.otp} type`, function (done) {
          expect(resData.user.auths).to.not.have.property(authTypes.otp).that.is.an('object')
          done()
        })
      })
    })
  })

  // OTP: login to temp user by another user (user not found)
  describe('I want to test that after the initialization of the OTP linking, the account does not yet exist and it is impossible to login from another session', function () {
    context('Given user 1 with password auth identity, initialised linking for OTP auth identity and user 2 without account', function () {
      const deviceID = 'test' + (Math.floor(Math.random() * 99999))
      const deviceID2 = 'test' + (Math.floor(Math.random() * 99999))
      let apiToken2 = ''

      const phone = '+7' + (Math.floor(Math.random() * 999999999))
      const otpCode = staticCodes.otp

      const email = 'test' + (Math.floor(Math.random() * 99999)) + '@example.com'
      const password = 'password1'

      before(async function () {
        // main client
        await new helper.NewClient(deviceID)
          .passwordRegister(email, password)
          .getProfile()
          .passwordConfirm(email)
          .otpGetCode(phone)
          .end()

        const user2 = await new helper.NewClient(deviceID2).end()

        apiToken2 = user2.apiToken
      })

      after(async function () {
        await helper.clearAll()
      })

      describe('When user 2 requests otp auth with credentials of not linked auth identity', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken2)
            .base(baseUrl)
            .post(endpoints.otpAuth)
            .pathParams({
              key: authTypes.otp
            })
            .json()
            .send({
              phone: phone,
              code: otpCode
            })
            .expectStatus(400)
            .end(function (_, raw, res) {
              resData = res
              done.apply(null, arguments)
            })
        })

        it('Then request should return result false', function (done) {
          expect(resData).to.have.property('result').that.is.false
          expect(resData).to.have.property('error')
          done()
        })

        it(`Then property code of error should equal ${errors.userNotFound}`, function (done) {
          expect(resData.error).to.have.property('code').that.equals(errors.userNotFound)
          done()
        })
      })
    })
  })

  // OTP: link account by 2 users without init by another user (requirements: no merge mode)
  describe('I want to test that one user can initialize OTP linking, but another user can complete linking and it will no longer be available even if this user initialized linking', function () {
    context('Given user 1 with password account and user 2 with password account, user 1 initialized OTP linking with base timeount', function () {
      const deviceID = 'test' + (Math.floor(Math.random() * 99999))
      const deviceID2 = 'test' + (Math.floor(Math.random() * 99999))
      let apiToken = ''
      let apiToken2 = ''

      const phone = '+7' + (Math.floor(Math.random() * 999999999))
      const otpCode = staticCodes.otp

      const email = 'test' + (Math.floor(Math.random() * 99999)) + '@example.com'
      const email2 = 'test' + (Math.floor(Math.random() * 99999)) + '@example.com'
      const password = 'password1'
      const password2 = 'password2'

      before(async function () {
        if (config.merge) {
          this.skip()
        }
        // main client
        const user1 = await new helper.NewClient(deviceID)
          .passwordRegister(email, password, authTypes.password)
          .getProfile()
          .passwordConfirm(email, authTypes.password)
          .end()

        const user2 = await new helper.NewClient(deviceID2)
          .passwordRegister(email2, password2, authTypes.password2)
          .getProfile()
          .passwordConfirm(email2, authTypes.password2)
          .end()

        await user1.otpGetCode(phone).end()

        await helper.sleep(config.sentCodeTimeout)

        apiToken = user1.apiToken
        apiToken2 = user2.apiToken
      })

      after(async function () {
        await helper.clearAll()
      })

      describe('When user 2 requests for link OTP account', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken2)
            .base(baseUrl)
            .post(endpoints.otpAuth)
            .pathParams({
              key: authTypes.otp
            })
            .json()
            .send({
              phone: phone,
              code: otpCode
            })
            .expectStatus(200)
            .end(function (_, raw, res) {
              resData = res
              done.apply(null, arguments)
            })
        })

        it('Then request should return result true', function (done) {
          expect(resData).to.have.property('result').that.is.true
          expect(resData).to.not.have.property('error')
          done()
        })
      })

      describe('When user 1 requests for link OTP account', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken)
            .base(baseUrl)
            .post(endpoints.otpAuth)
            .pathParams({
              key: authTypes.otp
            })
            .json()
            .send({
              phone: phone,
              code: otpCode
            })
            .expectStatus(400)
            .end(function (_, raw, res) {
              resData = res
              done.apply(null, arguments)
            })
        })

        it('Then request should return result false', function (done) {
          expect(resData).to.have.property('result').that.is.false
          expect(resData).to.have.property('error')
          done()
        })

        it(`Then property code of error should equal ${errors.userExist}`, function (done) {
          expect(resData.error).to.have.property('code').that.equals(errors.userExist)
          done()
        })
      })

      describe('When user 1 requests profile', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken)
            .base(baseUrl)
            .get(endpoints.profile)
            .json()
            .expectStatus(200)
            .end(function (_, raw, res) {
              resData = res
              done.apply(null, arguments)
            })
        })

        it('Then request should return true', function (done) {
          expect(resData).to.have.property('result').that.is.true
          expect(resData).to.not.have.property('error')
          expect(resData).to.have.property('user').that.is.an('object')
          expect(resData.user).to.have.property('guest').that.is.false
          done()
        })

        it(`Then property auths should contain ${authTypes.password} type that is confirmed`, function (done) {
          const auths = resData.user.auths
          expect(auths).to.have.property(authTypes.password).that.is.an('object')
          expect(auths[authTypes.password]).to.have.property('confirmed').that.is.true
          done()
        })

        it(`Then property auths should not contain ${authTypes.otp} type`, function (done) {
          expect(resData.user.auths).to.not.have.property(authTypes.otp).that.is.an('object')
          done()
        })
      })

      describe('When user 2 requests profile', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken2)
            .base(baseUrl)
            .get(endpoints.profile)
            .json()
            .expectStatus(200)
            .end(function (_, raw, res) {
              resData = res
              done.apply(null, arguments)
            })
        })

        it('Then request should return true', function (done) {
          expect(resData).to.have.property('result').that.is.true
          expect(resData).to.not.have.property('error')
          expect(resData).to.have.property('user').that.is.an('object')
          expect(resData.user).to.have.property('guest').that.is.false
          done()
        })

        it(`Then property auths should contain ${authTypes.password2} type that is confirmed`, function (done) {
          const auths = resData.user.auths
          expect(auths).to.have.property(authTypes.password2).that.is.an('object')
          expect(auths[authTypes.password2]).to.have.property('confirmed').that.is.true
          done()
        })

        it(`Then property auths should contain ${authTypes.otp} type that is confirmed`, function (done) {
          const auths = resData.user.auths
          expect(auths).to.have.property(authTypes.otp).that.is.an('object')
          expect(auths[authTypes.otp]).to.have.property('confirmed').that.is.true
          done()
        })
      })
    })
  })

  // #3 Link social
  // Social: base link (requirements: googleToken)
  describe('I want to test social linking', function () {
    context('Given user 1 with confirmed password account', function () {
      const deviceID = 'test' + (Math.floor(Math.random() * 99999))
      let apiToken = ''

      const email = 'test' + (Math.floor(Math.random() * 99999)) + '@example.com'
      const password = 'password1'

      before(async function () {
        if (googleToken === '') {
          this.skip()
        }
        // main client
        const passwordClient = await new helper.NewClient(deviceID)
          .passwordRegister(email, password)
          .getProfile()
          .passwordConfirm(email)
          .end()

        apiToken = passwordClient.apiToken
      })

      after(async function () {
        await helper.clearAll()
      })

      describe('When user 1 requests for link social account', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken)
            .base(baseUrl)
            .post(endpoints.socialLogin)
            .json()
            .send({
              type: authTypes.social,
              token: googleToken
            })
            .expectStatus(200)
            .end(function (_, raw, res) {
              resData = res
              done.apply(null, arguments)
            })
        })

        it('Then request should return result true', function (done) {
          expect(resData).to.have.property('result').that.is.true
          expect(resData).to.not.have.property('error')
          done()
        })
      })

      describe('When user 1 requests profile', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken)
            .base(baseUrl)
            .get(endpoints.profile)
            .json()
            .expectStatus(200)
            .end(function (_, raw, res) {
              resData = res
              done.apply(null, arguments)
            })
        })

        it('Then request should return true', function (done) {
          expect(resData).to.have.property('result').that.is.true
          expect(resData).to.not.have.property('error')
          expect(resData).to.have.property('user').that.is.an('object')
          expect(resData.user).to.have.property('guest').that.is.false
          done()
        })

        it(`Then property auths should contain ${authTypes.password} type that is confirmed`, function (done) {
          const auths = resData.user.auths
          expect(auths).to.have.property(authTypes.password).that.is.an('object')
          expect(auths[authTypes.password]).to.have.property('confirmed').that.is.true
          done()
        })

        it(`Then property auths should contain ${authTypes.social} type that is confirmed`, function (done) {
          const auths = resData.user.auths
          expect(auths).to.have.property(authTypes.social).that.is.an('object')
          expect(auths[authTypes.social]).to.have.property('confirmed').that.is.true
          done()
        })
      })
    })
  })

  // Social: same social type and differrent auth keys (requirements: googleToken, appleToken)
  describe('I want to test linking with same social type and different auth key', function () {
    context('Given user 1 with social account and auth identity with the same auth type and different auth key', function () {
      const deviceID = 'test' + (Math.floor(Math.random() * 99999))
      let apiToken = ''

      before(async function () {
        if (googleToken === '' || appleToken === '') {
          this.skip()
        }
        // main client
        const socialClient = await new helper.NewClient(deviceID)
          .socialLogin(googleToken)
          .end()

        apiToken = socialClient.apiToken
      })

      after(async function () {
        await helper.clearAll()
      })

      describe('When user 1 requests for link social account', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken)
            .base(baseUrl)
            .post(endpoints.socialLogin)
            .json()
            .send({
              type: authTypes.social2,
              token: appleToken
            })
            .expectStatus(200)
            .end(function (_, raw, res) {
              resData = res
              done.apply(null, arguments)
            })
        })

        it('Then request should return result true', function (done) {
          expect(resData).to.have.property('result').that.is.true
          expect(resData).to.not.have.property('error')
          done()
        })
      })

      describe('When user 1 requests profile', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken)
            .base(baseUrl)
            .get(endpoints.profile)
            .json()
            .expectStatus(200)
            .end(function (_, raw, res) {
              resData = res
              done.apply(null, arguments)
            })
        })

        it('Then request should return true', function (done) {
          expect(resData).to.have.property('result').that.is.true
          expect(resData).to.not.have.property('error')
          expect(resData).to.have.property('user').that.is.an('object')
          expect(resData.user).to.have.property('guest').that.is.false
          done()
        })

        it(`Then property auths should contain ${authTypes.social} type that is confirmed`, function (done) {
          const auths = resData.user.auths
          expect(auths).to.have.property(authTypes.social).that.is.an('object')
          expect(auths[authTypes.social]).to.have.property('confirmed').that.is.true
          done()
        })

        it(`Then property auths should contain ${authTypes.social2} type that is confirmed`, function (done) {
          const auths = resData.user.auths
          expect(auths).to.have.property(authTypes.social2).that.is.an('object')
          expect(auths[authTypes.social2]).to.have.property('confirmed').that.is.true
          done()
        })
      })
    })
  })

  // Social: same otp type and auth key (requirements: googleToken, googleToken2)
  describe('I want to test social linking with the same auth key and auth type', function () {
    context('Given user 1 with social account and auth identity with the same auth keys and auth types', function () {
      const deviceID = 'test' + (Math.floor(Math.random() * 99999))
      let apiToken = ''

      before(async function () {
        if (googleToken === '' || googleToken2 === '') {
          this.skip()
        }
        // main client
        const socialClient = await new helper.NewClient(deviceID)
          .socialLogin(googleToken)
          .end()

        apiToken = socialClient.apiToken
      })

      after(async function () {
        await helper.clearAll()
      })

      describe('When user 1 requests for link social account', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken)
            .base(baseUrl)
            .post(endpoints.socialLogin)
            .json()
            .send({
              type: authTypes.social,
              token: googleToken2
            })
            .expectStatus(400)
            .end(function (_, raw, res) {
              resData = res
              done.apply(null, arguments)
            })
        })

        it('Then request should return result false', function (done) {
          expect(resData).to.have.property('result').that.is.false
          expect(resData).to.have.property('error')
          done()
        })

        it(`Then property code of error should equal ${errors.userNotFound}`, function (done) {
          expect(resData.error).to.have.property('code').that.equals(errors.userNotFound)
          done()
        })
      })

      describe('When user 1 requests profile', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken)
            .base(baseUrl)
            .get(endpoints.profile)
            .json()
            .expectStatus(200)
            .end(function (_, raw, res) {
              resData = res
              done.apply(null, arguments)
            })
        })

        it('Then request should return true', function (done) {
          expect(resData).to.have.property('result').that.is.true
          expect(resData).to.not.have.property('error')
          expect(resData).to.have.property('user').that.is.an('object')
          expect(resData.user).to.have.property('guest').that.is.false
          done()
        })

        it(`Then property auths should contain ${authTypes.social} type that is confirmed`, function (done) {
          const auths = resData.user.auths
          expect(auths).to.have.property(authTypes.social).that.is.an('object')
          expect(auths[authTypes.social]).to.have.property('confirmed').that.is.true
          done()
        })
      })
    })
  })

  // Social: not confirmed base account (requirements: googleToken)
  describe('I want to test social linking not confirmed password account', function () {
    context('Given user 1 with not confirmed password account', function () {
      const deviceID = 'test' + (Math.floor(Math.random() * 99999))
      let apiToken = ''

      const email = 'test' + (Math.floor(Math.random() * 99999)) + '@example.com'
      const password = 'password1'

      before(async function () {
        if (googleToken === '') {
          this.skip()
        }
        // main client
        const passwordClient = await new helper.NewClient(deviceID)
          .passwordRegister(email, password)
          .end()

        apiToken = passwordClient.apiToken
      })

      after(async function () {
        await helper.clearAll()
      })

      describe('When user 1 requests for link social account', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken)
            .base(baseUrl)
            .post(endpoints.socialLogin)
            .json()
            .send({
              type: authTypes.social,
              token: googleToken
            })
            .expectStatus(400)
            .end(function (_, raw, res) {
              resData = res
              done.apply(null, arguments)
            })
        })

        it('Then request should return result false', function (done) {
          expect(resData).to.have.property('result').that.is.false
          expect(resData).to.have.property('error')
          done()
        })

        it(`Then property code of error should equal ${errors.userNotConfirmed}`, function (done) {
          expect(resData.error).to.have.property('code').that.equals(errors.userNotConfirmed)
          done()
        })
      })

      describe('When user 1 requests profile', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken)
            .base(baseUrl)
            .get(endpoints.profile)
            .json()
            .expectStatus(200)
            .end(function (_, raw, res) {
              resData = res
              done.apply(null, arguments)
            })
        })

        it('Then request should return true', function (done) {
          expect(resData).to.have.property('result').that.is.true
          expect(resData).to.not.have.property('error')
          expect(resData).to.have.property('user').that.is.an('object')
          expect(resData.user).to.have.property('guest').that.is.false
          done()
        })

        it(`Then property auths should contain ${authTypes.password} type that is not confirmed`, function (done) {
          const auths = resData.user.auths
          expect(auths).to.have.property(authTypes.password).that.is.an('object')
          expect(auths[authTypes.password]).to.have.property('confirmed').that.is.false
          done()
        })

        it(`Then property auths should not contain ${authTypes.social}`, function (done) {
          expect(resData.user.auths).to.not.have.property(authTypes.social)
          done()
        })
      })
    })
  })

  // Social: link already registered confirmed account flow (user exists) (requirements: no merge mode, googleToken)
  describe('I want to test social linking with already registered account', function () {
    context('Given user 1 with confirmed password account and user 2 with social account', function () {
      const deviceID = 'test' + (Math.floor(Math.random() * 99999))
      const deviceID2 = 'test' + (Math.floor(Math.random() * 99999))
      let apiToken = ''

      const email = 'test' + (Math.floor(Math.random() * 99999)) + '@example.com'
      const password = 'password1'

      before(async function () {
        if (googleToken === '' || config.merge) {
          this.skip()
        }
        // main client
        const passwordClient = await new helper.NewClient(deviceID)
          .passwordRegister(email, password)
          .getProfile()
          .passwordConfirm(email)
          .end()

        await new helper.NewClient(deviceID2)
          .socialLogin(googleToken)
          .end()

        apiToken = passwordClient.apiToken
      })

      after(async function () {
        await helper.clearAll()
      })

      describe('When user 1 requests for link social account', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken)
            .base(baseUrl)
            .post(endpoints.socialLogin)
            .json()
            .send({
              type: authTypes.social,
              token: googleToken
            })
            .expectStatus(400)
            .end(function (_, raw, res) {
              resData = res
              done.apply(null, arguments)
            })
        })

        it('Then request should return result false', function (done) {
          expect(resData).to.have.property('result').that.is.false
          expect(resData).to.have.property('error')
          done()
        })

        it(`Then property code of error should equal ${errors.userExist}`, function (done) {
          expect(resData.error).to.have.property('code').that.equals(errors.userExist)
          done()
        })
      })

      describe('When user 1 requests profile', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken)
            .base(baseUrl)
            .get(endpoints.profile)
            .json()
            .expectStatus(200)
            .end(function (_, raw, res) {
              resData = res
              done.apply(null, arguments)
            })
        })

        it('Then request should return true', function (done) {
          expect(resData).to.have.property('result').that.is.true
          expect(resData).to.not.have.property('error')
          expect(resData).to.have.property('user').that.is.an('object')
          expect(resData.user).to.have.property('guest').that.is.false
          done()
        })

        it(`Then property auths should contain ${authTypes.password} type that is confirmed`, function (done) {
          const auths = resData.user.auths
          expect(auths).to.have.property(authTypes.password).that.is.an('object')
          expect(auths[authTypes.password]).to.have.property('confirmed').that.is.true
          done()
        })

        it(`Then property auths should not contain ${authTypes.social}`, function (done) {
          expect(resData.user.auths).to.not.have.property(authTypes.social)
          done()
        })
      })
    })
  })

  // Social: login to linked account by another user (requirements: googleToken)
  describe('I want to test that after the social linking, the account does exist and it is possible to login from another session', function () {
    context('Given user 1 with confirmed password auth identity, linked social auth identity and user 2 without account', function () {
      const deviceID = 'test' + (Math.floor(Math.random() * 99999))
      const deviceID2 = 'test' + (Math.floor(Math.random() * 99999))
      let apiToken2 = ''

      const email = 'test' + (Math.floor(Math.random() * 99999)) + '@example.com'
      const password = 'password1'

      before(async function () {
        if (googleToken === '') {
          this.skip()
        }
        // main client
        await new helper.NewClient(deviceID)
          .passwordRegister(email, password)
          .getProfile()
          .passwordConfirm(email)
          .socialLogin(googleToken)
          .end()

        const user2 = await new helper.NewClient(deviceID2).end()

        apiToken2 = user2.apiToken
      })

      after(async function () {
        await helper.clearAll()
      })

      describe('When user 2 requests for social login with credentials of linked auth identity', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken2)
            .base(baseUrl)
            .post(endpoints.socialLogin)
            .json()
            .send({
              type: authTypes.social,
              token: googleToken
            })
            .expectStatus(200)
            .end(function (_, raw, res) {
              resData = res
              done.apply(null, arguments)
            })
        })

        it('Then request should return result true', function (done) {
          expect(resData).to.have.property('result').that.is.true
          expect(resData).to.not.have.property('error')
          done()
        })
      })
    })
  })
})
