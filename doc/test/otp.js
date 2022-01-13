"use strict"

var SwaggerParser = require("swagger-parser");
var parser = new SwaggerParser();
var hippie = require("hippie-swagger");
var expect = require("chai").expect;
var chai = require("chai");
var chaihttp = require("chai-http")
var spec;

var config = require("./config.js");
if (!config.testEnv) {
  return
}

chai.use(chaihttp);

var baseUrl = config.baseUrl;
var specFile = config.specFile;
var sentCodeTimeout = config.sentCodeTimeout;

var phone = "+7" + (Math.floor(Math.random() * 999999999));
var phone2 = "+7" + (Math.floor(Math.random() * 999999999));
var userName = "Name 1";
var userName2 = "Name 2";

var device_id = "test" + (Math.floor(Math.random() * 99999));
var apiToken = "";
var code = "123321";

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
      it("should return error auth failed", function (done) {
        hippie(spec)
          .header("Authorization", "Bearer invalid_api_token")
          .base(baseUrl)
          .post("/otp/{key}/code")
          .pathParams({
            key: "telegram"
          })
          .json()
          .send({
            phone: phone
          })
          .expectStatus(401)
          .end(function (err, raw, res) {
            expect(res).to.have.property("result").that.is.false;
            expect(res).to.have.property("error");
            expect(res.error).to.have.property("code").that.equals("auth_failed");
            done.apply(null, arguments);
          });
      });

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

      it("should return error too many code requests", function (done) {
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
          .expectStatus(429)
          .end(function (err, raw, res) {
            expect(res).to.have.property("result").that.is.false;
            expect(res).to.have.property("error");
            expect(res.error).to.have.property("code").that.equals("code_timeout");
            expect(res).to.have.property("info");
            expect(res.info).to.have.property("timeoutSec");
            expect(res.info).to.have.property("nextRequestTime");
            done.apply(null, arguments);
          });
      });
    });

    describe("get otp code with sms", function () {
      it("should return result true", function (done) {
        hippie(spec)
          .header("Authorization", "Bearer " + apiToken)
          .base(baseUrl)
          .post("/otp/{key}/code")
          .pathParams({
            key: "sms"
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

      it("should return error too many code requests", function (done) {
        hippie(spec)
          .header("Authorization", "Bearer " + apiToken)
          .base(baseUrl)
          .post("/otp/{key}/code")
          .pathParams({
            key: "sms"
          })
          .json()
          .send({
            phone: phone
          })
          .expectStatus(429)
          .end(function (err, raw, res) {
            expect(res).to.have.property("result").that.is.false;
            expect(res).to.have.property("error");
            expect(res.error).to.have.property("code").that.equals("code_timeout");
            expect(res).to.have.property("info");
            expect(res.info).to.have.property("timeoutSec");
            expect(res.info).to.have.property("nextRequestTime");
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
      it("should return error auth failed", function (done) {
        hippie(spec)
          .header("Authorization", "Bearer invalid_api_token")
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
          .expectStatus(401)
          .end(function (err, raw, res) {
            expect(res).to.have.property("result").that.is.false;
            expect(res).to.have.property("error");
            expect(res.error).to.have.property("code").that.equals("auth_failed");
            done.apply(null, arguments);
          });
      });

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
            expect(res.user).to.have.property("username").that.equals(userName);
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

      it("should return error too many code requests", function (done) {
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
          .expectStatus(429)
          .end(function (err, raw, res) {
            expect(res).to.have.property("result").that.is.false;
            expect(res).to.have.property("error");
            expect(res.error).to.have.property("code").that.equals("code_timeout");
            expect(res).to.have.property("info");
            expect(res.info).to.have.property("timeoutSec");
            expect(res.info).to.have.property("nextRequestTime");
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
      it("should return error too many code requests", function (done) {
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
          .expectStatus(429)
          .end(function (err, raw, res) {
            expect(res).to.have.property("result").that.is.false;
            expect(res).to.have.property("error");
            expect(res.error).to.have.property("code").that.equals("code_timeout");
            expect(res).to.have.property("info");
            expect(res.info).to.have.property("timeoutSec");
            expect(res.info).to.have.property("nextRequestTime");
            done.apply(null, arguments);
          });
      });

      it("should return result true", function (done) {
        this.timeout(sentCodeTimeout + 1000);
        setTimeout(function () {
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
        }, sentCodeTimeout);
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
            name: userName2,
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
            expect(res.user).to.have.property("username").that.equals(userName2);
            expect(res.user).to.have.property("auths").that.is.an("object");
            expect(res.user.auths).to.have.property("telegram").that.is.an("object");
            expect(res.user.auths.telegram).to.have.property("confirmed").that.is.true;
            done.apply(null, arguments);
          });
      });
    });
  }); // otp login

  describe("otp user flow", function () {
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

    describe("update profile", function () {
      it("should return guest user with username", function (done) {
        hippie(spec)
          .header("Authorization", "Bearer " + apiToken)
          .base(baseUrl)
          .post("/profile")
          .json()
          .send({
            username: userName
          })
          .expectStatus(200)
          .end(function (err, raw, res) {
            expect(res).to.have.property("result").that.is.true;
            expect(res).to.not.have.property("error");
            expect(res).to.have.property("user").that.is.an("object");
            expect(res.user).to.have.property("guest").that.is.true;
            expect(res.user).to.have.property("username").that.equals(userName);
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
            phone: phone2
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
            phone: phone2,
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
      it("should return not guest user with username", function (done) {
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
            expect(res.user).to.have.property("username").that.equals(userName);
            expect(res.user).to.have.property("auths").that.is.an("object");
            expect(res.user.auths).to.have.property("telegram").that.is.an("object");
            expect(res.user.auths.telegram).to.have.property("confirmed").that.is.true;
            expect(res.user).to.have.property("username").that.equals(userName);
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

    describe("update profile", function () {
      it("should return guest user with username", function (done) {
        hippie(spec)
          .header("Authorization", "Bearer " + apiToken)
          .base(baseUrl)
          .post("/profile")
          .json()
          .send({
            username: userName2
          })
          .expectStatus(200)
          .end(function (err, raw, res) {
            expect(res).to.have.property("result").that.is.true;
            expect(res).to.not.have.property("error");
            expect(res).to.have.property("user").that.is.an("object");
            expect(res.user).to.have.property("guest").that.is.true;
            expect(res.user).to.have.property("username").that.equals(userName2);
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
            phone: phone2
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
            phone: phone2,
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
      it("should return not guest user with username", function (done) {
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
            expect(res.user).to.have.property("username").that.equals(userName);
            expect(res.user).to.have.property("auths").that.is.an("object");
            expect(res.user.auths).to.have.property("telegram").that.is.an("object");
            expect(res.user.auths.telegram).to.have.property("confirmed").that.is.true;
            expect(res.user).to.have.property("username").that.equals(userName);
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
  }); // otp user flow
}); // testing
