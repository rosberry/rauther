"use strict"

var SwaggerParser = require("swagger-parser")
var parser = new SwaggerParser()
var hippie = require("hippie-swagger")
var expect = require("chai").expect
var chai = require("chai")
var chaihttp = require("chai-http")
let should = chai.should()
var spec

var config = require("./config.js")

chai.use(chaihttp)

var baseUrl = config.baseUrl
var specFile = config.specFile

var googleToken = process.env.GOOGLE_TOKEN || ""
var googleToken2 = process.env.GOOGLE_TOKEN2 || ""
if (googleToken == "") {
  console.log('ATTENTION! No GOOGLE_TOKEN provided, so google login tests are skipped.')
}
if (googleToken2 == "") {
  console.log('ATTENTION! No GOOGLE_TOKEN2 provided, so google login negative tests are skipped.')
}

var email = "test" + (Math.floor(Math.random() * 99999)) + "@rosberry.com"
var email2 = "test2" + (Math.floor(Math.random() * 99999)) + "@rosberry.com"
var phone = "+7" + (Math.floor(Math.random() * 999999999))
var phone2 = "8" + (Math.floor(Math.random() * 999999999))
var confirmEmailCode = "456123";
var confirmOTPCode = "123321";

var apiToken = ""

const emailRegCreds = {
  type: "email",
  name: "Test1",
  email: email,
  password: "password",
}
const emailRegCreds2 = {
  type: "email",
  name: "Test2",
  email: email2,
  password: "password2",
}

const googleRegCreds = {
  type: "google",
  token: googleToken
}
const googleRegCreds2 = {
  type: "google",
  token: googleToken2
}

const otpRegCreds = {
  phone: phone
}
const otpRegCreds2 = {
  phone: phone2
}

const otpLoginCreds = {
  phone: phone,
  code: confirmOTPCode
}

const passwordConfirmCreds = {
  type: "email",
  uid: email,
  code: confirmEmailCode
}

describe("link account:", function () {
  this.timeout(10000); // very large swagger files may take a few seconds to parse
  this.slow(200);

  before(function (done) {
    // if using mocha, dereferencing can be performed prior during initialization via the delay flag:
    // https://mochajs.org/#delayed-root-suite
    parser.dereference(specFile, function (err, api) {
      if (err) {
        return done(err)
      }
      spec = api
      done();
    });
  });

  describe("password positive scenario", function () {
    auth()
    passwordRegister()
    passwordConfirm()
    // adding auth identities
    if (googleToken !== "") {
      socialLogin()
    }
    otpGetCode()
    otpLogin()
    profile(["email", "google", "telegram"])
    logout()
    // check enter auth identities
    if (googleToken !== "") {
      socialLogin()
      logout()
    }
    otpGetCode()
    otpLogin()
    remove()
  });

  if (googleToken !== "") {
    describe("social positive scenario", function () {
      auth()
      socialLogin()
      // adding auth identities
      passwordRegister()
      passwordConfirm()
      otpGetCode()
      otpLogin()
      profile(["email", "google", "telegram"])
      logout()
      // check enter auth identities
      passwordLogin()
      logout()
      otpGetCode()
      otpLogin()
      remove()
    });
  }

  describe("otp positive scenario", function () {
    auth()
    otpGetCode()
    otpLogin()
    // adding auth identities
    passwordRegister()
    passwordConfirm()
    if (googleToken !== "") {
      socialLogin()
    }
    profile(["email", "google", "telegram"])
    logout()
    // check enter auth identities
    passwordLogin()
    if (googleToken !== "") {
      logout()
      socialLogin()
    }
    remove()
  });

  describe("password negative scenario", function () {
    auth()
    passwordRegister()
    passwordConfirm()

    describe("duplicate password register", function () {
      it("should return error auth identity exists", function (done) {
        request("/register", "post", emailRegCreds2, function (err, raw, res) {
          expect(res).to.have.property("result").that.is.false;
          expect(res).to.have.property("error");
          expect(res.error).to.have.property("code").that.equals("auth_identity_already_exists");
          expect(res).to.not.have.property("uid");
          done.apply(null, arguments);
        }, { status: 400 });
      });
    });
    remove()
  });

  if (googleToken2 !== "") {
    describe("social negative scenario", function () {
      auth()
      socialLogin()
      describe("duplicate social register", function () {
        it("should return error auth identity exists", function (done) {
          request("/social/login", "post", googleRegCreds2, function (err, raw, res) {
            expect(res).to.have.property("result").that.is.false;
            expect(res).to.have.property("error");
            expect(res.error).to.have.property("code").that.equals("auth_identity_already_exists");
            done.apply(null, arguments);
          }, { status: 400 });
        });
      });
      remove()
    });
  }

  describe("otp negative scenario", function () {
    auth()
    otpGetCode()
    otpLogin()
    describe("duplicate otp register", function () {
      it("should return error auth identity exists", function (done) {
        request("/otp/{key}/code", "post", otpRegCreds2, function (err, raw, res) {
          expect(res).to.have.property("result").that.is.false;
          expect(res).to.have.property("error");
          expect(res.error).to.have.property("code").that.equals("auth_identity_already_exists");
          done.apply(null, arguments);

        }, { status: 400, pathParams: { key: "telegram" } })
      })
    });
    remove()
  });
});

