"use strict"

var SwaggerParser = require("swagger-parser");
var parser = new SwaggerParser();
var hippie = require("hippie-swagger");
var expect = require("chai").expect;
var chai = require("chai");
var chaihttp = require("chai-http")
let should = chai.should();
var spec;

var config = require("../config.js");

chai.use(chaihttp);

var baseUrl = config.baseUrl;
var specFile = config.specFile;

var googleToken = process.env.GOOGLE_TOKEN || "";
if (googleToken == "") {
    console.log('ATTENTION! No GOOGLE_TOKEN provided, so google login tests are skipped.');
}

var phoneForOTP = "+7" + (Math.floor(Math.random() * 999999999));
var phoneForPasswordMethod = "+7" + (Math.floor(Math.random() * 999999999));
var phoneForPasswordMethod2 = "+7" + (Math.floor(Math.random() * 999999999));
var phoneForPasswordMethod3 = "+7" + (Math.floor(Math.random() * 999999999));

var email = "test" + (Math.floor(Math.random() * 99999)) + "@rosberry.com";
var email2 = "test" + (Math.floor(Math.random() * 99999)) + "@rosberry.com";
var email3 = "test" + (Math.floor(Math.random() * 99999)) + "@rosberry.com";
var email4 = "test" + (Math.floor(Math.random() * 99999)) + "@rosberry.com";

var userPassword = "password1";

var device_id = "test" + (Math.floor(Math.random() * 99999));
var apiToken = "";

var code = "";
var otpCode = "123321";
var userName = "Petya";


