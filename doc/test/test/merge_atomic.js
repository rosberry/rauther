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

  // #1 Basic merge (otp, social)
  describe('I want to test linking/merging with existing OTP account', function () {
    context('Given user1 with email account and user2 with OTP account', function () {
      const deviceID = 'test' + (Math.floor(Math.random() * 99999))
      const deviceID2 = 'test' + (Math.floor(Math.random() * 99999))
      let apiToken = ''

      const phone = '+7' + (Math.floor(Math.random() * 999999999))
      const code = '123321'

      const email = 'test' + (Math.floor(Math.random() * 99999)) + '@example.com'
      const password = 'password1'

      before(async function () {
        // main client
        const passwordClient = await new helper.ClientBuilder()
          .addAuth(deviceID)
          .addPasswordRegister(email, password)
          .addGetProfile()
          .addPasswordConfirm(email)
          .build()

        apiToken = passwordClient.apiToken

        const otpClient = await new helper.ClientBuilder()
          .addAuth(deviceID2)
          .addGetOTPCode(phone)
          .addOTPAuth(phone, code)
          .build()
      })

      after(async function () {
        await helper.clearAll()
      })

      // init link otp user (expect ok)
      describe('When user1 requests code for OTP account', function () {
        it('Then request should return result true and generate code', function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken)
            .base(baseUrl)
            .post('/otp/{key}/code')
            .pathParams({
              key: 'telegram'
            })
            .json()
            .send({
              phone: phone
            })
            .expectStatus(200)
            .end(function (_, raw, res) {
              expect(res).to.have.property('result').that.is.true
              expect(res).to.not.have.property('error')
              done.apply(null, arguments)
            })
        })
      })

      describe('When user1 requests OTP auth with no merge confirm parameter', function () {
        it(`Then request should return result false with ${errors.mergeWarning}`, function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken)
            .base(baseUrl)
            .post('/otp/{key}/auth')
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
              expect(res).to.have.property('result').that.is.false
              expect(res).to.have.property('error')
              expect(res.error).to.have.property('code').that.equals(errors.mergeWarning)
              done.apply(null, arguments)
            })
        })
      })

      describe('When user1 requests OTP auth with merge confirm parameter set to true', function () {
        it('Then request should return result true and accounts should be merged', function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken)
            .base(baseUrl)
            .post('/otp/{key}/auth')
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
              expect(res).to.have.property('result').that.is.true
              expect(res).to.not.have.property('error')
              done.apply(null, arguments)
            })
        })
      })

      // check auth identities
      describe('When user1 requests profile', function () {
        it('Then request should return profile with phone and OTP auth identities', function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken)
            .base(baseUrl)
            .get(endpoints.profile)
            .json()
            .expectStatus(200)
            .end(function (_, raw, res) {
              expect(res).to.have.property('result').that.is.true
              expect(res).to.not.have.property('error')
              expect(res).to.have.property('user').that.is.an('object')
              expect(res.user).to.have.property('guest').that.is.false
              expect(res.user).to.have.property('auths').that.is.an('object')

              const auths = res.user.auths
              expect(auths).to.have.property(authTypes.password).that.is.an('object')
              expect(auths[authTypes.password]).to.have.property('confirmed').that.is.true

              expect(auths).to.have.property(authTypes.otp).that.is.an('object')
              expect(auths[authTypes.otp]).to.have.property('confirmed').that.is.true

              done.apply(null, arguments)
            })
        })
      })
    })
  })

  if (googleToken !== "") {
    describe('I want to test linking/merging with existing social account', function () {
      context('Given user1 with email account and user2 with social account', function () {
        const deviceID = 'test' + (Math.floor(Math.random() * 99999))
        const deviceID2 = 'test' + (Math.floor(Math.random() * 99999))
        let apiToken = ''

        const email = 'test' + (Math.floor(Math.random() * 99999)) + '@example.com'
        const password = 'password1'

        before(async function () {
          // main client
          const passwordClient = await new helper.ClientBuilder()
            .addAuth(deviceID)
            .addPasswordRegister(email, password)
            .addGetProfile()
            .addPasswordConfirm(email)
            .build()

          apiToken = passwordClient.apiToken

          const socialClient = await new helper.ClientBuilder()
            .addAuth(deviceID2)
            .addSocialLogin(googleToken)
            .build()
        })

        after(async function () {
          await helper.clearAll()
        })

        describe('When user1 requests social login for social account without merge confirm parameter', function () {
          it(`Then request should return result false with ${errors.mergeWarning}`, function (done) {
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
                expect(res).to.have.property('result').that.is.false
                expect(res).to.have.property('error')
                expect(res.error).to.have.property('code').that.equals(errors.mergeWarning)
                done.apply(null, arguments)
              })
          })
        })

        describe('When user1 requests social login with merge confirm parameter set to true', function () {
          it('Then request should return result true and accounts should be merged', function (done) {
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
                expect(res).to.have.property('result').that.is.true
                expect(res).to.not.have.property('error')
                done.apply(null, arguments)
              })
          })
        })

        // check auth identities
        describe('When user1 requests profile', function () {
          it('Then request should return profile with social auth identities', function (done) {
            hippie(spec)
              .header('Authorization', 'Bearer ' + apiToken)
              .base(baseUrl)
              .get(endpoints.profile)
              .json()
              .expectStatus(200)
              .end(function (_, raw, res) {
                expect(res).to.have.property('result').that.is.true
                expect(res).to.not.have.property('error')
                expect(res).to.have.property('user').that.is.an('object')
                expect(res.user).to.have.property('guest').that.is.false
                expect(res.user).to.have.property('auths').that.is.an('object')

                const auths = res.user.auths
                expect(auths).to.have.property(authTypes.password).that.is.an('object')
                expect(auths[authTypes.password]).to.have.property('confirmed').that.is.true

                expect(auths).to.have.property(authTypes.social).that.is.an('object')
                expect(auths[authTypes.social]).to.have.property('confirmed').that.is.true

                done.apply(null, arguments)
              })
          })
        })
      })
    })
  }
})
