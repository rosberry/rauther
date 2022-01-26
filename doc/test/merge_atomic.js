"use strict"

var SwaggerParser = require("swagger-parser");
var parser = new SwaggerParser();
var hippie = require("hippie-swagger");
var api = require("hippie");
var expect = require("chai").expect;
var chai = require("chai");
var chaihttp = require("chai-http")
let should = chai.should();
var spec;

var config = require("./config.js");
var helper = require("./helper.js");

chai.use(chaihttp);

var baseUrl = config.baseUrl;
var specFile = config.specFile;

var userName = "Petya";

const mergeConfictStatus = 409;

async function auth(device_id) {
    console.log("AUTH!", device_id);

    return api()
        .base(baseUrl)
        .post("/auth")
        .json()
        .send({
            device_id: device_id
        })
        .expectStatus(200)
        .end()
}

describe("check merge flow:", function () {
    this.timeout(60000); // very large swagger files may take a few seconds to parse
    this.slow(200);

    before(function (done) {
        // if using mocha, dereferencing can be performed prior during initialization via the delay flag:
        // https://mochajs.org/#delayed-root-suite
        parser.dereference(specFile, function (err, api) {
            if (err) {
                return done(err);
            }
            spec = api;
            done();
        });
    });

    // #1 Basic merge (otp, social)
    describe("I want check basic OTP, Social merge", function () {
        var device_id = "test" + (Math.floor(Math.random() * 99999));
        var apiToken = "";

        var phone = "+7" + (Math.floor(Math.random() * 999999999));
        var code = "123321";

        var email = "test" + (Math.floor(Math.random() * 99999)) + "@rosberry.com";
        var password = "password1";
        before(async function () {
            await helper.auth(device_id);

            // prepare OTP user
            await helper.getOTPCode(phone)
            await helper.otpAuth(phone, code)

            // prepare password (email) user
            await helper.register(email, password)
            await helper.getProfile()
            console.log("code:", code)

            await helper.confirm(email, code)

            apiToken = helper.apiToken
        })

        // init link otp user (expect ok)
        describe("merge otp user", function () {
            it("get otp code", function (done) {
                hippie(spec)
                    .header("Authorization", "Bearer " + apiToken)
                    .base(baseUrl)
                    .post("/otp/{key}/code")
                    .pathParams({
                        key: "telegram"
                    })
                    .json()
                    .send({
                        phone: phone
                    })
                    .expectStatus(200)
                    .end(function (err, raw, res) {
                        expect(res).to.have.property("result").that.is.true;
                        expect(res).to.not.have.property("error");
                        done.apply(null, arguments);
                    });
            });

            context("when merge confirm not set", function () {
                it("should return result false with merge_warning", function (done) {
                    hippie(spec)
                        .header("Authorization", "Bearer " + apiToken)
                        .base(baseUrl)
                        .post("/otp/{key}/auth")
                        .pathParams({
                            key: "telegram"
                        })
                        .json()
                        .send({
                            name: userName,
                            phone: phone,
                            code: code
                        })
                        .expectStatus(mergeConfictStatus)
                        .end(function (err, raw, res) {
                            expect(res).to.have.property("result").that.is.false;
                            expect(res).to.have.property("error");
                            expect(res.error).to.have.property("code").that.equals("merge_warning");
                            done.apply(null, arguments);
                        });
                });
            });

            context("wnen merge confirm is true", function () {
                it("should return result true", function (done) {
                    hippie(spec)
                        .header("Authorization", "Bearer " + apiToken)
                        .base(baseUrl)
                        .post("/otp/{key}/auth")
                        .pathParams({
                            key: "telegram"
                        })
                        .json()
                        .send({
                            name: userName,
                            phone: phone,
                            code: code,
                            confirmMerge: true
                        })
                        .expectStatus(200)
                        .end(function (err, raw, res) {
                            expect(res).to.have.property("result").that.is.true;
                            expect(res).to.not.have.property("error");
                            done.apply(null, arguments);
                        });
                });
            });
        });

        // check auth identities
        describe("check auth identities", function () {
            it("profile should have all auth identities", function (done) {
                hippie(spec)
                    .header("Authorization", "Bearer " + apiToken)
                    .base(baseUrl)
                    .get("/profile")
                    .json()
                    .expectStatus(200)
                    .end(function (err, raw, res) {
                        expect(res).to.have.property("result").that.is.true;
                        expect(res).to.not.have.property("error");
                        expect(res).to.have.property("user").that.is.an("object");
                        expect(res.user).to.have.property("guest").that.is.false;
                        expect(res.user).to.have.property("auths").that.is.an("object");

                        expect(res.user.auths).to.have.property("email").that.is.an("object");
                        expect(res.user.auths.email).to.have.property("confirmed").that.is.true;

                        expect(res.user.auths).to.have.property("telegram").that.is.an("object");
                        expect(res.user.auths.telegram).to.have.property("confirmed").that.is.true;

                        done.apply(null, arguments);
                    });
            });
        });
    });
});