function request(url, type, data, callback, paramsCfg) {
  const params = {
    token: true,
    status: 200,
    pathParams: {},
  }

  if (typeof paramsCfg !== "undefined") {
    Object.assign(params, paramsCfg)
  }

  let h = hippie(spec)

  if (params.token) {
    h = h.header("Authorization", "Bearer " + apiToken)
  }

  h = h.base(baseUrl)
    .url(url)
    .method(type.toUpperCase())
    .pathParams(params.pathParams)
    .json()
    .expectStatus(params.status)

  if (data !== null) {
    h = h.send(data)
  }

  h.end(function (err, raw, res) {
    if (typeof err !== "undefined") {
      console.log(res);
      console.log(apiToken);
      console.log(err)
    }
    // console.log(res)
    callback(err, raw, res)
  })
};

function auth() {
  describe("auth", function () {
    it("should return token and device_id", function (done) {
      const device_id = "test" + (Math.floor(Math.random() * 99999))
      const data = {
        device_id: device_id
      }
      request("/auth", "post", data, function (err, raw, res) {
        expect(res).to.have.property("result").that.is.true
        expect(res).to.not.have.property("error")
        expect(res).to.have.property("token")
        expect(res).to.have.property("device_id").that.equals(device_id)
        apiToken = res.token;
        done.apply(null, arguments);
      }, { token: false })
    });
  });
}

function passwordRegister() {
  describe("password register", function () {
    it("should return uid", function (done) {
      request("/register", "post", emailRegCreds, function (err, raw, res) {
        expect(res).to.have.property("result").that.is.true
        expect(res).to.not.have.property("error")
        expect(res).to.have.property("uid")
        done.apply(null, arguments);
      });
    });
  });
}

function passwordConfirm() {
  describe("password confirm", function () {
    it("should return result true", function (done) {
      request("/confirm", "post", passwordConfirmCreds, function (err, raw, res) {
        expect(res).to.have.property("result").that.is.true;
        expect(res).to.not.have.property("error");
        done.apply(null, arguments);
      });
    });
  });
}

function passwordLogin() {
  describe("password login", function () {
    it("should return uid", function (done) {
      request("/login", "post", emailRegCreds, function (err, raw, res) {
        expect(res).to.have.property("result").that.is.true
        expect(res).to.not.have.property("error")
        done.apply(null, arguments);
      });
    });
  });
}

function profile(scope) {
  describe("profile", function () {
    const scopeStr = scope.join(", ")
    it(`should return ${scopeStr} adding auth identities`, function (done) {
      request("/profile", "get", null, function (err, raw, res) {
        expect(res).to.have.property("result").that.is.true
        expect(res).to.not.have.property("error")

        expect(res).to.have.property("user").that.is.an("object")
        expect(res.user).to.have.property("guest").that.is.false
        expect(res.user).to.have.property("auths").that.is.an("object")

        if (scope.indexOf("email") !== -1) {
          expect(res.user.auths).to.have.property("email").that.is.an("object")
        }

        if (scope.indexOf("google") !== -1 && googleToken !== "") {
          expect(res.user.auths).to.have.property("google").that.is.an("object")
        }

        if (scope.indexOf("telegram") !== -1) {
          expect(res.user.auths).to.have.property("telegram").that.is.an("object")
        }

        done.apply(null, arguments);
      });
    });
  });
}

function logout() {
  describe("logout", function () {
    it("should return true", function (done) {
      request("/logout", "post", null, function (err, raw, res) {
        expect(res).to.have.property("result").that.is.true
        expect(res).to.have.property("token")
        expect(res).to.not.have.property("error")
        apiToken = res.token
        done.apply(null, arguments)
      })
    })
  })
}

function socialLogin() {
  if (googleToken !== "") {
    describe("social login", function () {
      it("should return result true", function (done) {
        request("/social/login", "post", googleRegCreds, function (err, raw, res) {
          expect(res).to.have.property("result").that.is.true
          expect(res).to.not.have.property("error")
          done.apply(null, arguments);
        });
      });
    });
  }
}

function otpGetCode() {
  describe("get otp code", function () {
    it("should return result true", function (done) {
      request("/otp/{key}/code", "post", otpRegCreds, function (err, raw, res) {
        expect(res).to.have.property("result").that.is.true
        expect(res).to.not.have.property("error")
        done.apply(null, arguments)

      }, { pathParams: { key: "telegram" } })
    })
  })
}

function otpLogin() {
  describe("otp login", function () {
    it("should return result true", function (done) {
      request("/otp/{key}/auth", "post", otpLoginCreds, function (err, raw, res) {
        expect(res).to.have.property("result").that.is.true
        expect(res).to.not.have.property("error")
        done.apply(null, arguments)

      }, { pathParams: { key: "telegram" } })
    })
  })
}

function remove() {
  describe("remove user", function () {
    it("should return result true", function (done) {
      request("/profile", "delete", null, function (err, raw, res) {
        expect(res).to.have.property("result").that.is.true
        expect(res).to.not.have.property("error")
        done.apply(null, arguments)
      })
    })
  })
}

