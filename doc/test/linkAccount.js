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
var userID = null
var userID2 = null
var apiToken = ""
var apiToken2 = ""

const authTypes = {
  password: "email",
  social: "google",
  otp: "telegram",
}

const emailRegCreds = {
  type: authTypes.password,
  name: "Test1",
  email: email,
  password: "password",
}
const emailRegCreds2 = {
  type: authTypes.password,
  name: "Test2",
  email: email2,
  password: "password2",
}

const googleRegCreds = {
  type: authTypes.social,
  token: googleToken
}
const googleRegCreds2 = {
  type: authTypes.social,
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

const otpLoginCreds2 = {
  phone: phone2,
  code: confirmOTPCode
}

const passwordConfirmCreds = {
  type: authTypes.password,
  uid: email,
  code: confirmEmailCode
}

const errors = {
  userNotFound: "user_not_found",
  userNotConfirmed: "user_not_confirmed",
  userExist: "user_exist",
  alreadyAuth: "already_auth",
  authIdentityAlreadyExists: "auth_identity_already_exists",
  invalidCode: "invalid_code",
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
    profile(
      "profile",
      `should return result true and exists ${authTypes.password}, ${authTypes.social}, ${authTypes.otp} auth identities`,
      (res) => {
        expect(res.user.auths).to.have.property(authTypes.password).that.is.an("object")
        expect(res.user.auths).to.have.property(authTypes.otp).that.is.an("object")
        if (googleToken !== "") {
          expect(res.user.auths).to.have.property(authTypes.social).that.is.an("object")
        }
      }
    )
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
      profile(
        "profile",
        `should return result true and exists ${authTypes.password}, ${authTypes.social}, ${authTypes.otp} auth identities`,
        (res) => {
          expect(res.user.auths).to.have.property(authTypes.password).that.is.an("object")
          expect(res.user.auths).to.have.property(authTypes.otp).that.is.an("object")
          expect(res.user.auths).to.have.property(authTypes.social).that.is.an("object")
        }
      )
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
    profile(
      "profile",
      `should return result true and exists ${authTypes.password}, ${authTypes.social}, ${authTypes.otp} auth identities`,
      (res) => {
        expect(res.user.auths).to.have.property(authTypes.password).that.is.an("object")
        expect(res.user.auths).to.have.property(authTypes.otp).that.is.an("object")
        if (googleToken !== "") {
          expect(res.user.auths).to.have.property(authTypes.social).that.is.an("object")
        }
      }
    )
    logout()
    // check enter auth identities
    passwordLogin()
    if (googleToken !== "") {
      logout()
      socialLogin()
    }
    remove()
  });

  describe("password negative scenario with duplicate register auth identity", function () {
    auth()
    passwordRegister()
    passwordConfirm()

    describe("duplicate password register", function () {
      it(`should return result false and error: ${errors.authIdentityAlreadyExists}`, function (done) {
        request("/register", "post", emailRegCreds2, function (err, raw, res) {
          expect(res).to.have.property("result").that.is.false;
          expect(res).to.have.property("error");
          expect(res.error).to.have.property("code").that.equals(errors.authIdentityAlreadyExists);
          expect(res).to.not.have.property("uid");
          done.apply(null, arguments);
        }, { status: 400 });
      });
    });
    remove()
  });

  if (googleToken2 !== "") {
    describe("social negative scenario with duplicate register auth identity", function () {
      auth()
      socialLogin()
      describe("duplicate social register", function () {
        it(`should return result false and error: ${errors.authIdentityAlreadyExists}`, function (done) {
          request("/social/login", "post", googleRegCreds2, function (err, raw, res) {
            expect(res).to.have.property("result").that.is.false;
            expect(res).to.have.property("error");
            expect(res.error).to.have.property("code").that.equals(errors.authIdentityAlreadyExists);
            done.apply(null, arguments);
          }, { status: 400 });
        });
      });
      remove()
    });
  }

  describe("otp negative scenario with duplicate register auth identity", function () {
    auth()
    otpGetCode()
    otpLogin()
    describe("duplicate otp register", function () {
      it(`should return result false and error: ${errors.authIdentityAlreadyExists}`, function (done) {
        request("/otp/{key}/code", "post", otpRegCreds2, function (err, raw, res) {
          expect(res).to.have.property("result").that.is.false;
          expect(res).to.have.property("error");
          expect(res.error).to.have.property("code").that.equals(errors.authIdentityAlreadyExists);
          done.apply(null, arguments);

        }, { status: 400, pathParams: { key: authTypes.otp } })
      })
    });
    remove()
  });

  describe("password negative scenario with not confirmed base auth identity", function () {
    auth()
    passwordRegister()
    if (googleToken !== "") {
      describe("social login", function () {
        it(`should return result false and error: ${errors.userNotConfirmed}`, function (done) {
          request("/social/login", "post", googleRegCreds, function (err, raw, res) {
            expect(res).to.have.property("result").that.is.false;
            expect(res).to.have.property("error");
            expect(res.error).to.have.property("code").that.equals(errors.userNotConfirmed);
            done.apply(null, arguments);

          }, { status: 400 });
        });
      });
    }
    describe("get otp code", function () {
      it(`should return result false and error: ${errors.userNotConfirmed}`, function (done) {
        request("/otp/{key}/code", "post", otpRegCreds, function (err, raw, res) {
          expect(res).to.have.property("result").that.is.false;
          expect(res).to.have.property("error");
          expect(res.error).to.have.property("code").that.equals(errors.userNotConfirmed);
          done.apply(null, arguments)

        }, { status: 400, pathParams: { key: authTypes.otp } })
      })
    })
    describe("otp login", function () {
      it(`should return result false and error: ${errors.userNotFound}`, function (done) {
        request("/otp/{key}/auth", "post", otpLoginCreds, function (err, raw, res) {
          expect(res).to.have.property("result").that.is.false
          expect(res).to.have.property("error")
          expect(res.error).to.have.property("code").that.equals(errors.userNotFound);
          done.apply(null, arguments)

        }, { status: 400, pathParams: { key: authTypes.otp } })
      })
    })
    remove()
  });

  describe("password scenario with confirmed/not confirmed extended auth identity", function () {
    auth()
    otpGetCode()
    otpLogin()
    passwordRegister()

    profile(
      "profile",
      "should return true and password auth identity should not exists",
      (res) => {
        expect(res.user.auths).to.not.have.property(authTypes.password)
      }
    )

    logout()

    describe("password login", function () {
      it(`should return result false and error: ${errors.userNotFound}`, function (done) {
        request("/login", "post", emailRegCreds, function (err, raw, res) {
          expect(res).to.have.property("result").that.is.false
          expect(res).to.have.property("error")
          expect(res.error).to.have.property("code").that.equals(errors.userNotFound);
          done.apply(null, arguments);
        }, { status: 400 });
      });
    });

    otpGetCode()
    otpLogin()
    passwordConfirm()
    logout()
    passwordLogin()

    profile(
      "profile",
      "should return true and password auth identity should exists",
      (res) => {
        expect(res.user.auths).to.have.property(authTypes.password)
      }
    )

    remove()
  });

  describe("password negative scenario with linking account which already reserved by another user", function () {
    // user 1
    auth()
    otpGetCode()
    otpLogin()
    // user 2
    auth2()
    passwordRegister2()

    describe("link password reserved account", function () {
      it(`should return result false and error: ${errors.alreadyAuth}`, function (done) {
        request("/register", "post", emailRegCreds, function (err, raw, res) {
          expect(res).to.have.property("result").that.is.false
          expect(res).to.have.property("error")
          expect(res.error).to.have.property("code").that.equals(errors.alreadyAuth);
          done.apply(null, arguments);

        }, { status: 400 });
      });
    });
    // remove all
    remove()
  });

  describe("password negative scenario with linking account which already reserved by another user with logout", function () {
    // user 1
    auth()
    otpGetCode()
    otpLogin()
    // user 2
    auth2()
    passwordRegister2()
    logout2()

    describe("link password reserved account", function () {
      it(`should return result false and error: ${errors.alreadyAuth}`, function (done) {
        request("/register", "post", emailRegCreds, function (err, raw, res) {
          expect(res).to.have.property("result").that.is.false
          expect(res).to.have.property("error")
          expect(res.error).to.have.property("code").that.equals(errors.alreadyAuth);
          done.apply(null, arguments);

        }, { status: 400 });
      });
    });
    // remove all
    remove()
  });

  describe("password scenario with register account which already linked and not confirmed by another user", function () {
    // user 1
    auth()
    otpGetCode()
    otpLogin()
    passwordRegister()

    profile(
      "profile",
      "should return result true and password auth identity should not exists",
      (res) => {
        expect(res.user.auths).to.not.have.property(authTypes.password)
        userID = res.user.id
      }
    )

    // user 2
    auth2()

    describe("password login for another user", function () {
      it(`should return result false with error: ${errors.userNotFound}`, function (done) {
        request("/login", "post", emailRegCreds, function (err, raw, res) {
          expect(res).to.have.property("result").that.is.false
          expect(res).to.have.property("error")
          expect(res.error).to.have.property("code").that.equals(errors.userNotFound);
          done.apply(null, arguments);

        }, { status: 400, token: apiToken2 });
      });
    });

    passwordRegister2()
    logout2()
    passwordLogin2()
    // user 1
    passwordConfirm()

    profile(
      "profile",
      "should return result true and password auth identity should not exists",
      (res) => {
        expect(res.user.auths).to.not.have.property(authTypes.password)
      }
    )

    logout()
    passwordLogin()

    profile(
      "profile",
      "should return true and auth identities should exists password type, not of otp type and user id not equals of base user",
      (res) => {
        expect(res.user.id).to.not.equal(userID)
        expect(res.user.auths).to.not.have.property(authTypes.otp)
        expect(res.user.auths).to.have.property(authTypes.password).that.is.an("object")
      }
    )
    // remove all
    remove()
  });

  describe("otp negative scenario with linking account which already reserved by another user", function () {
    // user 1
    auth()
    passwordRegister()
    passwordConfirm()
    otpGetCode()

    profile(
      "profile",
      "should return result true and otp auth identity should not exists",
      (res) => {
        expect(res.user.auths).to.not.have.property(authTypes.otp)
        userID = res.user.id
      }
    )
    // user 2
    auth2()
    otpGetCode2()
    otpLogin2()
    // user 1
    describe("otp login", function () {
      it("should return result true", function (done) {
        request("/otp/{key}/auth", "post", otpLoginCreds, function (err, raw, res) {
          expect(res).to.have.property("result").that.is.false
          expect(res).to.have.property("error")
          expect(res.error).to.have.property("code").that.equals(errors.invalidCode);
          done.apply(null, arguments)

        }, { status: 400, pathParams: { key: authTypes.otp } })
      })
    })

    profile(
      "profile",
      "should return result true and otp auth identity should not exists",
      (res) => {
        expect(res.user.auths).to.not.have.property(authTypes.otp)
      }
    )

    logout()
    otpGetCode()
    otpLogin()

    profile(
      "profile",
      "should return result true and auth identities should exists otp type, not of password type and user id not equals of base user",
      (res) => {
        expect(res.user.id).to.not.equal(userID)
        expect(res.user.auths).to.not.have.property(authTypes.password)
        expect(res.user.auths).to.have.property(authTypes.otp).that.is.an("object")
      }
    )
    // remove all
    remove()
  });

  describe("password scenario with link account by 2 users. The first user confirms earlier", function () {
    // user 1
    auth()
    otpGetCode()
    otpLogin()
    // user 2
    auth2()
    describe("get otp code for another user", function () {
      it("should return result true", function (done) {
        request("/otp/{key}/code", "post", otpRegCreds2, function (err, raw, res) {
          expect(res).to.have.property("result").that.is.true
          expect(res).to.not.have.property("error")
          done.apply(null, arguments)

        }, { token: apiToken2, pathParams: { key: authTypes.otp } })
      })
    })
    describe("otp login another user", function () {
      it("should return result true", function (done) {
        request("/otp/{key}/auth", "post", otpLoginCreds2, function (err, raw, res) {
          expect(res).to.have.property("result").that.is.true
          expect(res).to.not.have.property("error")
          done.apply(null, arguments)

        }, { token: apiToken2, pathParams: { key: authTypes.otp } })
      })
    })
    // user 1
    passwordRegister()
    // user 2
    passwordRegister2()
    // user 1
    passwordConfirm()

    profile(
      "profile",
      "should return true and password auth identity should exists",
      (res) => {
        expect(res.user.auths).to.have.property(authTypes.password)
        userID = res.user.id
      }
    )
    // user 2
    passwordConfirm2()

    profile(
      "profile another user",
      "should return true and password auth identity should not exists",
      (res) => {
        expect(res.user.auths).to.not.have.property(authTypes.password)
        userID2 = res.user.id
      },
      2 // apiToken2
    )
    // user 1
    logout()
    passwordLogin()

    profile(
      "profile",
      "should return true and userID matches the first user",
      (res) => {
        expect(res.user.id).to.equal(userID)
      }
    )
    // user 2
    logout2()
    passwordLogin2()

    profile(
      "profile another user",
      "should return true and userID matches the first user",
      (res) => {
        expect(res.user.id).to.equal(userID)
      },
      2 // apiToken2
    )
    // remove all
    remove()
  });

  describe("password scenario with link account by 2 users. The second user confirms earlier", function () {
    // user 1
    auth()
    otpGetCode()
    otpLogin()
    passwordRegister()
    // user 2
    auth2()

    describe("get otp code for another user", function () {
      it("should return result true", function (done) {
        request("/otp/{key}/code", "post", otpRegCreds2, function (err, raw, res) {
          expect(res).to.have.property("result").that.is.true
          expect(res).to.not.have.property("error")
          done.apply(null, arguments)

        }, { token: apiToken2, pathParams: { key: authTypes.otp } })
      })
    })
    describe("otp login another user", function () {
      it("should return result true", function (done) {
        request("/otp/{key}/auth", "post", otpLoginCreds2, function (err, raw, res) {
          expect(res).to.have.property("result").that.is.true
          expect(res).to.not.have.property("error")
          done.apply(null, arguments)

        }, { token: apiToken2, pathParams: { key: authTypes.otp } })
      })
    })

    passwordRegister2()
    passwordConfirm2()

    profile(
      "profile another user",
      "should return true and password auth identity should exists",
      (res) => {
        expect(res.user.auths).to.have.property(authTypes.password)
        userID2 = res.user.id
      },
      2 // apiToken2
    )
    // user 1
    passwordConfirm()

    profile(
      "profile",
      "should return true and password auth identity should not exists",
      (res) => {
        expect(res.user.auths).to.not.have.property(authTypes.password)
        userID = res.user.id
      }
    )

    logout()
    passwordLogin()

    profile(
      "profile",
      "should return true and userID matches the second user",
      (res) => {
        expect(res.user.id).to.equal(userID2)
      }
    )
    // user 2
    logout2()
    passwordLogin2()

    profile(
      "profile another user",
      "should return true and userID matches the second user",
      (res) => {
        expect(res.user.id).to.equal(userID2)
      },
      2 // apiToken2
    )
    // remove all
    remove()
  });
});

