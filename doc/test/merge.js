"use strict"

var SwaggerParser = require("swagger-parser");
var parser = new SwaggerParser();
var hippie = require("hippie-swagger");
var expect = require("chai").expect;
var chai = require("chai");
var chaihttp = require("chai-http")
let should = chai.should();
var spec;

var config = require("./config.js");

chai.use(chaihttp);

var baseUrl = config.baseUrl;
var specFile = config.specFile;

var googleToken = process.env.GOOGLE_TOKEN || "";
if (googleToken == "") {
    console.log('ATTENTION! No GOOGLE_TOKEN provided, so google login tests are skipped.');
}

var phone = "+7" + (Math.floor(Math.random() * 999999999));
var email = "test" + (Math.floor(Math.random() * 99999)) + "@rosberry.com";
var userPassword = "password1";

var device_id = "test" + (Math.floor(Math.random() * 99999));
var apiToken = "";

var code = "";
var otpCode = "123321";
var userName = "Petya";


describe("check basic merge flow:", function () {
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

    // auth
    describe("auth", function () {
        it("should return token and device_id", function (done) {
            hippie(spec)
                .base(baseUrl)
                .post("/auth")
                .json()
                .send({
                    device_id: device_id
                })
                .expectStatus(200)
                .end(function (err, raw, res) {
                    expect(res).to.have.property("result").that.is.true;
                    expect(res).to.not.have.property("error");
                    expect(res).to.have.property("token");
                    apiToken = res.token;
                    expect(res).to.have.property("device_id").that.equals(device_id);
                    done.apply(null, arguments);
                });
        });
    });

    // create social user
    describe("social login", function () {
        it("should return result true", function (done) {
            hippie(spec)
                .header("Authorization", "Bearer " + apiToken)
                .base(baseUrl)
                .post("/social/login")
                .json()
                .send({
                    type: "google",
                    token: googleToken
                })
                .expectStatus(200)
                .end(function (err, raw, res) {
                    expect(res).to.have.property("result").that.is.true;
                    expect(res).to.not.have.property("error");
                    done.apply(null, arguments);
                });
        });
    });

    // logout
    describe("logout", function () {
        it("should return true", function (done) {
            hippie(spec)
                .header("Authorization", "Bearer " + apiToken)
                .base(baseUrl)
                .post("/logout")
                .json()
                .expectStatus(200)
                .end(function (err, raw, res) {
                    expect(res).to.have.property("result").that.is.true;
                    expect(res).to.not.have.property("error");
                    expect(res).to.have.property("token");
                    apiToken = res.token;
                    done.apply(null, arguments);
                });
        });
    });

    // init otp user
    describe("get otp code", function () {
        it("should return result true", function (done) {
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
    });

    describe("otp login", function () {
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
                    code: otpCode
                })
                .expectStatus(200)
                .end(function (err, raw, res) {
                    expect(res).to.have.property("result").that.is.true;
                    expect(res).to.not.have.property("error");
                    done.apply(null, arguments);
                });
        });
    });

    // logout
    describe("logout", function () {
        it("should return true", function (done) {
            hippie(spec)
                .header("Authorization", "Bearer " + apiToken)
                .base(baseUrl)
                .post("/logout")
                .json()
                .expectStatus(200)
                .end(function (err, raw, res) {
                    expect(res).to.have.property("result").that.is.true;
                    expect(res).to.not.have.property("error");
                    expect(res).to.have.property("token");
                    apiToken = res.token;
                    done.apply(null, arguments);
                });
        });
    });

    // create email user
    describe("register", function () {
        it("should return uid", function (done) {
            hippie(spec)
                .header("Authorization", "Bearer " + apiToken)
                .base(baseUrl)
                .post("/register")
                .json()
                .send({
                    type: "email",
                    email: email,
                    password: userPassword,
                    name: "Test1"
                })
                .expectStatus(200)
                .end(function (err, raw, res) {
                    expect(res).to.have.property("result").that.is.true;
                    expect(res).to.not.have.property("error");
                    expect(res).to.have.property("uid");
                    done.apply(null, arguments);
                });
        });
    });

    // confirm email
    describe("profile", function () {
        it("should return result true", function (done) {
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
                    expect(res.user.auths.email).to.have.property("confirmed").that.is.false;
                    code = res.user.auths.email.confirmCode;
                    done.apply(null, arguments);
                });
        });
    });

    describe("confirm", function () {
        it("should return result true", function (done) {
            hippie(spec)
                .header("Authorization", "Bearer " + apiToken)
                .base(baseUrl)
                .post("/confirm")
                .json()
                .send({
                    type: "email",
                    uid: email,
                    code: code
                })
                .expectStatus(200)
                .end(function (err, raw, res) {
                    expect(res).to.have.property("result").that.is.true;
                    expect(res).to.not.have.property("error");
                    done.apply(null, arguments);
                });
        });
    });

    // link social (expect merge warning)
    describe("social login", function () {
        it("should return result false", function (done) {
            hippie(spec)
                .header("Authorization", "Bearer " + apiToken)
                .base(baseUrl)
                .post("/social/login")
                .json()
                .send({
                    type: "google",
                    token: googleToken
                })
                .expectStatus(409)
                .end(function (err, raw, res) {
                    expect(res).to.have.property("result").that.is.false;
                    expect(res).to.have.property("error");
                    done.apply(null, arguments);
                });
        });
    });

    // link soical with confirm (expect ok)
    describe("social login", function () {
        it("should return result true", function (done) {
            hippie(spec)
                .header("Authorization", "Bearer " + apiToken)
                .base(baseUrl)
                .post("/social/login")
                .json()
                .send({
                    type: "google",
                    token: googleToken,
                    merge: true,
                })
                .expectStatus(200)
                .end(function (err, raw, res) {
                    expect(res).to.have.property("result").that.is.true;
                    expect(res).to.not.have.property("error");
                    done.apply(null, arguments);
                });
        });
    });

    // init link otp user (expect ok)
    describe("get otp code", function () {
        it("should return result true", function (done) {
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
    });

    describe("otp login", function () {
        it("should return result false", function (done) {
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
                    code: otpCode
                })
                .expectStatus(409)
                .end(function (err, raw, res) {
                    expect(res).to.have.property("result").that.is.false;
                    expect(res).to.have.property("error");
                    done.apply(null, arguments);
                });
        });
    });

    // link otp user with confirm (expect ok)
    describe("otp login", function () {
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
                    code: otpCode,
                    merge: true
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