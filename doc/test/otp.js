"use strict"

var SwaggerParser = require("swagger-parser");
var parser = new SwaggerParser();
var hippie = require("hippie-swagger");
var expect = require("chai").expect;
var chai = require("chai");
var chaihttp = require("chai-http")
let should = chai.should();
var spec;

chai.use(chaihttp);

var env = process.env.ENV || "local";

// dev-staging
var baseUrl;
var specFile;

switch (env) {
  case "local":
    // dev
    baseUrl = "http://localhost:8080";
    specFile = process.env.GOPATH + "/src/github.com/rosberry/rauther/doc/swagger.yaml";
    break;
  default:
    console.error("Unknown environment " + env + "!");
    return;
}
console.log("Selected environment: " + env);

var email = "test"+(Math.floor(Math.random()*99999))+"@rosberry.com";
var phone = "+7" + (Math.floor(Math.random()*999999999));
var userPassword = "password1";
var userPassword2 = "password2";

var device_id = "test"+(Math.floor(Math.random()*99999));
var apiToken = "";
var uid = "";
var code = "123321";
var recoveryCode = "";

describe("otp auth:", function () {
  this.timeout(10000); // very large swagger files may take a few seconds to parse
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

  describe("otp register", function () {
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

      it("should return error invalid confirmation time", function (done) {
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
          .expectStatus(400)
          .end(function (err, raw, res) {
            expect(res).to.have.property("result").that.is.false;
            expect(res).to.have.property("error");
            expect(res.error).to.have.property("code").that.equals("invalid_confirmation_time");
            expect(res).to.have.property("info");
            expect(res.info).to.have.property("validInterval");
            expect(res.info).to.have.property("validTime");
            done.apply(null, arguments);
          });
      });
    });
    describe("profile", function () {
      it("should return guest user", function (done) {
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
            expect(res.user).to.have.property("guest").that.is.true;
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
            phone: phone,
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

    describe("profile", function () {
      it("should return not guest user", function (done) {
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
            expect(res.user.auths).to.have.property("telegram").that.is.an("object");
            expect(res.user.auths.telegram).to.have.property("confirmed").that.is.true;
            done.apply(null, arguments);
          });
      });
    });

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
            done.apply(null, arguments);
          });
      });
    });
  }); // otp register

  describe("otp login", function () {
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

    describe("otp login", function () {
      it("should return error user not found", function (done) {
        hippie(spec)
          .header("Authorization", "Bearer " + apiToken)
          .base(baseUrl)
          .post("/otp/{key}/auth")
          .pathParams({
            key: "telegram"
          })
          .json()
          .send({
            phone: "invalid phone",
            code: code
          })
          .expectStatus(400)
          .end(function (err, raw, res) {
            expect(res).to.have.property("result").that.is.false;
            expect(res).to.have.property("error");
            expect(res.error).to.have.property("code").that.equals("user_not_found");
            done.apply(null, arguments);
          });
      });

      it("should return error code expired", function (done) {
        hippie(spec)
          .header("Authorization", "Bearer " + apiToken)
          .base(baseUrl)
          .post("/otp/{key}/auth")
          .pathParams({
            key: "telegram"
          })
          .json()
          .send({
            phone: phone,
            code: code
          })
          .expectStatus(400)
          .end(function (err, raw, res) {
            expect(res).to.have.property("result").that.is.false;
            expect(res).to.have.property("error");
            expect(res.error).to.have.property("code").that.equals("code_expired");
            done.apply(null, arguments);
          });
      });
    });

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

      it("should return error invalid confirmation time", function (done) {
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
          .expectStatus(400)
          .end(function (err, raw, res) {
            expect(res).to.have.property("result").that.is.false;
            expect(res).to.have.property("error");
            expect(res.error).to.have.property("code").that.equals("invalid_confirmation_time");
            expect(res).to.have.property("info");
            expect(res.info).to.have.property("validInterval");
            expect(res.info).to.have.property("validTime");
            done.apply(null, arguments);
          });
      });
    });

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

    describe("get otp code", function () {
      it("should return error invalid confirmation time", function (done) {
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
          .expectStatus(400)
          .end(function (err, raw, res) {
            expect(res).to.have.property("result").that.is.false;
            expect(res).to.have.property("error");
            expect(res.error).to.have.property("code").that.equals("invalid_confirmation_time");
            expect(res).to.have.property("info");
            expect(res.info).to.have.property("validInterval");
            expect(res.info).to.have.property("validTime");
            done.apply(null, arguments);
          });
      });

      it("should return result true", function (done) {
        this.timeout(20000);
        setTimeout(function() {
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
        }, 16000);
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
            phone: phone,
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

    describe("profile", function () {
      it("should return not guest user", function (done) {
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
            expect(res.user.auths).to.have.property("telegram").that.is.an("object");
            expect(res.user.auths.telegram).to.have.property("confirmed").that.is.true;
            done.apply(null, arguments);
          });
      });
    });
  }); // otp login
}); // testing
