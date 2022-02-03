'use strict'

const SwaggerParser = require('swagger-parser')
const parser = new SwaggerParser()
const hippie = require('hippie-swagger')
const expect = require('chai').expect
const chai = require('chai')
const chaihttp = require('chai-http')
let spec

const config = require('../config.js')
const helper = require('../helper.js')
const googleToken = process.env.GOOGLE_TOKEN || ""
const authTypes = helper.authTypes
const endpoints = helper.endpoints
const errors = helper.errors
const staticCodes = helper.staticCodes

chai.use(chaihttp)

const baseUrl = config.baseUrl
const specFile = config.specFile

const userName = 'Petya'

const mergeConfictStatus = 409

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
  describe('I want to test merging with existing OTP account', function () {
    context('Given user 1 with email account and user 2 with OTP account', function () {
      const deviceID = 'test' + (Math.floor(Math.random() * 99999))
      const deviceID2 = 'test' + (Math.floor(Math.random() * 99999))
      let apiToken = ''

      const phone = '+7' + (Math.floor(Math.random() * 999999999))
      const code = staticCodes.otp

      const email = 'test' + (Math.floor(Math.random() * 99999)) + '@example.com'
      const password = 'password1'

      before(async function () {
        // main client
        const passwordClient = await new helper.newClient(deviceID)
          .passwordRegister(email, password)
          .getProfile()
          .passwordConfirm(email)
          .end()

        apiToken = passwordClient.apiToken

        const otpClient = await new helper.newClient(deviceID2)
          .getOTPCode(phone)
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
            .expectStatus(mergeConfictStatus)
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

        it(`Then property auths should exists ${authTypes.password} type that is confirmed`, function (done) {
          const auths = resData.user.auths
          expect(auths).to.have.property(authTypes.password).that.is.an('object')
          expect(auths[authTypes.password]).to.have.property('confirmed').that.is.true
          done()
        })

        it(`Then property auths should exists ${authTypes.otp} type that is confirmed`, function (done) {
          const auths = resData.user.auths
          expect(auths).to.have.property(authTypes.otp).that.is.an('object')
          expect(auths[authTypes.otp]).to.have.property('confirmed').that.is.true
          done()
        })
      })
    })
  })

  // #2 Merge social
  if (googleToken !== "") {
    describe('I want to test merging with existing social account', function () {
      context('Given user 1 with email account and user2 with social account', function () {
        const deviceID = 'test' + (Math.floor(Math.random() * 99999))
        const deviceID2 = 'test' + (Math.floor(Math.random() * 99999))
        let apiToken = ''

        const email = 'test' + (Math.floor(Math.random() * 99999)) + '@example.com'
        const password = 'password1'

        before(async function () {
          // main client
          const passwordClient = await new helper.newClient(deviceID)
            .passwordRegister(email, password)
            .getProfile()
            .passwordConfirm(email)
            .end()

          apiToken = passwordClient.apiToken

          const socialClient = await new helper.newClient(deviceID2)
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
              .expectStatus(mergeConfictStatus)
              .end(function (_, raw, res) {
                resData = res
                done.apply(null, arguments)
              })
          })

          it(`Then request should return result false with ${errors.mergeWarning}`, function (done) {
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

          it(`Then property auths should exists ${authTypes.password} type that is confirmed`, function (done) {
            const auths = resData.user.auths
            expect(auths).to.have.property(authTypes.password).that.is.an('object')
            expect(auths[authTypes.password]).to.have.property('confirmed').that.is.true
            done()
          })

          it(`Then property auths should exists ${authTypes.social} type that is confirmed`, function (done) {
            const auths = resData.user.auths
            expect(auths).to.have.property(authTypes.social).that.is.an('object')
            expect(auths[authTypes.social]).to.have.property('confirmed').that.is.true
            done()
          })
        })
      })
    })
  }

  // #3 Merge password
  describe('I want to test merging with existing password account', function () {
    context('Given user 1 with OTP account and user 2 with password account', function () {
      const deviceID = 'test' + (Math.floor(Math.random() * 99999))
      const deviceID2 = 'test' + (Math.floor(Math.random() * 99999))
      let apiToken = ''

      const phone = '+7' + (Math.floor(Math.random() * 999999999))
      const otpCode = staticCodes.otp

      const email = 'test' + (Math.floor(Math.random() * 99999)) + '@example.com'
      const password = 'password1'

      before(async function () {
        // main client
        const otpClient = await new helper.newClient(deviceID)
          .getOTPCode(phone)
          .otpAuth(phone, otpCode)
          .end()

        apiToken = otpClient.apiToken

        const passwordClient = await new helper.newClient(deviceID2)
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
              password: password,
            })
            .expectStatus(mergeConfictStatus)
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

      describe('When user 1 requests password auth with merge confirm parameter set to true', function () {
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
              confirmMerge: true,
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

        it(`Then property auths should exists ${authTypes.otp} type that is confirmed`, function (done) {
          const auths = resData.user.auths
          expect(auths).to.have.property(authTypes.otp).that.is.an('object')
          expect(auths[authTypes.otp]).to.have.property('confirmed').that.is.true
          done()
        })

        it(`Then property auths should exists ${authTypes.password} type that is confirmed`, function (done) {
          const auths = resData.user.auths
          expect(auths).to.have.property(authTypes.password).that.is.an('object')
          expect(auths[authTypes.password]).to.have.property('confirmed').that.is.true
          done()
        })
      })
    })
  })


})