function request(url, type, data, callback, paramsCfg) {
  const params = {
    hasToken: true,
    token: apiToken,
    status: 200,
    pathParams: {},
  }

  if (typeof paramsCfg !== "undefined") {
    Object.assign(params, paramsCfg)
  }

  let h = hippie(spec)

  if (params.token) {
    h = h.header("Authorization", "Bearer " + params.token)
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

      }, { hasToken: false })
    });
  });
}

function auth2() {
  describe("auth for another user", function () {
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

        apiToken2 = res.token;
        done.apply(null, arguments);

      }, { hasToken: false })
    });
  });
}

function passwordRegister() {
  describe("password register", function () {
    it("should return result true with uid", function (done) {
      request("/register", "post", emailRegCreds, function (err, raw, res) {
        expect(res).to.have.property("result").that.is.true
        expect(res).to.not.have.property("error")
        expect(res).to.have.property("uid")
        done.apply(null, arguments);
      });
    });
  });
}

function passwordRegister2() {
  describe("password register for another user", function () {
    it("should return result true with uid", function (done) {
      request("/register", "post", emailRegCreds, function (err, raw, res) {
        expect(res).to.have.property("result").that.is.true
        expect(res).to.not.have.property("error")
        expect(res).to.have.property("uid")
        done.apply(null, arguments);

      }, { token: apiToken2 });
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

function passwordConfirm2() {
  describe("password confirm for another user", function () {
    it("should return result true", function (done) {
      request("/confirm", "post", passwordConfirmCreds, function (err, raw, res) {
        expect(res).to.have.property("result").that.is.true;
        expect(res).to.not.have.property("error");
        done.apply(null, arguments);
      }, { token: apiToken2 });
    });
  });
}

function passwordLogin() {
  describe("password login", function () {
    it("should return result true with uid", function (done) {
      request("/login", "post", emailRegCreds, function (err, raw, res) {
        expect(res).to.have.property("result").that.is.true
        expect(res).to.not.have.property("error")
        done.apply(null, arguments);
      });
    });
  });
}

function passwordLogin2() {
  describe("password login for another user", function () {
    it("should return result true with uid", function (done) {
      request("/login", "post", emailRegCreds, function (err, raw, res) {
        expect(res).to.have.property("result").that.is.true
        expect(res).to.not.have.property("error")
        done.apply(null, arguments);

      }, { token: apiToken2 });
    });
  });
}

function profile(desc, should, callback, token = 1) {
  describe(desc, function () {
    it(should, function (done) {
      let bearerToken
      switch (token) {
        case 1:
          bearerToken = apiToken
          break;
        case 2:
          bearerToken = apiToken2
          break;
      }

      request("/profile", "get", null, function (err, raw, res) {
        expect(res).to.have.property("result").that.is.true
        expect(res).to.not.have.property("error")
        expect(res).to.have.property("user").that.is.an("object")
        expect(res.user).to.have.property("guest").that.is.false
        expect(res.user).to.have.property("auths").that.is.an("object")

        callback(res)
        done.apply(null, arguments);

      }, { token: bearerToken });
    });
  });
}

function logout() {
  describe("logout", function () {
    it("should return result true", function (done) {
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

function logout2() {
  describe("logout another user", function () {
    it("should return result true", function (done) {
      request("/logout", "post", null, function (err, raw, res) {
        expect(res).to.have.property("result").that.is.true
        expect(res).to.have.property("token")
        expect(res).to.not.have.property("error")

        apiToken2 = res.token
        done.apply(null, arguments)

      }, { token: apiToken2 })
    });
  });
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

      }, { pathParams: { key: authTypes.otp } })
    })
  })
}

function otpGetCode2() {
  describe("get otp code for another user", function () {
    it("should return result true", function (done) {
      request("/otp/{key}/code", "post", otpRegCreds, function (err, raw, res) {
        expect(res).to.have.property("result").that.is.true
        expect(res).to.not.have.property("error")
        done.apply(null, arguments)

      }, { token: apiToken2, pathParams: { key: authTypes.otp } })
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

      }, { pathParams: { key: authTypes.otp } })
    })
  })
}

function otpLogin2() {
  describe("otp login another user", function () {
    it("should return result true", function (done) {
      request("/otp/{key}/auth", "post", otpLoginCreds, function (err, raw, res) {
        expect(res).to.have.property("result").that.is.true
        expect(res).to.not.have.property("error")
        done.apply(null, arguments)

      }, { token: apiToken2, pathParams: { key: authTypes.otp } })
    })
  })
}

function remove() {
  describe("remove all users and sessions", function () {
    it("should return result true", function (done) {
      request("/clearAll", "delete", null, function (err, raw, res) {
        expect(res).to.have.property("result").that.is.true
        expect(res).to.not.have.property("error")
        done.apply(null, arguments)
      })
    })
  })
}

