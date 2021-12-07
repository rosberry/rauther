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

var email = "test"+(Math.floor(Math.random()*99999))+"@rosberry.com";
var userPassword = "password1";
var userPassword2 = "password2";

var device_id = "test"+(Math.floor(Math.random()*99999));
var apiToken = "";
var uid = "";
var code = "";
var recoveryCode = "";

describe("email auth:", function () {
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

  describe("email auth", function () {
    describe("profile", function () {
      it("should return error not auth", function (done) {
        hippie(spec)
          .base(baseUrl)
          .get("/profile")
          .json()
          .expectStatus(401)
          .end(function (err, raw, res) {
            expect(res).to.have.property("result").that.is.false;
            expect(res).to.have.property("error");
            expect(res.error).to.have.property("code").that.equals("not_auth");
            done.apply(null, arguments);
          });
      });

      it("should return error auth failed", function (done) {
        hippie(spec)
          .header("Authorization", "Bearer invalid_api_token")
          .base(baseUrl)
          .get("/profile")
          .json()
          .expectStatus(401)
          .end(function (err, raw, res) {
            expect(res).to.have.property("result").that.is.false;
            expect(res).to.have.property("error");
            expect(res.error).to.have.property("code").that.equals("auth_failed");
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
            expect(res.user).to.have.property("guest").that.is.true;
            done.apply(null, arguments);
          });
      });
    });

    describe("register check", function () {
      it("should return result true", function (done) {
        hippie(spec)
          .header("Authorization", "Bearer " + apiToken)
          .base(baseUrl)
          .post("/register/check")
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
            done.apply(null, arguments);
          });
      });
    });

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
            uid = res.uid;
            done.apply(null, arguments);
          });
      });

      it("should return error already authorized", function (done) {
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
          .expectStatus(400)
          .end(function (err, raw, res) {
            expect(res).to.have.property("result").that.is.false;
            expect(res).to.have.property("error");
            expect(res.error).to.have.property("code").that.equals("already_auth");
            expect(res).to.not.have.property("uid");
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

    describe("profile", function () {
      it("should return error auth failed", function (done) {
        hippie(spec)
          .header("Authorization", "Bearer " + apiToken)
          .base(baseUrl)
          .get("/profile")
          .json()
          .expectStatus(401)
          .end(function (err, raw, res) {
            expect(res).to.have.property("result").that.is.false;
            expect(res).to.have.property("error");
            expect(res.error).to.have.property("code").that.equals("auth_failed");
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


    describe("register", function () {
      it("should return error user exists", function (done) {
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
          .expectStatus(400)
          .end(function (err, raw, res) {
            expect(res).to.have.property("result").that.is.false;
            expect(res).to.have.property("error");
            expect(res.error).to.have.property("code").that.equals("user_exist");
            expect(res).to.not.have.property("uid");
            done.apply(null, arguments);
          });
      });
    });

    describe("login", function () {
      it("should return result true", function (done) {
        hippie(spec)
          .header("Authorization", "Bearer " + apiToken)
          .base(baseUrl)
          .post("/login")
          .json()
          .send({
            type: "email",
            email: email,
            password: userPassword
          })
          .expectStatus(200)
          .end(function (err, raw, res) {
            expect(res).to.have.property("result").that.is.true;
            expect(res).to.not.have.property("error");
            done.apply(null, arguments);
          });
      });

      it("should return error already authorized", function (done) {
        hippie(spec)
          .header("Authorization", "Bearer " + apiToken)
          .base(baseUrl)
          .post("/login")
          .json()
          .send({
            type: "email",
            email: email,
            password: userPassword,
            name: "Test1"
          })
          .expectStatus(400)
          .end(function (err, raw, res) {
            expect(res).to.have.property("result").that.is.false;
            expect(res).to.have.property("error");
            expect(res.error).to.have.property("code").that.equals("already_auth");
            done.apply(null, arguments);
          });
      });
    });

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

    describe("confirm resend", function () {
      it("should return error invalid confirmation time", function (done) {
        hippie(spec)
          .header("Authorization", "Bearer " + apiToken)
          .base(baseUrl)
          .post("/confirm/resend")
          .json()
          .send({
            type: "email",
            uid: email
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
          .post("/confirm/resend")
          .json()
          .send({
            type: "email",
            uid: email
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

    describe("profile", function () {
      it("should return result true and new code", function (done) {
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
            expect(res.user).to.have.property("auths").that.is.an("object");
            expect(res.user.auths).to.have.property("email").that.is.an("object");
            expect(res.user.auths.email).to.have.property("confirmed").that.is.false;
            expect(res.user.auths.email).to.have.property("confirmCode").that.is.not.equal(code);
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
            expect(res.user).to.have.property("auths").that.is.an("object");
            expect(res.user.auths).to.have.property("email").that.is.an("object");
            expect(res.user.auths.email).to.have.property("confirmed").that.is.true;
            done.apply(null, arguments);
          });
      });
    });

    describe("recovery request", function () {
      it("should return result true", function (done) {
        hippie(spec)
          .header("Authorization", "Bearer " + apiToken)
          .base(baseUrl)
          .post("/recovery/request")
          .json()
          .send({
            type: "email",
            uid: email
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
      it("should return result true with recovery code", function (done) {
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
            expect(res.user).to.have.property("recoveryCode");
            recoveryCode = res.user.recoveryCode;
            done.apply(null, arguments);
          });
      });
    });

    describe("recovery request", function () {
      it("should return error invalid confirmation time", function (done) {
        hippie(spec)
          .header("Authorization", "Bearer " + apiToken)
          .base(baseUrl)
          .post("/recovery/request")
          .json()
          .send({
            type: "email",
            uid: email
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
            .post("/recovery/request")
            .json()
            .send({
              type: "email",
              uid: email
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

    describe("profile", function () {
      it("should return result true with recovery code", function (done) {
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
            expect(res.user).to.have.property("recoveryCode").that.is.not.equal(recoveryCode);
            recoveryCode = res.user.recoveryCode;
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

    describe("recovery validate", function () {
      it("should return true", function (done) {
        hippie(spec)
          .header("Authorization", "Bearer " + apiToken)
          .base(baseUrl)
          .post("/recovery/validate")
          .json()
            .send({
              type: "email",
              uid: email,
              code: recoveryCode
            })
          .expectStatus(200)
          .end(function (err, raw, res) {
            expect(res).to.have.property("result").that.is.true;
            expect(res).to.not.have.property("error");
            done.apply(null, arguments);
          });
      });
    });

    describe("recovery reset", function () {
      it("should return true", function (done) {
        hippie(spec)
          .header("Authorization", "Bearer " + apiToken)
          .base(baseUrl)
          .post("/recovery")
          .json()
            .send({
              type: "email",
              uid: email,
              code: recoveryCode,
              password: userPassword2
            })
          .expectStatus(200)
          .end(function (err, raw, res) {
            expect(res).to.have.property("result").that.is.true;
            expect(res).to.not.have.property("error");
            done.apply(null, arguments);
          });
      });
    });

    describe("login", function () {
      it("should return error user not found", function (done) {
        hippie(spec)
          .header("Authorization", "Bearer " + apiToken)
          .base(baseUrl)
          .post("/login")
          .json()
          .send({
            type: "email",
            email: "invalid.email@rosberry.com",
            password: userPassword,
            name: "Test1"
          })
          .expectStatus(400)
          .end(function (err, raw, res) {
            expect(res).to.have.property("result").that.is.false;
            expect(res).to.have.property("error");
            expect(res.error).to.have.property("code").that.equals("user_not_found");
            done.apply(null, arguments);
          });
      });

      it("should return error incorrect password", function (done) {
        hippie(spec)
          .header("Authorization", "Bearer " + apiToken)
          .base(baseUrl)
          .post("/login")
          .json()
          .send({
            type: "email",
            email: email,
            password: userPassword,
            name: "Test1"
          })
          .expectStatus(403)
          .end(function (err, raw, res) {
            expect(res).to.have.property("result").that.is.false;
            expect(res).to.have.property("error");
            expect(res.error).to.have.property("code").that.equals("incorrect_password");
            done.apply(null, arguments);
          });
      });

      it("should return result true", function (done) {
        hippie(spec)
          .header("Authorization", "Bearer " + apiToken)
          .base(baseUrl)
          .post("/login")
          .json()
          .send({
            type: "email",
            email: email,
            password: userPassword2
          })
          .expectStatus(200)
          .end(function (err, raw, res) {
            expect(res).to.have.property("result").that.is.true;
            expect(res).to.not.have.property("error");
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
  }); // email auth
}); // testing
