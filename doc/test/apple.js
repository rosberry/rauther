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

var appleToken = process.env.APPLE_TOKEN || "";
if (appleToken == "") {
  console.log('ATTENTION! No APPLE_TOKEN provided, so apple login tests are skipped.');
}

var device_id = "test"+(Math.floor(Math.random()*99999));
var apiToken = "";

describe("apple auth:", function () {
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

  if (appleToken != "") {
    describe("apple register", function () {
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

      describe("social login", function () {
        it("should return result true", function (done) {
          hippie(spec)
            .header("Authorization", "Bearer " + apiToken)
            .base(baseUrl)
            .post("/social/login")
            .json()
            .send({
              type: "apple",
              name: "User1",
              token: appleToken
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
              expect(res.user).to.have.property("guest").that.is.false;
              expect(res.user).to.have.property("username").that.equals("User1");
              expect(res.user).to.have.property("auths").that.is.an("object");
              expect(res.user.auths).to.have.property("apple").that.is.an("object");
              expect(res.user.auths.apple).to.have.property("confirmed").that.is.true;
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
    }); // social register

    describe("apple login", function () {
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

      describe("social login", function () {
        it("should return result true", function (done) {
          hippie(spec)
            .header("Authorization", "Bearer " + apiToken)
            .base(baseUrl)
            .post("/social/login")
            .json()
            .send({
              type: "apple",
              token: appleToken
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
            .post("/social/login")
            .json()
            .send({
              type: "apple",
              token: appleToken
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
              expect(res.user).to.have.property("username").that.equals("User1");
              expect(res.user).to.have.property("auths").that.is.an("object");
              expect(res.user.auths).to.have.property("apple").that.is.an("object");
              expect(res.user.auths.apple).to.have.property("confirmed").that.is.true;
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
    }); // apple login
  } // if appleToken
}); // testing