const mergeConfictStatus = 409;

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

    // #1 Basic merge (otp, social)
    describe("I want check basic OTP, Social merge", function () {
        describe("Prepare merge accounts", function () {
            if (googleToken != "") {
                // create social user
                describe("init social user", function () {
                    it("login with google token", function (done) {
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

                    it("logout", function (done) {
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
            }

            // init otp user
            describe("init OTP user", function () {
                it("get code", function (done) {
                    hippie(spec)
                        .header("Authorization", "Bearer " + apiToken)
                        .base(baseUrl)
                        .post("/otp/{key}/code")
                        .pathParams({
                            key: "telegram"
                        })
                        .json()
                        .send({
                            phone: phoneForOTP
                        })
                        .expectStatus(200)
                        .end(function (err, raw, res) {
                            expect(res).to.have.property("result").that.is.true;
                            expect(res).to.not.have.property("error");
                            done.apply(null, arguments);
                        });
                });

                it("otp auth", function (done) {
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
                            phone: phoneForOTP,
                            code: otpCode
                        })
                        .expectStatus(200)
                        .end(function (err, raw, res) {
                            expect(res).to.have.property("result").that.is.true;
                            expect(res).to.not.have.property("error");
                            done.apply(null, arguments);
                        });
                });

                it("logout", function (done) {
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
        });

        // create email user
        describe("register password (email) user", function () {
            it("register", function (done) {
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

            it("get profile", function (done) {
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

            it("confirm", function (done) {
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

        // link (merge) accounts 
        if (googleToken != "") {
            // link social (expect merge warning)
            describe("merge user with social account", function () {
                context("when merge confirm not set", function () {
                    it("should return result false with merge_warning", function (done) {
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
                                expect(res.error).to.have.property("code").that.equals("merge_warning");
                                done.apply(null, arguments);
                            });
                    });
                });

                context("when merge confirm is true", function () {
                    it("should return result true", function (done) {
                        hippie(spec)
                            .header("Authorization", "Bearer " + apiToken)
                            .base(baseUrl)
                            .post("/social/login")
                            .json()
                            .send({
                                type: "google",
                                token: googleToken,
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
        }

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
                        phone: phoneForOTP
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
                            phone: phoneForOTP,
                            code: otpCode
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
                            phone: phoneForOTP,
                            code: otpCode,
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

                        if (googleToken != "") {
                            expect(res.user.auths).to.have.property("google").that.is.an("object");
                            expect(res.user.auths.google).to.have.property("confirmed").that.is.true;
                        }

                        done.apply(null, arguments);
                    });
            });
        });
    });

    // #2 Check merge warning list
    describe("I want check merge warning list", function () {
        // create second user
        describe("create password user (email)", function () {
            it("logout", function (done) {
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

            it("register should return uid", function (done) {
                hippie(spec)
                    .header("Authorization", "Bearer " + apiToken)
                    .base(baseUrl)
                    .post("/register")
                    .json()
                    .send({
                        type: "email",
                        email: email2,
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

            it("profile should have code", function (done) {
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

            it("confirm", function (done) {
                hippie(spec)
                    .header("Authorization", "Bearer " + apiToken)
                    .base(baseUrl)
                    .post("/confirm")
                    .json()
                    .send({
                        type: "email",
                        uid: email2,
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

        // merge first user with OTP
        describe("merge user with another email account by OTP", function () {
            describe("get OTP code", function () {
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
                            phone: phoneForOTP
                        })
                        .expectStatus(200)
                        .end(function (err, raw, res) {
                            expect(res).to.have.property("result").that.is.true;
                            expect(res).to.not.have.property("error");
                            done.apply(null, arguments);
                        });
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
                            phone: phoneForOTP,
                            code: otpCode
                        })
                        .expectStatus(409)
                        .end(function (err, raw, res) {
                            expect(res).to.have.property("result").that.is.false;
                            expect(res).to.have.property("error");
                            expect(res.error).to.have.property("code").that.equals("merge_warning");
                            expect(res).to.have.property("info").that.is.an("object");
                            expect(res.info).to.have.property("lost");

                            var foundEmailMergeWarning = false;

                            for (var i in res.info.lost) {
                                var authIdent = res.info.lost[i];

                                if (authIdent.type == "email") {
                                    foundEmailMergeWarning = true;
                                }
                            }

                            expect(foundEmailMergeWarning).to.be.true;

                            done.apply(null, arguments);
                        });
                });
            });

            context("when merge confirm is true", function () {
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
                            phone: phoneForOTP,
                            code: otpCode,
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

                        if (googleToken != "") {
                            expect(res.user.auths).to.have.property("google").that.is.an("object");
                            expect(res.user.auths.google).to.have.property("confirmed").that.is.true;
                        }

                        done.apply(null, arguments);
                    });
            });
        });

        describe("check remove user with warning auth identity", function () {
            it("logout", function (done) {
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

            it("login should return false", function (done) {
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
                    .expectStatus(400)
                    .end(function (err, raw, res) {
                        expect(res).to.have.property("result").that.is.false;
                        expect(res).to.have.property("error");
                        expect(res.error).to.have.property("code").that.equals("user_not_found");
                        done.apply(null, arguments);
                    });
            });
        })
    });

    // #3 Basic merge email account
    describe("I want check basic password merge", function () {
        // prepare password (email) user
        describe("prepare password (email) user", function () {
            it("register", function (done) {
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

            it("get profile", function (done) {
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

            it("confirm", function (done) {
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

        // create phone user
        describe("create phone user", function () {
            it("logout", function (done) {
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

            it("register phone user", function (done) {
                hippie(spec)
                    .header("Authorization", "Bearer " + apiToken)
                    .base(baseUrl)
                    .post("/register")
                    .json()
                    .send({
                        type: "phone",
                        phone: phoneForPasswordMethod,
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

            it("get profile with confirm code", function (done) {
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
                        expect(res.user.auths).to.have.property("phone").that.is.an("object");
                        expect(res.user.auths.phone).to.have.property("confirmed").that.is.false;
                        code = res.user.auths.phone.confirmCode;
                        done.apply(null, arguments);
                    });
            });

            it("confirm", function (done) {
                hippie(spec)
                    .header("Authorization", "Bearer " + apiToken)
                    .base(baseUrl)
                    .post("/confirm")
                    .json()
                    .send({
                        type: "phone",
                        uid: phoneForPasswordMethod,
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

        // merge email password
        describe("link email account", function () {
            it("init email link", function (done) {
                hippie(spec)
                    .header("Authorization", "Bearer " + apiToken)
                    .base(baseUrl)
                    .post("/initLink")
                    .json()
                    .send({
                        type: "email",
                        uid: email
                    })
                    .expectStatus(200)
                    .end(function (err, raw, res) {
                        expect(res).to.have.property("result").that.is.true;
                        expect(res).to.not.have.property("error");

                        expect(res).to.have.property("action").that.is.eq("merge");
                        expect(res).to.have.property("confirmCodeRequired").that.is.false;

                        done.apply(null, arguments);
                    });
            });

            describe("merge", function () {
                context("when merge intent not set", function () {
                    it("should return result false with 'user exist' error", function (done) {
                        hippie(spec)
                            .header("Authorization", "Bearer " + apiToken)
                            .base(baseUrl)
                            .post("/link")
                            .json()
                            .send({
                                type: "email",
                                uid: email,
                                password: userPassword
                            })
                            .expectStatus(400)
                            .end(function (err, raw, res) {
                                expect(res).to.have.property("result").that.is.false;
                                expect(res).to.have.property("error");
                                expect(res.error).to.have.property("code").that.equals("user_exist");
                                done.apply(null, arguments);
                            });
                    });
                });

                context("when merge intent set, but merge confirm false", function () {
                    it("should return result false with 'merge_warning' error", function (done) {
                        hippie(spec)
                            .header("Authorization", "Bearer " + apiToken)
                            .base(baseUrl)
                            .post("/link")
                            .json()
                            .send({
                                type: "email",
                                uid: email,
                                password: userPassword,
                                merge: true
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

                context("when merge confirm is true", function () {
                    it("should return result true", function (done) {
                        hippie(spec)
                            .header("Authorization", "Bearer " + apiToken)
                            .base(baseUrl)
                            .post("/link")
                            .json()
                            .send({
                                type: "email",
                                uid: email,
                                password: userPassword,
                                merge: true,
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

            // Check auth identities in profile
            describe("check auth identities", function () {
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

                            expect(res.user.auths).to.have.property("phone").that.is.an("object");
                            expect(res.user.auths.phone).to.have.property("confirmed").that.is.true;

                            expect(res.user.auths).to.have.property("email").that.is.an("object");
                            expect(res.user.auths.email).to.have.property("confirmed").that.is.true;

                            done.apply(null, arguments);
                        });
                });
            });
        });
    });

    // #4 Check merge unconfirmed email account
    describe("I want check merge unconfirmed password account", function () {
        // prepare unconfirmed phone user
        var linkConfirmCode = "";

        describe("prepare unconfirmed password user (phone)", function () {
            it("logout", function (done) {
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

            it("register", function (done) {
                hippie(spec)
                    .header("Authorization", "Bearer " + apiToken)
                    .base(baseUrl)
                    .post("/register")
                    .json()
                    .send({
                        type: "phone",
                        phone: phoneForPasswordMethod2,
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

            it("get profile with confirm code", function (done) {
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
                        expect(res.user.auths).to.have.property("phone").that.is.an("object");
                        expect(res.user.auths.phone).to.have.property("confirmed").that.is.false;
                        linkConfirmCode = res.user.auths.phone.confirmCode;
                        done.apply(null, arguments);
                    });
            });
        });

        // create email user
        describe("register password user (email)", function () {
            it("logout", function (done) {
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

            it("register", function (done) {
                hippie(spec)
                    .header("Authorization", "Bearer " + apiToken)
                    .base(baseUrl)
                    .post("/register")
                    .json()
                    .send({
                        type: "email",
                        email: email3,
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

            it("get profile with confirm code", function (done) {
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

            it("confirm", function (done) {
                hippie(spec)
                    .header("Authorization", "Bearer " + apiToken)
                    .base(baseUrl)
                    .post("/confirm")
                    .json()
                    .send({
                        type: "email",
                        uid: email3,
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

        // merge password user (phone)
        describe("merge password (phone) user", function () {
            describe("init link", function () {
                it("should return result false (code time)", function (done) {
                    hippie(spec)
                        .header("Authorization", "Bearer " + apiToken)
                        .base(baseUrl)
                        .post("/initLink")
                        .json()
                        .send({
                            type: "phone",
                            uid: phoneForPasswordMethod2
                        })
                        .expectStatus(429)
                        .end(function (err, raw, res) {
                            expect(res).to.have.property("result").that.is.false;
                            expect(res).to.have.property("error");
                            expect(res).to.have.property("action").that.is.equal("merge");
                            expect(res).to.have.property("confirmCodeRequired").that.is.true;

                            done.apply(null, arguments);
                        });
                });
            });

            describe("link", function () {
                context("when merge intent not set", function () {
                    it("should return result false with 'user exist' error", function (done) {
                        hippie(spec)
                            .header("Authorization", "Bearer " + apiToken)
                            .base(baseUrl)
                            .post("/link")
                            .json()
                            .send({
                                type: "phone",
                                uid: phoneForPasswordMethod2,
                                code: linkConfirmCode,
                                password: userPassword
                            })
                            .expectStatus(400)
                            .end(function (err, raw, res) {
                                expect(res).to.have.property("result").that.is.false;
                                expect(res).to.have.property("error");
                                expect(res.error).to.have.property("code").that.equals("user_exist");
                                done.apply(null, arguments);
                            });
                    });
                });

                context("when merge confirm not set", function () {
                    it("should return result false with merge_warning", function (done) {
                        hippie(spec)
                            .header("Authorization", "Bearer " + apiToken)
                            .base(baseUrl)
                            .post("/link")
                            .json()
                            .send({
                                type: "phone",
                                uid: phoneForPasswordMethod2,
                                code: linkConfirmCode,
                                password: userPassword,
                                merge: true
                            })
                            .expectStatus(mergeConfictStatus)
                            .end(function (err, raw, res) {
                                expect(res).to.have.property("result").that.is.false;
                                expect(res).to.have.property("error");
                                done.apply(null, arguments);
                            });
                    });
                });

                context("when merge confirm is true", function () {
                    it("should return result true", function (done) {
                        hippie(spec)
                            .header("Authorization", "Bearer " + apiToken)
                            .base(baseUrl)
                            .post("/link")
                            .json()
                            .send({
                                type: "phone",
                                uid: phoneForPasswordMethod2,
                                code: linkConfirmCode,
                                password: userPassword,
                                merge: true,
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

                            expect(res.user.auths).to.have.property("phone").that.is.an("object");
                            expect(res.user.auths.phone).to.have.property("confirmed").that.is.true;

                            expect(res.user.auths).to.have.property("email").that.is.an("object");
                            expect(res.user.auths.email).to.have.property("confirmed").that.is.true;

                            done.apply(null, arguments);
                        });
                });
            });
        });
    });

    // #5 Check link intend and confirmCodeRequired
    describe("I want check link intend and confirmCodeRequired", function () {
        // create email user
        describe("register password user (email)", function () {
            it("logout", function (done) {
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

            it("register", function (done) {
                hippie(spec)
                    .header("Authorization", "Bearer " + apiToken)
                    .base(baseUrl)
                    .post("/register")
                    .json()
                    .send({
                        type: "email",
                        email: email4,
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

            it("get profile with confirm code", function (done) {
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

            it("confirm", function (done) {
                hippie(spec)
                    .header("Authorization", "Bearer " + apiToken)
                    .base(baseUrl)
                    .post("/confirm")
                    .json()
                    .send({
                        type: "email",
                        uid: email4,
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

        // check confirmCodeRequired 
        describe("link password (phone) unconfirmed user", function () {
            describe("init link", function () {
                it("should return link action and confirmCodeRequired", function (done) {
                    hippie(spec)
                        .header("Authorization", "Bearer " + apiToken)
                        .base(baseUrl)
                        .post("/initLink")
                        .json()
                        .send({
                            type: "phone",
                            uid: phoneForPasswordMethod3
                        })
                        .expectStatus(200)
                        .end(function (err, raw, res) {
                            expect(res).to.have.property("result").that.is.true;
                            expect(res).to.not.have.property("error");

                            expect(res).to.have.property("action").that.is.eq("link");
                            expect(res).to.have.property("confirmCodeRequired").that.is.true;

                            done.apply(null, arguments);
                        });
                });
            });
        });
    });
});