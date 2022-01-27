'use strict'

const SwaggerParser = require('swagger-parser')
const parser = new SwaggerParser()
const hippie = require('hippie-swagger')
const expect = require('chai').expect
const chai = require('chai')
const chaihttp = require('chai-http')
let spec

const config = require('./config.js')
const helper = require('./helper.js')

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

      const email = 'test' + (Math.floor(Math.random() * 99999)) + '@rosberry.com'
      const password = 'password1'

      before(async function () {
        // extra temp client
        const client2 = helper.newClient()
        await client2.auth(deviceID2)
        // console.log('client2 token', client2.apiToken)

        // prepare OTP user
        await client2.getOTPCode(phone)
        await client2.otpAuth(phone, code)

        // main client
        const client = helper.newClient()
        await client.auth(deviceID)
        // console.log('client token', client.apiToken)

        // prepare password (email) user
        await client.register(email, password)
        await client.getProfile()
        // console.log('code:', code)

        await client.confirm(email, code)

        apiToken = client.apiToken
      })

      after(async function () {
        await helper.client.clearAll()
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

        describe('When user1 requests OTP auth with no merge confirm parameter', function () {
          it('Then request should return result false with merge_warning', function (done) {
            hippie(spec)
              .header('Authorization', 'Bearer ' + apiToken)
              .base(baseUrl)
              .post('/otp/{key}/auth')
              .pathParams({
                key: 'telegram'
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
                expect(res.error).to.have.property('code').that.equals('merge_warning')
                done.apply(null, arguments)
              })
          })
        })

        describe('When user1 requests OTP auth with merge confirm parameter set to true', function () {
          it('Then request should return result true and accounts should be linked', function (done) {
            hippie(spec)
              .header('Authorization', 'Bearer ' + apiToken)
              .base(baseUrl)
              .post('/otp/{key}/auth')
              .pathParams({
                key: 'telegram'
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
      })

      // check auth identities
      describe('When user1 requests profile', function () {
        it('Then request should return profile with phone and OTP auth identities', function (done) {
          hippie(spec)
            .header('Authorization', 'Bearer ' + apiToken)
            .base(baseUrl)
            .get('/profile')
            .json()
            .expectStatus(200)
            .end(function (_, raw, res) {
              expect(res).to.have.property('result').that.is.true
              expect(res).to.not.have.property('error')
              expect(res).to.have.property('user').that.is.an('object')
              expect(res.user).to.have.property('guest').that.is.false
              expect(res.user).to.have.property('auths').that.is.an('object')

              expect(res.user.auths).to.have.property('email').that.is.an('object')
              expect(res.user.auths.email).to.have.property('confirmed').that.is.true

              expect(res.user.auths).to.have.property('telegram').that.is.an('object')
              expect(res.user.auths.telegram).to.have.property('confirmed').that.is.true

              done.apply(null, arguments)
            })
        })
      })
    })
  })
})
