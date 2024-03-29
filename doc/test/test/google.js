"use strict"

var SwaggerParser = require("swagger-parser");
var parser = new SwaggerParser();
var hippie = require("hippie-swagger");
var expect = require("chai").expect;
var chai = require("chai");
var chaihttp = require("chai-http")
var spec;

var config = require("../config.js");
chai.use(chaihttp);

var baseUrl = config.baseUrl;
var specFile = config.specFile;

var googleToken = process.env.GOOGLE_TOKEN || "";
if (googleToken == "") {
  console.log('ATTENTION! No GOOGLE_TOKEN provided, so google login tests are skipped.');
}

var device_id = "test" + (Math.floor(Math.random() * 99999));
var apiToken = "";

describe("google auth:", function () {
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

  if (googleToken != "") {
    describe("google register", function () {
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
              expect(res.user.auths).to.have.property("google").that.is.an("object");
              expect(res.user.auths.google).to.have.property("confirmed").that.is.true;
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
    }); // google register

    describe("google login", function () {
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
              expect(res.user.auths).to.have.property("google").that.is.an("object");
              expect(res.user.auths.google).to.have.property("confirmed").that.is.true;
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
              expect(res).to.have.property("token");
              done.apply(null, arguments);
            });
        });
      });

      describe("remove all users and sessions", function () {
        it("should return result true", function (done) {
          hippie(spec)
            .header("Authorization", "Bearer " + apiToken)
            .base(baseUrl)
            .url("/clearAll")
            .method("DELETE")
            .json()
            .expectStatus(200)
            .end(function (err, raw, res) {
              expect(res).to.have.property("result").that.is.true
              expect(res).to.not.have.property("error")
              done.apply(null, arguments)
            })
        })
      })
    }); // google login
  } // if googleToken
}); // testing
