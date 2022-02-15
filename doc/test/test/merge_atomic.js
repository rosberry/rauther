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

const mergeConflictStatus = 409

describe('Check merge flow:', function () {
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

  // #1 Merge OTP
  // OTP: Expected group
  // OTP: Base merge
  describe('I want to test merging with confirmed existing OTP account', function () {
    context('Given user 1 with confirmed password account and user 2 with OTP account', function () {
      const deviceID = 'test' + (Math.floor(Math.random() * 99999))
      const deviceID2 = 'test' + (Math.floor(Math.random() * 99999))
      let apiToken = ''

      const phone = '+7' + (Math.floor(Math.random() * 999999999))
      const code = staticCodes.otp

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

        await new helper.NewClient(deviceID2)
          .otpGetCode(phone)
          .otpAuth(phone, code)
          .end()
      })

      after(async function () {
        await helper.clearAll()
      })

      describe('When user 1 requests code for OTP account', function () {
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

      describe('When user 1 requests OTP auth with no merge confirm parameter', function () {
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
              name: userName,
              phone: phone,
              code: code
            })
            .expectStatus(mergeConflictStatus)
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

        it(`Then property code of error should equal ${errors.mergeWarning}`, function (done) {
          expect(resData.error).to.have.property('code').that.equals(errors.mergeWarning)
          done()
        })
      })

      describe('When user 1 requests OTP auth with merge confirm parameter set to true', function () {
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
              name: userName,
              phone: phone,
              code: code,
              confirmMerge: true
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

  // OTP: same OTP type and differrent auth keys
  describe('I want to test merging OTP account with existing OTP account with different auth key', function () {
    context('Given user 1 and user 2 with OTP confirmed accounts with different auth keys', function () {
      const deviceID = 'test' + (Math.floor(Math.random() * 99999))
      const deviceID2 = 'test' + (Math.floor(Math.random() * 99999))
      let apiToken = ''

      const phone = '+7' + (Math.floor(Math.random() * 999999999))
      const phone2 = '+7' + (Math.floor(Math.random() * 999999999))
      const code = staticCodes.otp
      const code2 = staticCodes.otp2

      before(async function () {
        // main client
        const otpClient1 = await new helper.NewClient(deviceID)
          .otpGetCode(phone, authTypes.otp)
          .otpAuth(phone, code, authTypes.otp)
          .end()

        apiToken = otpClient1.apiToken

        await new helper.NewClient(deviceID2)
          .otpGetCode(phone2, authTypes.otp2)
          .otpAuth(phone2, code2, authTypes.otp2)
          .end()
      })

      after(async function () {
        await helper.clearAll()
      })

      describe('When user 1 requests code for OTP account', function () {
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

      describe('When user 1 requests OTP auth with no merge confirm parameter', function () {
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
              name: userName,
              phone: phone2,
              code: code2
            })
            .expectStatus(mergeConflictStatus)
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

        it(`Then property code of error should equal ${errors.mergeWarning}`, function (done) {
          expect(resData.error).to.have.property('code').that.equals(errors.mergeWarning)
          done()
        })
      })

      describe('When user 1 requests OTP auth with merge confirm parameter set to true', function () {
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
              name: userName,
              phone: phone2,
              code: code2,
              confirmMerge: true
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

        it(`Then uid property of auths.${authTypes.otp} should equal uid of user 1 and not equals of user 2`, function (done) {
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

        it(`Then uid property of auths.${authTypes.otp2} should equal uid of user 2 and not equals of user 1`, function (done) {
          const uid = resData.user.auths[authTypes.otp2].uid
          expect(uid).not.equals(phone)
          expect(uid).equals(phone2)
          done()
        })
      })
    })
  })

  // OTP: same OTP type and auth key
  describe('I want to test merging OTP account with existing OTP account with same auth key', function () {
    context('Given user 1 and user 2 with OTP accounts with same auth keys', function () {
      const deviceID = 'test' + (Math.floor(Math.random() * 99999))
      const deviceID2 = 'test' + (Math.floor(Math.random() * 99999))
      let apiToken = ''

      const phone = '+7' + (Math.floor(Math.random() * 999999999))
      const phone2 = '+7' + (Math.floor(Math.random() * 999999999))
      const code = staticCodes.otp

      before(async function () {
        // main client
        const otpClient = await new helper.NewClient(deviceID)
          .otpGetCode(phone)
          .otpAuth(phone, code)
          .end()

        apiToken = otpClient.apiToken

        await new helper.NewClient(deviceID2)
          .otpGetCode(phone2)
          .otpAuth(phone2, code)
          .end()
      })

      after(async function () {
        await helper.clearAll()
      })

      describe('When user 1 requests code for OTP account', function () {
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

      describe('When user 1 requests OTP auth with no merge confirm parameter', function () {
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
              name: userName,
              phone: phone2,
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

        it(`Then property code of error should equal ${errors.codeExpired}`, function (done) {
          expect(resData.error).to.have.property('code').that.equals(errors.codeExpired)
          done()
        })
      })

      describe('When user 1 requests OTP auth with merge confirm parameter set to true', function () {
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
              name: userName,
              phone: phone2,
              code: code,
              confirmMerge: true
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

        it(`Then property code of error should equal ${errors.codeExpired}`, function (done) {
          expect(resData.error).to.have.property('code').that.equals(errors.codeExpired)
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

        it(`Then uid property of auths.${authTypes.otp} should equal uid of user 1 and not equals of user 2`, function (done) {
          const uid = resData.user.auths[authTypes.otp].uid
          expect(uid).equals(phone)
          expect(uid).not.equals(phone2)
          done()
        })
      })
    })
  })

  // OTP: not confirmed base password account
  // TODO: codeExpired with not success request to get code?
  describe('I want to test merging not confirmed password account with confirmed existing OTP account', function () {
    context('Given user 1 with not confirmed password account and user 2 with OTP account', function () {
      const deviceID = 'test' + (Math.floor(Math.random() * 99999))
      const deviceID2 = 'test' + (Math.floor(Math.random() * 99999))
      let apiToken = ''

      const phone = '+7' + (Math.floor(Math.random() * 999999999))
      const code = staticCodes.otp

      const email = 'test' + (Math.floor(Math.random() * 99999)) + '@example.com'
      const password = 'password1'

      before(async function () {
        // main client
        const passwordClient = await new helper.NewClient(deviceID)
          .passwordRegister(email, password)
          .end()

        apiToken = passwordClient.apiToken

        await new helper.NewClient(deviceID2)
          .otpGetCode(phone)
          .otpAuth(phone, code)
          .end()
      })

      after(async function () {
        await helper.clearAll()
      })

      describe('When user 1 requests code for OTP account', function () {
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

      describe('When user 1 requests OTP auth with no merge confirm parameter', function () {
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
              name: userName,
              phone: phone,
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

        // TODO: codeExpired with not success request to get code?
        it(`Then property code of error should equal ${errors.codeExpired}`, function (done) {
          expect(resData.error).to.have.property('code').that.equals(errors.codeExpired)
          done()
        })
      })

      describe('When user 1 requests OTP auth with merge confirm parameter set to true', function () {
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
              name: userName,
              phone: phone,
              code: code,
              confirmMerge: true
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

        // TODO: codeExpired with not success request to get code?
        it(`Then property code of error should equal ${errors.codeExpired}`, function (done) {
          expect(resData.error).to.have.property('code').that.equals(errors.codeExpired)
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

        it(`Then property auths should not contain ${authTypes.otp} type`, function (done) {
          expect(resData.user.auths).to.not.have.property(authTypes.otp)
          done()
        })
      })
    })
  })

  // OTP: not confirmed
  describe('I want to test merging with not confirmed existing OTP account right after OTP confirmation code has been sent', function () {
    context('Given user 1 with password account and user 2 with not confirmed OTP account and OTP confirmation code has been sent', function () {
      const deviceID = 'test' + (Math.floor(Math.random() * 99999))
      const deviceID2 = 'test' + (Math.floor(Math.random() * 99999))
      let apiToken = ''

      const phone = '+7' + (Math.floor(Math.random() * 999999999))
      const code = staticCodes.otp

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

        await new helper.NewClient(deviceID2)
          .otpGetCode(phone)
          .end()
      })

      after(async function () {
        await helper.clearAll()
      })

      describe('When user 1 requests code for OTP account', function () {
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
            .expectStatus(429)
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

        it(`Then property code of error should equal ${errors.codeTimeout}`, function (done) {
          expect(resData.error).to.have.property('code').that.equals(errors.codeTimeout)
          done()
        })
      })

      describe('When user 1 requests for merge OTP account with no merge confirm parameter', function () {
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
              name: userName,
              phone: phone,
              code: code
            })
            .expectStatus(mergeConflictStatus)
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

        it(`Then property code of error should equal ${errors.mergeWarning}`, function (done) {
          expect(resData.error).to.have.property('code').that.equals(errors.mergeWarning)
          done()
        })
      })

      describe('When user 1 requests OTP auth with merge confirm parameter set to true', function () {
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
              name: userName,
              phone: phone,
              code: code,
              confirmMerge: true
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

  // OTP: not confirmed + timeout
  describe('I want to test merging with not confirmed existing OTP account with timeout after OTP confirmation code has been sent', function () {
    context('Given user 1 with password account and user 2 with not confirmed OTP account', function () {
      const deviceID = 'test' + (Math.floor(Math.random() * 99999))
      const deviceID2 = 'test' + (Math.floor(Math.random() * 99999))
      let apiToken = ''

      const phone = '+7' + (Math.floor(Math.random() * 999999999))
      const code = staticCodes.otp

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

        await new helper.NewClient(deviceID2)
          .otpGetCode(phone)
          .end()

        await helper.sleep(config.sentCodeTimeout)
      })

      after(async function () {
        await helper.clearAll()
      })

      describe('When user 1 requests code for OTP account', function () {
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

      describe('When user 1 requests for merge OTP account with no merge confirm parameter', function () {
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
              name: userName,
              phone: phone,
              code: code
            })
            .expectStatus(mergeConflictStatus)
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

        it(`Then property code of error should equal ${errors.mergeWarning}`, function (done) {
          expect(resData.error).to.have.property('code').that.equals(errors.mergeWarning)
          done()
        })
      })

      describe('When user 1 requests OTP auth with merge confirm parameter set to true', function () {
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
              name: userName,
              phone: phone,
              code: code,
              confirmMerge: true
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

  // OTP: lost account session after merge
  describe('I want to test that after merging OTP account, this account should be lost for her session but available for login', function () {
    context('Given user 1 with password account and user 2 with OTP account and user 1 merged user 2', function () {
      const deviceID = 'test' + (Math.floor(Math.random() * 99999))
      const deviceID2 = 'test' + (Math.floor(Math.random() * 99999))
      let apiToken2 = ''

      const phone = '+7' + (Math.floor(Math.random() * 999999999))
      const otpCode = staticCodes.otp

      const email = 'test' + (Math.floor(Math.random() * 99999)) + '@example.com'
      const password = 'password1'

      before(async function () {
        // main client
        const user1 = await new helper.NewClient(deviceID)
          .passwordRegister(email, password)
          .getProfile()
          .passwordConfirm(email)
          .end()

        const user2 = await new helper.NewClient(deviceID2)
          .otpGetCode(phone)
          .otpAuth(phone, otpCode)
          .end()

        await user1
          .otpInitLink(phone)
          .otpLink(phone, otpCode, 'merge')
          .end()

        apiToken2 = user2.apiToken
      })

      after(async function () {
        await helper.clearAll()
      })

      describe('When user 2 requests profile', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken2)
            .base(baseUrl)
            .get(endpoints.profile)
            .json()
            .expectStatus(403)
            .end(function (_, raw, res) {
              resData = res
              done.apply(null, arguments)
            })
        })

        it('Then request should return result false', function (done) {
          expect(resData).to.have.property('result').that.is.false
          done()
        })

        it(`Then request should return message with error: ${errors.userNotFoundInProfile}`, function (done) {
          expect(resData).to.have.property('message')
          expect(resData.message).equal(errors.userNotFoundInProfile)
          done()
        })
      })

      describe('When user 2 requests code for OTP account', function () {
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

      describe('When user 2 requests OTP auth', function () {
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

  // OTP: lost ai after merge
  describe('I want to test that after merging OTP account, similar auth identities will be lost', function () {
    context('Given user 1 with password account and user 2 with confirmed password and OTP auth identities', function () {
      const deviceID = 'test' + (Math.floor(Math.random() * 99999))
      const deviceID2 = 'test' + (Math.floor(Math.random() * 99999))
      let apiToken = ''

      const phone = '+7' + (Math.floor(Math.random() * 999999999))
      const otpCode = staticCodes.otp

      const email = 'test' + (Math.floor(Math.random() * 99999)) + '@example.com'
      const email2 = 'test' + (Math.floor(Math.random() * 99999)) + '@example.com'
      const password = 'password1'
      const password2 = 'password2'

      before(async function () {
        // main client
        const passwordClient = await new helper.NewClient(deviceID)
          .passwordRegister(email, password)
          .getProfile()
          .passwordConfirm(email)
          .end()

        apiToken = passwordClient.apiToken

        await new helper.NewClient(deviceID2)
          .otpGetCode(phone)
          .otpAuth(phone, otpCode)
          .passwordInitLink(email2)
          .passwordLink(email2, password2)
          .end()
      })

      after(async function () {
        await helper.clearAll()
      })

      describe('When user 1 requests for init merge OTP account', function () {
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

      describe('When user 1 requests for merge OTP account with no merge confirm parameter', function () {
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
              name: userName,
              phone: phone,
              code: otpCode
            })
            .expectStatus(mergeConflictStatus)
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

        it(`Then property code of error should equal ${errors.mergeWarning}`, function (done) {
          expect(resData.error).to.have.property('code').that.equals(errors.mergeWarning)
          done()
        })

        it('Then property info should exist', function (done) {
          expect(resData).to.have.property('info')
          done()
        })

        it('Then property lost of info should exist that length must be one', function (done) {
          expect(resData.info).to.have.property('lost').that.have.length(1)
          done()
        })

        it(`Then property lost of info should contain ${authTypes.password} type, expected uid and error '${errors.authLost}'`, function (done) {
          const row = resData.info.lost[0]
          expect(row.type).equals(authTypes.password)
          expect(row.uid).equals(email2)
          expect(row.error).equals(errors.authLost)
          done()
        })
      })

      describe('When user 1 requests for merge OTP account with merge confirm parameter set to true', function () {
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
              name: userName,
              phone: phone,
              code: otpCode,
              confirmMerge: true
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

        it(`Then uid property of auths.${authTypes.password} should equal uid of user 1 and not equals of user 2`, function (done) {
          const uid = resData.user.auths[authTypes.password].uid
          expect(uid).equals(email)
          expect(uid).not.equals(email2)
          done()
        })
      })
    })
  })

  // OTP: not login in lost ai
  describe('I want to test that after merging OTP account with lost auth identities, account that contain this auth identity should be really lost', function () {
    context('Given user 1 with password account and user 2 with OTP and password auth identities which contains the same password auth identity key as user 1 and user 1 merged user 2', function () {
      const deviceID = 'test' + (Math.floor(Math.random() * 99999))
      const deviceID2 = 'test' + (Math.floor(Math.random() * 99999))
      let apiToken2 = ''

      const phone = '+7' + (Math.floor(Math.random() * 999999999))
      const otpCode = staticCodes.otp

      const email = 'test' + (Math.floor(Math.random() * 99999)) + '@example.com'
      const lostedEmail = 'test' + (Math.floor(Math.random() * 99999)) + '@example.com'

      const password = 'password1'
      const lostedPassword = 'password2'

      before(async function () {
        // main client
        const user1 = await new helper.NewClient(deviceID)
          .passwordRegister(email, password, authTypes.password)
          .getProfile()
          .passwordConfirm(email, authTypes.password)
          .end()

        const user2 = await new helper.NewClient(deviceID2)
          .otpGetCode(phone)
          .otpAuth(phone, otpCode)
          .passwordInitLink(lostedEmail, authTypes.password)
          .passwordLink(lostedEmail, lostedPassword, 'link', authTypes.password)
          .end()

        await user1
          .otpInitLink(phone)
          .otpLink(phone, otpCode, 'merge')
          .end()

        apiToken2 = user2.apiToken
      })

      after(async function () {
        await helper.clearAll()
      })

      describe('When user 2 requests profile', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken2)
            .base(baseUrl)
            .get(endpoints.profile)
            .json()
            .expectStatus(403)
            .end(function (_, raw, res) {
              resData = res
              done.apply(null, arguments)
            })
        })

        it('Then request should return result false', function (done) {
          expect(resData).to.have.property('result').that.is.false
          done()
        })

        it(`Then request should return message with error: ${errors.userNotFoundInProfile}`, function (done) {
          expect(resData).to.have.property('message')
          expect(resData.message).equal(errors.userNotFoundInProfile)
          done()
        })
      })

      describe('When user 2 requests password login with credentials of lost password account', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken2)
            .base(baseUrl)
            .post(endpoints.passwordLogin)
            .json()
            .send({
              type: authTypes.password,
              email: lostedEmail,
              password: lostedPassword
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

  // OTP: Experimental group
  // OTP: user does not exist (switch to link account flow)
  // TODO: code_expired? May be already_auth?
  describe('I want to test merging with not existing OTP account', function () {
    context('Given user 1 with password account', function () {
      const deviceID = 'test' + (Math.floor(Math.random() * 99999))
      let apiToken = ''

      const phone = '+7' + (Math.floor(Math.random() * 999999999))
      const code = staticCodes.otp

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

      describe('When user 1 requests code for OTP account', function () {
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

      describe('When user 1 requests OTP auth with no merge confirm parameter', function () {
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
              name: userName,
              phone: phone,
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

      describe('When user 1 requests OTP auth with merge confirm parameter set to true', function () {
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
              name: userName,
              phone: phone,
              code: code,
              confirmMerge: true
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

        it(`Then property code of error should equal ${errors.codeExpired}`, function (done) {
          expect(resData.error).to.have.property('code').that.equals(errors.codeExpired)
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

        it(`Then property auths should contain ${authTypes.otp} type`, function (done) {
          expect(resData.user.auths).to.have.property(authTypes.otp).that.is.an('object')
          done()
        })
      })
    })
  })

  // OTP: invalid code
  describe('I want to test merging with confirmed existing OTP account and with invalid code', function () {
    context('Given user 1 with password account and user 2 with not confirmed OTP account', function () {
      const deviceID = 'test' + (Math.floor(Math.random() * 99999))
      const deviceID2 = 'test' + (Math.floor(Math.random() * 99999))
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

        await new helper.NewClient(deviceID2)
          .otpGetCode(phone)
          .otpAuth(phone, otpCode)
          .end()
      })

      after(async function () {
        await helper.clearAll()
      })

      describe('When user 1 requests code for OTP account', function () {
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

      describe('When user 1 requests OTP auth with invalid code and no merge confirm parameter', function () {
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
              name: userName,
              phone: phone,
              code: 'invalid code'
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

        it(`Then property code of error should equal ${errors.invalidCode}`, function (done) {
          expect(resData.error).to.have.property('code').that.equals(errors.invalidCode)
          done()
        })
      })

      describe('When user 1 requests OTP auth with with invalid code and merge confirm parameter set to true', function () {
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
              name: userName,
              phone: phone,
              code: 'invalid code',
              confirmMerge: true
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

        it(`Then property code of error should equal ${errors.invalidCode}`, function (done) {
          expect(resData.error).to.have.property('code').that.equals(errors.invalidCode)
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
          expect(resData.user.auths).to.not.have.property(authTypes.otp)
          done()
        })
      })
    })
  })

  // OTP: self merge
  // TODO: code_expired on auth request?
  describe('I want to test self merging with confirmed OTP account', function () {
    context('Given user 1 with OTP account', function () {
      const deviceID = 'test' + (Math.floor(Math.random() * 99999))
      let apiToken = ''

      const phone = '+7' + (Math.floor(Math.random() * 999999999))
      const code = staticCodes.otp

      before(async function () {
        // main client
        const otpClient = await new helper.NewClient(deviceID)
          .otpGetCode(phone)
          .otpAuth(phone, code)
          .end()

        apiToken = otpClient.apiToken
      })

      after(async function () {
        await helper.clearAll()
      })

      describe('When user 1 requests code for OTP account', function () {
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

        it(`Then property code of error should equal ${errors.cannotMergeSelf}`, function (done) {
          expect(resData.error).to.have.property('code').that.equals(errors.cannotMergeSelf)
          done()
        })
      })

      describe('When user 1 requests OTP auth with no merge confirm parameter', function () {
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
              name: userName,
              phone: phone,
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

        it(`Then property code of error should equal ${errors.codeExpired}`, function (done) {
          expect(resData.error).to.have.property('code').that.equals(errors.codeExpired)
          done()
        })
      })

      describe('When user 1 requests OTP auth with merge confirm parameter set to true', function () {
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
              name: userName,
              phone: phone,
              code: code,
              confirmMerge: true
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

        it(`Then property code of error should equal ${errors.codeExpired}`, function (done) {
          expect(resData.error).to.have.property('code').that.equals(errors.codeExpired)
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
      })
    })
  })

  // #2 Merge social
  // Social: Expected group
  // Base merge (requirements: googleToken)
  describe('I want to test merging with existing social account', function () {
    context('Given user 1 with password account and user 2 with social account', function () {
      const deviceID = 'test' + (Math.floor(Math.random() * 99999))
      const deviceID2 = 'test' + (Math.floor(Math.random() * 99999))
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

        await new helper.NewClient(deviceID2)
          .socialLogin(googleToken)
          .end()
      })

      after(async function () {
        await helper.clearAll()
      })

      describe('When user 1 requests social login for social account without merge confirm parameter', function () {
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
            .expectStatus(mergeConflictStatus)
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

        it(`Then property code of error should equal ${errors.mergeWarning}`, function (done) {
          expect(resData.error).to.have.property('code').that.equals(errors.mergeWarning)
          done()
        })
      })

      describe('When user 1 requests social login with merge confirm parameter set to true', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken)
            .base(baseUrl)
            .post(endpoints.socialLogin)
            .json()
            .send({
              type: authTypes.social,
              confirmMerge: true,
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
  describe('I want to test merging social account with existing social account with different auth key', function () {
    context('Given user 1 and user 2 with social accounts with different auth keys', function () {
      const deviceID = 'test' + (Math.floor(Math.random() * 99999))
      const deviceID2 = 'test' + (Math.floor(Math.random() * 99999))
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

        await new helper.NewClient(deviceID2)
          .socialLogin(appleToken, authTypes.social2)
          .end()
      })

      after(async function () {
        await helper.clearAll()
      })

      describe('When user 1 requests social login for social account without merge confirm parameter', function () {
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
            .expectStatus(mergeConflictStatus)
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

        it(`Then property code of error should equal ${errors.mergeWarning}`, function (done) {
          expect(resData.error).to.have.property('code').that.equals(errors.mergeWarning)
          done()
        })
      })

      describe('When user 1 requests social login with merge confirm parameter set to true', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken)
            .base(baseUrl)
            .post(endpoints.socialLogin)
            .json()
            .send({
              type: authTypes.social2,
              token: appleToken,
              confirmMerge: true
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

  // Social: same social type and auth key (requirements: googleToken, googleToken2)
  describe('I want to test merging social account with existing social account with same auth key', function () {
    context('Given user 1 and user 2 with social accounts with same auth keys', function () {
      const deviceID = 'test' + (Math.floor(Math.random() * 99999))
      const deviceID2 = 'test' + (Math.floor(Math.random() * 99999))
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

        await new helper.NewClient(deviceID2)
          .socialLogin(googleToken2)
          .end()
      })

      after(async function () {
        await helper.clearAll()
      })

      describe('When user 1 requests social login for social account without merge confirm parameter', function () {
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

        it(`Then property code of error should equal ${errors.authIdentityAlreadyExists}`, function (done) {
          expect(resData.error).to.have.property('code').that.equals(errors.authIdentityAlreadyExists)
          done()
        })

        it('Then property info should not exist', function (done) {
          expect(resData).to.not.have.property('info')
          done()
        })
      })

      describe('When user 1 requests social login with merge confirm parameter set to true', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken)
            .base(baseUrl)
            .post(endpoints.socialLogin)
            .json()
            .send({
              type: authTypes.social,
              token: googleToken2,
              confirmMerge: true
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

  // Social: not confirmed base password account (requirements: googleToken)
  describe('I want to test merging not confirmed password account with existing social account', function () {
    context('Given user 1 with not confirmed password account and user 2 with social account', function () {
      const deviceID = 'test' + (Math.floor(Math.random() * 99999))
      const deviceID2 = 'test' + (Math.floor(Math.random() * 99999))
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

        await new helper.NewClient(deviceID2)
          .socialLogin(googleToken)
          .end()
      })

      after(async function () {
        await helper.clearAll()
      })

      describe('When user 1 requests social login for social account without merge confirm parameter', function () {
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

      describe('When user 1 requests social login with merge confirm parameter set to true', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken)
            .base(baseUrl)
            .post(endpoints.socialLogin)
            .json()
            .send({
              type: authTypes.social,
              confirmMerge: true,
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

        it(`Then property auths should not contain ${authTypes.social} type`, function (done) {
          expect(resData.user.auths).to.not.have.property(authTypes.social)
          done()
        })
      })
    })
  })

  // Social: lost account session after merge (requirements: googleToken)
  describe('I want to test that after merging social account, this account should be lost for her session but available for login', function () {
    context('Given user 1 with password confirmed account and user 2 with social account and user 1 merged user 2', function () {
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
        const user1 = await new helper.NewClient(deviceID)
          .passwordRegister(email, password)
          .getProfile()
          .passwordConfirm(email)
          .end()

        const user2 = await new helper.NewClient(deviceID2)
          .socialLogin(googleToken)
          .end()

        await user1
          .socialLink(googleToken, 'merge')
          .end()

        apiToken2 = user2.apiToken
      })

      after(async function () {
        await helper.clearAll()
      })

      describe('When user 2 requests profile', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken2)
            .base(baseUrl)
            .get(endpoints.profile)
            .json()
            .expectStatus(403)
            .end(function (_, raw, res) {
              resData = res
              done.apply(null, arguments)
            })
        })

        it('Then request should return result false', function (done) {
          expect(resData).to.have.property('result').that.is.false
          done()
        })

        it(`Then request should return message with error: ${errors.userNotFoundInProfile}`, function (done) {
          expect(resData).to.have.property('message')
          expect(resData.message).equal(errors.userNotFoundInProfile)
          done()
        })
      })

      describe('When user 2 requests social login', function () {
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

        it(`Then property auths should contain ${authTypes.social} type that is confirmed`, function (done) {
          const auths = resData.user.auths
          expect(auths).to.have.property(authTypes.social).that.is.an('object')
          expect(auths[authTypes.social]).to.have.property('confirmed').that.is.true
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

  // Social: lost ai after merge (requirements: googleToken)
  describe('I want to test that after merging social account, similar auth identities will be lost', function () {
    context('Given user 1 with password account and user 2 with confirmed auth identities of social and password', function () {
      const deviceID = 'test' + (Math.floor(Math.random() * 99999))
      const deviceID2 = 'test' + (Math.floor(Math.random() * 99999))
      let apiToken = ''

      const email = 'test' + (Math.floor(Math.random() * 99999)) + '@example.com'
      const email2 = 'test' + (Math.floor(Math.random() * 99999)) + '@example.com'
      const password = 'password1'
      const password2 = 'password2'

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

        await new helper.NewClient(deviceID2)
          .socialLogin(googleToken)
          .passwordInitLink(email2)
          .passwordLink(email2, password2)
          .end()
      })

      after(async function () {
        await helper.clearAll()
      })

      describe('When user 1 requests social login for social account without merge confirm parameter', function () {
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
            .expectStatus(mergeConflictStatus)
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

        it(`Then property code of error should equal ${errors.mergeWarning}`, function (done) {
          expect(resData.error).to.have.property('code').that.equals(errors.mergeWarning)
          done()
        })

        it('Then property info should exist', function (done) {
          expect(resData).to.have.property('info')
          done()
        })

        it('Then property lost of info should exist that length must be one', function (done) {
          expect(resData.info).to.have.property('lost').that.have.length(1)
          done()
        })

        it(`Then property lost of info should contain ${authTypes.password} type, expected uid and error '${errors.authLost}'`, function (done) {
          const row = resData.info.lost[0]
          expect(row.type).equals(authTypes.password)
          expect(row.uid).equals(email2)
          expect(row.error).equals(errors.authLost)
          done()
        })
      })

      describe('When user 1 requests social login with merge confirm parameter set to true', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken)
            .base(baseUrl)
            .post(endpoints.socialLogin)
            .json()
            .send({
              type: authTypes.social,
              confirmMerge: true,
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

        it(`Then property auths should contain ${authTypes.social} type that is confirmed`, function (done) {
          const auths = resData.user.auths
          expect(auths).to.have.property(authTypes.social).that.is.an('object')
          expect(auths[authTypes.social]).to.have.property('confirmed').that.is.true
          done()
        })

        it(`Then property auths should contain ${authTypes.password} type that is confirmed`, function (done) {
          const auths = resData.user.auths
          expect(auths).to.have.property(authTypes.password).that.is.an('object')
          expect(auths[authTypes.password]).to.have.property('confirmed').that.is.true
          done()
        })

        it(`Then uid property of auths.${authTypes.password} should equal uid of user 1 and not equals of user 2`, function (done) {
          const uid = resData.user.auths[authTypes.password].uid
          expect(uid).equals(email)
          expect(uid).not.equals(email2)
          done()
        })
      })
    })
  })

  // Social: not login in lost ai (requirements: googleToken)
  describe('I want to test that after merging social account with lost auth identities, account that contain this auth identity should be really lost', function () {
    context('Given user 1 with password account and user 2 with social and password auth identities which contains the same password auth identity key as user 1 and user 1 merged user 2', function () {
      const deviceID = 'test' + (Math.floor(Math.random() * 99999))
      const deviceID2 = 'test' + (Math.floor(Math.random() * 99999))
      let apiToken2 = ''

      const email = 'test' + (Math.floor(Math.random() * 99999)) + '@example.com'
      const lostedEmail = 'test' + (Math.floor(Math.random() * 99999)) + '@example.com'

      const password = 'password1'
      const lostedPassword = 'password2'

      before(async function () {
        if (googleToken === '') {
          this.skip()
        }
        // main client
        const user1 = await new helper.NewClient(deviceID)
          .passwordRegister(email, password, authTypes.password)
          .getProfile()
          .passwordConfirm(email, authTypes.password)
          .end()

        const user2 = await new helper.NewClient(deviceID2)
          .socialLogin(googleToken)
          .passwordInitLink(lostedEmail, authTypes.password)
          .passwordLink(lostedEmail, lostedPassword, 'link', authTypes.password)
          .end()

        await user1
          .socialLink(googleToken, 'merge')
          .end()

        apiToken2 = user2.apiToken
      })

      after(async function () {
        await helper.clearAll()
      })

      describe('When user 2 requests profile', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken2)
            .base(baseUrl)
            .get(endpoints.profile)
            .json()
            .expectStatus(403)
            .end(function (_, raw, res) {
              resData = res
              done.apply(null, arguments)
            })
        })

        it('Then request should return result false', function (done) {
          expect(resData).to.have.property('result').that.is.false
          done()
        })

        it(`Then request should return message with error: ${errors.userNotFoundInProfile}`, function (done) {
          expect(resData).to.have.property('message')
          expect(resData.message).equal(errors.userNotFoundInProfile)
          done()
        })
      })

      describe('When user 2 requests password login with credentials of lost password account', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken2)
            .base(baseUrl)
            .post(endpoints.passwordLogin)
            .json()
            .send({
              type: authTypes.password,
              email: lostedEmail,
              password: lostedPassword
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

  // Social: Experimental group
  // Social: user does not exist (switch to link account flow) (requirements: googleToken)
  describe('I want to test merging with not existing social account', function () {
    context('Given user 1 with password account', function () {
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

      describe('When user 1 requests social login for social account without merge confirm parameter', function () {
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

      describe('When user 1 requests social login with merge confirm parameter set to true', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken)
            .base(baseUrl)
            .post(endpoints.socialLogin)
            .json()
            .send({
              type: authTypes.social,
              confirmMerge: true,
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

        it(`Then property code of error should equal ${errors.cannotMergeSelf}`, function (done) {
          expect(resData.error).to.have.property('code').that.equals(errors.cannotMergeSelf)
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

  // Social: invalid token (requirements: googleToken)
  describe('I want to test merging with existing social account and with invalid token', function () {
    context('Given user 1 with password account and user 2 with social account', function () {
      const deviceID = 'test' + (Math.floor(Math.random() * 99999))
      const deviceID2 = 'test' + (Math.floor(Math.random() * 99999))
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

        await new helper.NewClient(deviceID2)
          .socialLogin(googleToken)
          .end()
      })

      after(async function () {
        await helper.clearAll()
      })

      describe('When user 1 requests social login for social account with invalid token and without merge confirm parameter', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken)
            .base(baseUrl)
            .post(endpoints.socialLogin)
            .json()
            .send({
              type: authTypes.social,
              token: 'invalid token'
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

        it(`Then property code of error should equal ${errors.invalidAuthToken}`, function (done) {
          expect(resData.error).to.have.property('code').that.equals(errors.invalidAuthToken)
          done()
        })
      })

      describe('When user 1 requests social login with invalid token and merge confirm parameter set to true', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken)
            .base(baseUrl)
            .post(endpoints.socialLogin)
            .json()
            .send({
              type: authTypes.social,
              confirmMerge: true,
              token: 'invalid token'
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

        it(`Then property code of error should equal ${errors.invalidAuthToken}`, function (done) {
          expect(resData.error).to.have.property('code').that.equals(errors.invalidAuthToken)
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

        it(`Then property auths should not contain ${authTypes.social} type`, function (done) {
          expect(resData.user.auths).to.not.have.property(authTypes.social)
          done()
        })
      })
    })
  })

  // Social: self merge (requirements: googleToken)
  describe('I want to test self merging with social account', function () {
    context('Given user 1 with social account', function () {
      const deviceID = 'test' + (Math.floor(Math.random() * 99999))
      let apiToken = ''

      before(async function () {
        if (googleToken === '') {
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

      describe('When user 1 requests social login for self social account without merge confirm parameter', function () {
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

        it(`Then property code of error should equal ${errors.cannotMergeSelf}`, function (done) {
          expect(resData.error).to.have.property('code').that.equals(errors.cannotMergeSelf)
          done()
        })
      })

      describe('When user 1 requests social login for self social account with merge confirm parameter set to true', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken)
            .base(baseUrl)
            .post(endpoints.socialLogin)
            .json()
            .send({
              type: authTypes.social,
              confirmMerge: true,
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

        it(`Then property code of error should equal ${errors.cannotMergeSelf}`, function (done) {
          expect(resData.error).to.have.property('code').that.equals(errors.cannotMergeSelf)
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

  // #3 Merge password
  // Password: Expected group
  // Password: Base merge
  describe('I want to test merging with confirmed existing password account', function () {
    context('Given user 1 with OTP account and user 2 with confirmed password account', function () {
      const deviceID = 'test' + (Math.floor(Math.random() * 99999))
      const deviceID2 = 'test' + (Math.floor(Math.random() * 99999))
      let apiToken = ''

      const phone = '+7' + (Math.floor(Math.random() * 999999999))
      const otpCode = staticCodes.otp

      const email = 'test' + (Math.floor(Math.random() * 99999)) + '@example.com'
      const password = 'password1'

      before(async function () {
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

      describe('When user 1 requests for init merge password account', function () {
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

        it('Then property action should equal "merge"', function (done) {
          expect(resData).to.have.property('action').that.equals('merge')
          done()
        })

        it('Then property confirmCodeRequired should equal false', function (done) {
          expect(resData).to.have.property('confirmCodeRequired').is.false
          done()
        })
      })

      describe('When user 1 requests for merge password account with no merge confirm parameter', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken)
            .base(baseUrl)
            .post(endpoints.passwordLink)
            .json()
            .send({
              type: authTypes.password,
              merge: true,
              uid: email,
              password: password
            })
            .expectStatus(mergeConflictStatus)
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

        it(`Then property code of error should equal ${errors.mergeWarning}`, function (done) {
          expect(resData.error).to.have.property('code').that.equals(errors.mergeWarning)
          done()
        })

        it('Then property info should exist', function (done) {
          expect(resData).to.have.property('info')
          done()
        })

        it('Then property lost of info should exist and should be zero length', function (done) {
          expect(resData.info).to.have.property('lost').that.have.length(0)
          done()
        })
      })

      describe('When user 1 requests for merge password account with merge confirm parameter set to true', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken)
            .base(baseUrl)
            .post(endpoints.passwordLink)
            .json()
            .send({
              type: authTypes.password,
              merge: true,
              uid: email,
              password: password,
              confirmMerge: true
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
  describe('I want to test merging password account with another confirmed password account with different auth key', function () {
    context('Given user 1 and user 2 with password confirmed accounts with different auth keys', function () {
      const deviceID = 'test' + (Math.floor(Math.random() * 99999))
      const deviceID2 = 'test' + (Math.floor(Math.random() * 99999))
      let apiToken = ''

      const email = 'test' + (Math.floor(Math.random() * 99999)) + '@example.com'
      const email2 = 'test' + (Math.floor(Math.random() * 99999)) + '@example.com'
      const password = 'password1'
      const password2 = 'password2'

      before(async function () {
        // main client
        const passwordClient = await new helper.NewClient(deviceID)
          .passwordRegister(email, password, authTypes.password)
          .getProfile()
          .passwordConfirm(email, authTypes.password)
          .end()

        apiToken = passwordClient.apiToken

        await new helper.NewClient(deviceID2)
          .passwordRegister(email2, password2, authTypes.password2)
          .getProfile()
          .passwordConfirm(email2, authTypes.password2)
          .end()
      })

      after(async function () {
        await helper.clearAll()
      })

      describe('When user 1 requests for init merge password account', function () {
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

        it('Then property action should equal "merge"', function (done) {
          expect(resData).to.have.property('action').that.equals('merge')
          done()
        })

        it('Then property confirmCodeRequired should equal false', function (done) {
          expect(resData).to.have.property('confirmCodeRequired').is.false
          done()
        })
      })

      describe('When user 1 requests for merge password account with no merge confirm parameter', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken)
            .base(baseUrl)
            .post(endpoints.passwordLink)
            .json()
            .send({
              type: authTypes.password2,
              merge: true,
              uid: email2,
              password: password2
            })
            .expectStatus(mergeConflictStatus)
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

        it(`Then property code of error should equal ${errors.mergeWarning}`, function (done) {
          expect(resData.error).to.have.property('code').that.equals(errors.mergeWarning)
          done()
        })

        it('Then property info should exist', function (done) {
          expect(resData).to.have.property('info')
          done()
        })

        it('Then property lost of info should exist and should be zero length', function (done) {
          expect(resData.info).to.have.property('lost').that.have.length(0)
          done()
        })
      })

      describe('When user 1 requests for merge password account with merge confirm parameter set to true', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken)
            .base(baseUrl)
            .post(endpoints.passwordLink)
            .json()
            .send({
              type: authTypes.password2,
              merge: true,
              uid: email2,
              password: password2,
              confirmMerge: true
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

        it(`Then uid property of auths.${authTypes.password} should equal uid of user 1 and not equals of user 2`, function (done) {
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

        it(`Then uid property of auths.${authTypes.password2} should equal uid of user 2 and not equals of user 1`, function (done) {
          const uid = resData.user.auths[authTypes.password2].uid
          expect(uid).not.equals(email)
          expect(uid).equals(email2)
          done()
        })
      })
    })
  })

  // Password: same password type and auth key
  describe('I want to test merging password account with another confirmed password account with same auth key', function () {
    context('Given user 1 and user 2 with password accounts with same auth keys', function () {
      const deviceID = 'test' + (Math.floor(Math.random() * 99999))
      const deviceID2 = 'test' + (Math.floor(Math.random() * 99999))
      let apiToken = ''

      const email = 'test' + (Math.floor(Math.random() * 99999)) + '@example.com'
      const email2 = 'test' + (Math.floor(Math.random() * 99999)) + '@example.com'
      const password = 'password1'
      const password2 = 'password1'

      before(async function () {
        // main client
        const passwordClient = await new helper.NewClient(deviceID)
          .passwordRegister(email, password)
          .getProfile()
          .passwordConfirm(email)
          .end()

        apiToken = passwordClient.apiToken

        await new helper.NewClient(deviceID2)
          .passwordRegister(email2, password2)
          .getProfile()
          .passwordConfirm(email2)
          .end()
      })

      after(async function () {
        await helper.clearAll()
      })

      describe('When user 1 requests for init merge password account', function () {
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

      describe('When user 1 requests for merge password account with no merge confirm parameter', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken)
            .base(baseUrl)
            .post(endpoints.passwordLink)
            .json()
            .send({
              type: authTypes.password,
              merge: true,
              uid: email2,
              password: password2
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

        it('Then property info should not exist', function (done) {
          expect(resData).to.not.have.property('info')
          done()
        })
      })

      describe('When user 1 requests for merge password account with merge confirm parameter set to true', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken)
            .base(baseUrl)
            .post(endpoints.passwordLink)
            .json()
            .send({
              type: authTypes.password,
              merge: true,
              uid: email2,
              password: password2,
              confirmMerge: true
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

        it(`Then uid property of auths.${authTypes.password} should equal uid of user 1 and not equals of user 2`, function (done) {
          const uid = resData.user.auths[authTypes.password].uid
          expect(uid).equals(email)
          expect(uid).not.equals(email2)
          done()
        })
      })
    })
  })

  // Password: not confirmed base password account
  describe('I want to test merging not confirmed password account with confirmed existing password account', function () {
    context('Given user 1 with not confirmed password account and user 2 with confirmed password account', function () {
      const deviceID = 'test' + (Math.floor(Math.random() * 99999))
      const deviceID2 = 'test' + (Math.floor(Math.random() * 99999))
      let apiToken = ''

      const email = 'test' + (Math.floor(Math.random() * 99999)) + '@example.com'
      const email2 = 'test' + (Math.floor(Math.random() * 99999)) + '@example.com'
      const password = 'password1'
      const password2 = 'password2'

      before(async function () {
        // main client
        const passwordClient = await new helper.NewClient(deviceID)
          .passwordRegister(email, password)
          .end()

        apiToken = passwordClient.apiToken

        await new helper.NewClient(deviceID2)
          .passwordRegister(email2, password2, authTypes.password2)
          .getProfile()
          .passwordConfirm(email2, authTypes.password2)
          .end()
      })

      after(async function () {
        await helper.clearAll()
      })

      describe('When user 1 requests for init merge for password account', function () {
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

      describe('When user 1 requests for merge password account with no merge confirm parameter', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken)
            .base(baseUrl)
            .post(endpoints.passwordLink)
            .json()
            .send({
              type: authTypes.password2,
              merge: true,
              uid: email2,
              password: password2
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

      describe('When user 1 requests for merge password account with merge confirm parameter set to true', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken)
            .base(baseUrl)
            .post(endpoints.passwordLink)
            .json()
            .send({
              type: authTypes.password2,
              merge: true,
              uid: email2,
              password: password2,
              confirmMerge: true
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

        it(`Then property auths should not contain ${authTypes.password2} type`, function (done) {
          expect(resData.user.auths).to.not.have.property(authTypes.password2)
          done()
        })
      })
    })
  })

  // Password: not confirmed
  describe('I want to test merging with not confirmed existing password account right after registration confirmation code has been sent', function () {
    context('Given user 1 with OTP account and user 2 with not confirmed password account and registration confirmation code has been sent', function () {
      const deviceID = 'test' + (Math.floor(Math.random() * 99999))
      const deviceID2 = 'test' + (Math.floor(Math.random() * 99999))
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

        await new helper.NewClient(deviceID2)
          .passwordRegister(email, password)
          .end()
      })

      after(async function () {
        await helper.clearAll()
      })

      describe('When user 1 requests for init merge password account', function () {
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
            .expectStatus(429)
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

        it(`Then property code of error should equal ${errors.codeTimeout}`, function (done) {
          expect(resData.error).to.have.property('code').that.equals(errors.codeTimeout)
          done()
        })

        it('Then property action should equal "merge"', function (done) {
          expect(resData).to.have.property('action').that.equals('merge')
          done()
        })

        it('Then property confirmCodeRequired should equal true', function (done) {
          expect(resData).to.have.property('confirmCodeRequired').is.true
          done()
        })
      })

      describe('When user 1 requests for merge password account with no merge confirm parameter', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken)
            .base(baseUrl)
            .post(endpoints.passwordLink)
            .json()
            .send({
              type: authTypes.password,
              merge: true,
              uid: email,
              password: password,
              code: pswdCode
            })
            .expectStatus(mergeConflictStatus)
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

        it(`Then property code of error should equal ${errors.mergeWarning}`, function (done) {
          expect(resData.error).to.have.property('code').that.equals(errors.mergeWarning)
          done()
        })

        it('Then property info should exist', function (done) {
          expect(resData).to.have.property('info')
          done()
        })

        it('Then property lost of info should exist and should be zero length', function (done) {
          expect(resData.info).to.have.property('lost').that.have.length(0)
          done()
        })
      })

      describe('When user 1 requests for merge password account with merge confirm parameter set to true', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken)
            .base(baseUrl)
            .post(endpoints.passwordLink)
            .json()
            .send({
              type: authTypes.password,
              merge: true,
              uid: email,
              password: password,
              confirmMerge: true
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

  // Password: not confirmed + timeout
  describe('I want to test merging with not confirmed existing password account with timeout after registration confirmation code has been sent', function () {
    context('Given user 1 with OTP account and user 2 with not confirmed password account', function () {
      const deviceID = 'test' + (Math.floor(Math.random() * 99999))
      const deviceID2 = 'test' + (Math.floor(Math.random() * 99999))
      let apiToken = ''

      const phone = '+7' + (Math.floor(Math.random() * 999999999))
      const otpCode = staticCodes.otp

      const email = 'test' + (Math.floor(Math.random() * 99999)) + '@example.com'
      const password = 'password1'
      const pwdsCode = staticCodes.password

      before(async function () {
        // main client
        const otpClient = await new helper.NewClient(deviceID)
          .otpGetCode(phone)
          .otpAuth(phone, otpCode)
          .end()

        apiToken = otpClient.apiToken

        await new helper.NewClient(deviceID2)
          .passwordRegister(email, password)
          .end()

        await helper.sleep(config.sentCodeTimeout)
      })

      after(async function () {
        await helper.clearAll()
      })

      describe('When user 1 requests for init merge password account', function () {
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

        it('Then property action should equal "merge"', function (done) {
          expect(resData).to.have.property('action').that.equals('merge')
          done()
        })

        it('Then property confirmCodeRequired should equal true', function (done) {
          expect(resData).to.have.property('confirmCodeRequired').is.true
          done()
        })
      })

      describe('When user 1 requests for merge password account with no merge confirm parameter', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken)
            .base(baseUrl)
            .post(endpoints.passwordLink)
            .json()
            .send({
              type: authTypes.password,
              merge: true,
              uid: email,
              password: password,
              code: pwdsCode
            })
            .expectStatus(mergeConflictStatus)
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

        it(`Then property code of error should equal ${errors.mergeWarning}`, function (done) {
          expect(resData.error).to.have.property('code').that.equals(errors.mergeWarning)
          done()
        })

        it('Then property info should exist', function (done) {
          expect(resData).to.have.property('info')
          done()
        })

        it('Then property lost of info should exist and should be zero length', function (done) {
          expect(resData.info).to.have.property('lost').that.have.length(0)
          done()
        })
      })

      describe('When user 1 requests for merge password account with merge confirm parameter set to true', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken)
            .base(baseUrl)
            .post(endpoints.passwordLink)
            .json()
            .send({
              type: authTypes.password,
              merge: true,
              uid: email,
              password: password,
              confirmMerge: true
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

  // Password: confirmed account after merge with code
  describe('I want to test that after merging with code, not confirmed password account should be confirmed', function () {
    context('Given user 1 with OTP account and user 2 with not confirmed password account and base timeout', function () {
      const deviceID = 'test' + (Math.floor(Math.random() * 99999))
      const deviceID2 = 'test' + (Math.floor(Math.random() * 99999))
      let apiToken = ''
      let apiToken2 = ''

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

        const passwordClient = await new helper.NewClient(deviceID2)
          .passwordRegister(email, password)
          .end()

        apiToken2 = passwordClient.apiToken

        await helper.sleep(config.sentCodeTimeout)
      })

      after(async function () {
        await helper.clearAll()
      })

      describe('When user 1 requests for init merge password account', function () {
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

        it('Then property action should equal "merge"', function (done) {
          expect(resData).to.have.property('action').that.equals('merge')
          done()
        })

        it('Then property confirmCodeRequired should equal true', function (done) {
          expect(resData).to.have.property('confirmCodeRequired').is.true
          done()
        })
      })

      describe('When user 1 requests for merge password account with code and no merge confirm parameter', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken)
            .base(baseUrl)
            .post(endpoints.passwordLink)
            .json()
            .send({
              type: authTypes.password,
              merge: true,
              uid: email,
              password: password,
              code: pswdCode,
            })
            .expectStatus(mergeConflictStatus)
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

        it(`Then property code of error should equal ${errors.mergeWarning}`, function (done) {
          expect(resData.error).to.have.property('code').that.equals(errors.mergeWarning)
          done()
        })

        it('Then property info should exist', function (done) {
          expect(resData).to.have.property('info')
          done()
        })

        it('Then property lost of info should exist and should be zero length', function (done) {
          expect(resData.info).to.have.property('lost').that.have.length(0)
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

        it(`Then property auths should contain ${authTypes.password} type that is confirmed`, function (done) {
          const auths = resData.user.auths
          expect(auths).to.have.property(authTypes.password).that.is.an('object')
          expect(auths[authTypes.password]).to.have.property('confirmed').that.is.true
          done()
        })
      })
    })
  })

  // Password: lost account session after merge
  describe('I want to test that after merging password account, this account should be lost for her session but available for login', function () {
    context('Given user 1 with OTP account and user 2 with confirmed password account and user 1 merged user 2', function () {
      const deviceID = 'test' + (Math.floor(Math.random() * 99999))
      const deviceID2 = 'test' + (Math.floor(Math.random() * 99999))
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
          .end()

        const user2 = await new helper.NewClient(deviceID2)
          .passwordRegister(email, password)
          .getProfile()
          .passwordConfirm(email)
          .end()

        await user1
          .passwordInitLink(email)
          .passwordLink(email, password, 'merge')
          .end()

        apiToken2 = user2.apiToken
      })

      after(async function () {
        await helper.clearAll()
      })

      describe('When user 2 requests profile', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken2)
            .base(baseUrl)
            .get(endpoints.profile)
            .json()
            .expectStatus(403)
            .end(function (_, raw, res) {
              resData = res
              done.apply(null, arguments)
            })
        })

        it('Then request should return result false', function (done) {
          expect(resData).to.have.property('result').that.is.false
          done()
        })

        it(`Then request should return message with error: ${errors.userNotFoundInProfile}`, function (done) {
          expect(resData).to.have.property('message')
          expect(resData.message).equal(errors.userNotFoundInProfile)
          done()
        })
      })

      describe('When user 2 requests password login', function () {
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

  // Password: lost ai after merge
  describe('I want to test that after merging password account, similar auth identities will be lost', function () {
    context('Given user 1 with OTP account and user 2 with confirmed password and OTP auth identities', function () {
      const deviceID = 'test' + (Math.floor(Math.random() * 99999))
      const deviceID2 = 'test' + (Math.floor(Math.random() * 99999))
      let apiToken = ''

      const phone = '+7' + (Math.floor(Math.random() * 999999999))
      const phone2 = '+7' + (Math.floor(Math.random() * 999999999))
      const otpCode = staticCodes.otp

      const email = 'test' + (Math.floor(Math.random() * 99999)) + '@example.com'
      const password = 'password1'

      before(async function () {
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
          .otpInitLink(phone2)
          .otpLink(phone2, otpCode)
          .end()
      })

      after(async function () {
        await helper.clearAll()
      })

      describe('When user 1 requests for init merge password account', function () {
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

        it('Then property action should equal "merge"', function (done) {
          expect(resData).to.have.property('action').that.equals('merge')
          done()
        })

        it('Then property confirmCodeRequired should equal false', function (done) {
          expect(resData).to.have.property('confirmCodeRequired').is.false
          done()
        })
      })

      describe('When user 1 requests for merge password account with no merge confirm parameter', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken)
            .base(baseUrl)
            .post(endpoints.passwordLink)
            .json()
            .send({
              type: authTypes.password,
              merge: true,
              uid: email,
              password: password
            })
            .expectStatus(mergeConflictStatus)
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

        it(`Then property code of error should equal ${errors.mergeWarning}`, function (done) {
          expect(resData.error).to.have.property('code').that.equals(errors.mergeWarning)
          done()
        })

        it('Then property info should exist', function (done) {
          expect(resData).to.have.property('info')
          done()
        })

        it('Then property lost of info should exist that length must be one', function (done) {
          expect(resData.info).to.have.property('lost').that.have.length(1)
          done()
        })

        it(`Then property lost of info should contain ${authTypes.otp} type, expected uid and error '${errors.authLost}'`, function (done) {
          const row = resData.info.lost[0]
          expect(row.type).equals(authTypes.otp)
          expect(row.uid).equals(phone2)
          expect(row.error).equals(errors.authLost)
          done()
        })
      })

      describe('When user 1 requests for merge password account with merge confirm parameter set to true', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken)
            .base(baseUrl)
            .post(endpoints.passwordLink)
            .json()
            .send({
              type: authTypes.password,
              merge: true,
              uid: email,
              password: password,
              confirmMerge: true
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

        it(`Then uid property of auths.${authTypes.otp} should equal uid of user 1 and not equals of user 2`, function (done) {
          const uid = resData.user.auths[authTypes.otp].uid
          expect(uid).equals(phone)
          expect(uid).not.equals(phone2)
          done()
        })
      })
    })
  })

  // Password: not login in lost ai
  describe('I want to test that after merging password account with lost auth identities, account that contain this auth identity should be really lost', function () {
    context('Given user 1 with password account and user 2 with 2 password auth identities, one of which contains the same password auth identity as user 1 and user 1 merged user 2', function () {
      const deviceID = 'test' + (Math.floor(Math.random() * 99999))
      const deviceID2 = 'test' + (Math.floor(Math.random() * 99999))
      let apiToken2 = ''

      const email = 'test' + (Math.floor(Math.random() * 99999)) + '@example.com'
      const email2 = 'test' + (Math.floor(Math.random() * 99999)) + '@example.com'
      const lostedEmail = 'test' + (Math.floor(Math.random() * 99999)) + '@example.com'

      const password = 'password1'
      const password2 = 'password2'
      const lostedPassword = 'password3'

      before(async function () {
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
          .passwordInitLink(lostedEmail, authTypes.password)
          .passwordLink(lostedEmail, lostedPassword, 'link', authTypes.password)
          .end()

        await user1
          .passwordInitLink(email2, authTypes.password2)
          .passwordLink(email2, password2, 'merge', authTypes.password2)
          .end()

        apiToken2 = user2.apiToken
      })

      after(async function () {
        await helper.clearAll()
      })

      describe('When user 2 requests profile', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken2)
            .base(baseUrl)
            .get(endpoints.profile)
            .json()
            .expectStatus(403)
            .end(function (_, raw, res) {
              resData = res
              done.apply(null, arguments)
            })
        })

        it('Then request should return result false', function (done) {
          expect(resData).to.have.property('result').that.is.false
          done()
        })

        it(`Then request should return message with error: ${errors.userNotFoundInProfile}`, function (done) {
          expect(resData).to.have.property('message')
          expect(resData.message).equal(errors.userNotFoundInProfile)
          done()
        })
      })

      describe('When user 2 requests password login with credentials of lost password account', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken2)
            .base(baseUrl)
            .post(endpoints.passwordLogin)
            .json()
            .send({
              type: authTypes.password,
              email: lostedEmail,
              password: lostedPassword
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

  // Password: Experimental group
  // Password: user does not exist
  describe('I want to test merging with not existing password account', function () {
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

      describe('When user 1 requests for init merge password account', function () {
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

      describe('When user 1 requests for merge password account with no merge confirm parameter', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken)
            .base(baseUrl)
            .post(endpoints.passwordLink)
            .json()
            .send({
              type: authTypes.password,
              merge: true,
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

      describe('When user 1 requests for merge password account with merge confirm parameter set to true', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken)
            .base(baseUrl)
            .post(endpoints.passwordLink)
            .json()
            .send({
              type: authTypes.password,
              merge: true,
              uid: email,
              password: password,
              confirmMerge: true
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
          expect(resData.user.auths).to.not.have.property(authTypes.password)
          done()
        })
      })
    })
  })

  // Password: invalid password
  describe('I want to test merging with confirmed existing password account and invalid password', function () {
    context('Given user 1 with OTP account and user 2 with confirmed password account', function () {
      const deviceID = 'test' + (Math.floor(Math.random() * 99999))
      const deviceID2 = 'test' + (Math.floor(Math.random() * 99999))
      let apiToken = ''

      const phone = '+7' + (Math.floor(Math.random() * 999999999))
      const otpCode = staticCodes.otp

      const email = 'test' + (Math.floor(Math.random() * 99999)) + '@example.com'
      const password = 'password1'

      before(async function () {
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

      describe('When user 1 requests for init merge password account', function () {
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

        it('Then property action should equal "merge"', function (done) {
          expect(resData).to.have.property('action').that.equals('merge')
          done()
        })

        it('Then property confirmCodeRequired should equal false', function (done) {
          expect(resData).to.have.property('confirmCodeRequired').is.false
          done()
        })
      })

      describe('When user 1 requests for merge password account with invalid password and no merge confirm parameter', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken)
            .base(baseUrl)
            .post(endpoints.passwordLink)
            .json()
            .send({
              type: authTypes.password,
              merge: true,
              uid: email,
              password: 'invalid password'
            })
            .expectStatus(403)
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

        it(`Then property code of error should equal ${errors.incorrectPassword}`, function (done) {
          expect(resData.error).to.have.property('code').that.equals(errors.incorrectPassword)
          done()
        })
      })

      describe('When user 1 requests for merge password account with invalid password and merge confirm parameter set to true', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken)
            .base(baseUrl)
            .post(endpoints.passwordLink)
            .json()
            .send({
              type: authTypes.password,
              merge: true,
              uid: email,
              password: 'invalid password',
              confirmMerge: true
            })
            .expectStatus(403)
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

        it(`Then property code of error should equal ${errors.incorrectPassword}`, function (done) {
          expect(resData.error).to.have.property('code').that.equals(errors.incorrectPassword)
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
          const auths = resData.user.auths
          expect(auths).to.not.have.property(authTypes.password).that.is.an('object')
          done()
        })
      })
    })
  })

  // Password: self merge
  describe('I want to test self merging with confirmed existing password account', function () {
    context('Given user 1 with confirmed password account', function () {
      const deviceID = 'test' + (Math.floor(Math.random() * 99999))
      let apiToken = ''

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

      describe('When user 1 requests for init merge password account', function () {
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

        it(`Then property code of error should equal ${errors.cannotMergeSelf}`, function (done) {
          expect(resData.error).to.have.property('code').that.equals(errors.cannotMergeSelf)
          done()
        })

        it('Then property action should not exist', function (done) {
          expect(resData).to.not.have.property('action')
          done()
        })

        it('Then property confirmCodeRequired should not exist', function (done) {
          expect(resData).to.not.have.property('confirmCodeRequired')
          done()
        })
      })

      describe('When user 1 requests for merge password account with no merge confirm parameter', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken)
            .base(baseUrl)
            .post(endpoints.passwordLink)
            .json()
            .send({
              type: authTypes.password,
              merge: true,
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

        it(`Then property code of error should equal ${errors.cannotMergeSelf}`, function (done) {
          expect(resData.error).to.have.property('code').that.equals(errors.cannotMergeSelf)
          done()
        })

        it('Then property info should not exist', function (done) {
          expect(resData).to.not.have.property('info')
          done()
        })
      })

      describe('When user 1 requests for merge password account with merge confirm parameter set to true', function () {
        let resData = null

        before(function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken)
            .base(baseUrl)
            .post(endpoints.passwordLink)
            .json()
            .send({
              type: authTypes.password,
              merge: true,
              uid: email,
              password: password,
              confirmMerge: true
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

        it(`Then property code of error should equal ${errors.cannotMergeSelf}`, function (done) {
          expect(resData.error).to.have.property('code').that.equals(errors.cannotMergeSelf)
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
      })
    })
  })
})
