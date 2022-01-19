"use strict"

var SwaggerParser = require("swagger-parser")
var parser = new SwaggerParser()
var hippie = require("hippie-swagger")
var expect = require("chai").expect
var chai = require("chai")
var chaihttp = require("chai-http")
var spec

var config = require("./config.js")
chai.use(chaihttp)

var baseUrl = config.baseUrl
var specFile = config.specFile
var sentCodeTimeout = config.sentCodeTimeout;

var googleToken = process.env.GOOGLE_TOKEN || ""
var googleToken2 = process.env.GOOGLE_TOKEN2 || ""
if (googleToken == "") {
  console.log('ATTENTION! No GOOGLE_TOKEN provided, so google login tests are skipped.')
}
if (googleToken2 == "") {
  console.log('ATTENTION! No GOOGLE_TOKEN2 provided, so google login negative tests are skipped.')
}

const email = "test" + (Math.floor(Math.random() * 99999)) + "@rosberry.com"
const phone = "+7" + (Math.floor(Math.random() * 999999999))
const password = "password"

const email2 = "test2" + (Math.floor(Math.random() * 99999)) + "@rosberry.com"
const phone2 = "8" + (Math.floor(Math.random() * 999999999))
const password2 = "password2"

const confirmEmailCode = "456123";
const confirmOTPCode = "123321";

let userID = null
let userID2 = null
let apiToken = ""
let apiToken2 = ""

const authTypes = {
  password: "email",
  social: "google",
  otp: "telegram",
}

const emailRegCreds = {
  type: authTypes.password,
  name: "Test1",
  email: email,
  password: password,
}
const emailRegCreds2 = {
  type: authTypes.password,
  name: "Test2",
  email: email2,
  password: password2,
}

const passwordInitLinkingCreds = {
  type: authTypes.password,
  uid: email,
}

const passwordInitLinkingCreds2 = {
  type: authTypes.password,
  uid: email2,
}

const passwordLinkCreds = {
  type: authTypes.password,
  uid: email,
  password: password,
  code: confirmEmailCode,
}

const passwordLinkCreds2 = {
  type: authTypes.password,
  uid: email2,
  password: password2,
  code: confirmEmailCode,
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

const passwordConfirmCreds2 = {
  type: authTypes.password,
  uid: email2,
  code: confirmEmailCode
}

const errors = {
  userNotFound: "user_not_found",
  userNotConfirmed: "user_not_confirmed",
  userExist: "user_exist",
  alreadyAuth: "already_auth",
  authIdentityAlreadyExists: "auth_identity_already_exists",
  invalidRequest: "req_invalid",
  invalidCode: "invalid_code",
  codeExpired: "code_expired",
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

  // mono session group
  // base positive linking flow
  describe("scenario of successed otp, social linking to password account", function () {
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
      `should return result true and exists ${authTypes.password}, ${authTypes.social}, ${authTypes.otp} auth identities`,
      (res) => {
        // TODO: fix error
        // expect(res.user.auths).to.have.property(authTypes.password).that.is.an("object")
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
    describe("scenario of successed password, otp linking to social account", function () {
      auth()
      socialLogin()
      // adding auth identities
      passwordInitLink()
      passwordLink()
      otpGetCode()
      otpLogin()
      profile(
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

  describe("scenario of successed password, social linking to otp account", function () {
    auth()
    otpGetCode()
    otpLogin()
    // adding auth identities
    passwordInitLink()
    passwordLink()
    if (googleToken !== "") {
      socialLogin()
    }
    profile(
      `should return result true and exists ${authTypes.password}, ${authTypes.social}, ${authTypes.otp} auth identities`,
      (res) => {
        // TODO: fix error
        // expect(res.user.auths).to.have.property(authTypes.password).that.is.an("object")
        // expect(res.user.auths).to.have.property(authTypes.otp).that.is.an("object")
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

  // link account without init (userNotFound) (without social)
  describe("password negative scenario with linking account without linking initialisation", function () {
    auth()
    otpGetCode()
    otpLogin()

    describe("password link account", function () {
      it(`should return result false with error: ${errors.userNotFound}`, function (done) {
        request("/link", "post", passwordLinkCreds, function (err, raw, res) {
          expect(res).to.have.property("result").that.is.false;
          expect(res).to.have.property("error");
          expect(res.error).to.have.property("code").that.equals(errors.userNotFound);
          done.apply(null, arguments);

        }, { status: 400 });
      });
    });

    remove()
  });

  describe("otp negative scenario with linking account without linking initialisation", function () {
    auth()
    passwordRegister()
    passwordConfirm()

    describe("otp link account", function () {
      it(`should return result false and error: ${errors.userNotFound}`, function (done) {
        request("/otp/{key}/auth", "post", otpLoginCreds, function (err, raw, res) {
          expect(res).to.have.property("result").that.is.false
          expect(res).to.have.property("error")
          expect(res.error).to.have.property("code").that.equals(errors.userNotFound);
          done.apply(null, arguments)

        }, { status: 400, pathParams: { key: authTypes.otp } })
      })
    });

    remove()
  });

  // duplicate auth identity key flow
  describe("password negative scenario with linking account whose auth identity key is already exists", function () {
    auth()
    passwordRegister()
    passwordConfirm()

    describe("link password account with already existing auth type", function () {
      it(`should return result false and error: ${errors.authIdentityAlreadyExists}`, function (done) {
        request("/initLink", "post", passwordInitLinkingCreds2, function (err, raw, res) {
          expect(res).to.have.property("result").that.is.false;
          expect(res).to.have.property("error");
          expect(res.error).to.have.property("code").that.equals(errors.authIdentityAlreadyExists);
          done.apply(null, arguments);
        }, { status: 400 });
      });
    });
    remove()
  });

  if (googleToken2 !== "") {
    describe("social negative scenario with linking account whose auth identity key is already exists", function () {
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

  describe("otp negative scenario with linking account whose auth identity key is already exists", function () {
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

  // not confirmed flow (only password)
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

  // multi session group
  // link already registered account flow (user exists)
  describe("password negative scenario with linking account which already register by another user", function () {
    // user 1: password register
    auth()
    passwordRegister()
    // user 2: otp register
    auth({ session: 2 })
    otpGetCode({ session: 2 })
    otpLogin({ session: 2 })
    // user 2: start password link
    describe("link already register password account", function () {
      it(`should return result false and error: ${errors.userExist}`, function (done) {
        request("/initLink", "post", passwordInitLinkingCreds, function (err, raw, res) {
          expect(res).to.have.property("result").that.is.false
          expect(res).to.have.property("error")
          expect(res.error).to.have.property("code").that.equals(errors.userExist);
          done.apply(null, arguments);

        }, { token: apiToken2, status: 400 });
      });
    });
    // remove all
    remove()
  });

  describe("otp negative scenario with linking account which already register by another user", function () {
    // user 1: otp register
    auth()
    otpGetCode()
    otpLogin()
    // user 2: password register
    auth({ session: 2 })
    passwordRegister({ session: 2 })
    // user 2: start otp link
    describe("otp login for user 2", function () {
      it(`should return result false and error: ${errors.userExist}`, function (done) {
        request("/otp/{key}/auth", "post", otpLoginCreds, function (err, raw, res) {
          expect(res).to.have.property("result").that.is.false
          expect(res).to.have.property("error")
          expect(res.error).to.have.property("code").that.equals(errors.userExist);
          done.apply(null, arguments)

        }, { status: 400, token: apiToken2, pathParams: { key: authTypes.otp } })
      })
    })
    // remove all
    remove()
  });

  if (googleToken !== "") {
    describe("social negative scenario with linking account which already register by another user", function () {
      // user 1: social register
      auth()
      socialLogin()
      // user 2: password register
      auth({ session: 2 })
      passwordRegister({ session: 2 })
      // user 2: start social link
      describe("duplicate social register", function () {
        it(`should return result false and error: ${errors.userExist}`, function (done) {
          request("/social/login", "post", googleRegCreds, function (err, raw, res) {
            expect(res).to.have.property("result").that.is.false;
            expect(res).to.have.property("error");
            expect(res.error).to.have.property("code").that.equals(errors.userExist);
            done.apply(null, arguments);

          }, { status: 400, token: apiToken2 });
        });
      });
      // remove all
      remove()
    });
  }

  // login to temp user by another user (user not found) (without social)
  describe("password scenario with login to not confirmed linking account by another user", function () {
    // user 1: otp register
    auth()
    otpGetCode()
    otpLogin()
    // user 1: start password link
    passwordInitLink()

    profile(
      "should return result true and password auth identity should not exists",
      (res) => {
        expect(res.user.auths).to.have.property(authTypes.otp).that.is.an("object")
        expect(res.user.auths).to.not.have.property(authTypes.password)
        userID = res.user.id
      }
    )
    // user 2: password login
    auth({ session: 2 })

    describe("password login for user 2 (temp user)", function () {
      it(`should return result false with error: ${errors.userNotFound}`, function (done) {
        request("/login", "post", emailRegCreds, function (err, raw, res) {
          expect(res).to.have.property("result").that.is.false
          expect(res).to.have.property("error")
          expect(res.error).to.have.property("code").that.equals(errors.userNotFound);
          done.apply(null, arguments);

        }, { status: 400, token: apiToken2 });
      });
    });
    // remove all
    remove()
  });

  describe("otp scenario with login to not confirmed linking account by another user", function () {
    // user 1: password register
    auth()
    passwordRegister()
    passwordConfirm()
    // user 1: start otp link
    otpGetCode()

    profile(
      "should return result true and otp auth identity should not exists",
      (res) => {
        expect(res.user.auths).to.have.property(authTypes.password).that.is.an("object")
        expect(res.user.auths).to.not.have.property(authTypes.otp)
        userID = res.user.id
      }
    )
    // user 2: otp login
    auth({ session: 2 })

    describe("otp login for user 2 (temp user)", function () {
      it(`should return result false and error: ${errors.userNotFound}`, function (done) {
        request("/otp/{key}/auth", "post", otpLoginCreds, function (err, raw, res) {
          expect(res).to.have.property("result").that.is.false
          expect(res).to.have.property("error")
          expect(res.error).to.have.property("code").that.equals(errors.userNotFound);
          done.apply(null, arguments)

        }, { status: 400, token: apiToken2, pathParams: { key: authTypes.otp } })
      })
    })
    // remove all
    remove()
  });

  // login to linked account by another user
  describe("password scenario with login to linked account by another user", function () {
    // user 1: otp register
    auth()
    otpGetCode()
    otpLogin()
    // user 1: password link
    passwordInitLink()
    passwordLink()

    profile(
      "should return result true and password auth identity should not exists",
      (res) => {
        expect(res.user.auths).to.have.property(authTypes.otp).that.is.an("object")
        expect(res.user.auths).to.have.property(authTypes.password).that.is.an("object")
      }
    )
    // user 2: password login
    auth({ session: 2 })
    passwordLogin({ session: 2 })
    // remove all
    remove()
  });

  describe("otp scenario with login to linked account by another user", function () {
    // user 1: password register
    auth()
    passwordRegister()
    passwordConfirm()
    // user 1: otp link
    otpGetCode()
    otpLogin()

    profile(
      "should return result true and otp auth identity should not exists",
      (res) => {
        expect(res.user.auths).to.have.property(authTypes.password).that.is.an("object")
        expect(res.user.auths).to.have.property(authTypes.otp).that.is.an("object")
      }
    )
    // user 2: otp login
    auth({ session: 2 })

    describe("otp login for user 2 (temp user)", function () {
      it(`should return result false and error: ${errors.codeExpired}`, function (done) {
        request("/otp/{key}/auth", "post", otpLoginCreds, function (err, raw, res) {
          expect(res).to.have.property("result").that.is.false
          expect(res).to.have.property("error")
          expect(res.error).to.have.property("code").that.equals(errors.codeExpired);
          done.apply(null, arguments)

        }, { status: 400, token: apiToken2, pathParams: { key: authTypes.otp } })
      })
    })
    // remove all
    remove()
  });

  if (googleToken !== "") {
    describe("social scenario with login to linked account by another user", function () {
      // user 1: password register
      auth()
      passwordRegister()
      passwordConfirm()
      // user 1: social link
      socialLogin()

      profile(
        "should return result true and social auth identity should not exists",
        (res) => {
          // TODO: fix error
          // expect(res.user.auths).to.have.property(authTypes.password).that.is.an("object")
          expect(res.user.auths).to.have.property(authTypes.social).that.is.an("object")
        }
      )
      // user 2: social login
      auth({ session: 2 })
      socialLogin({ session: 2 })
      // user 1: social login
      logout()
      socialLogin()
      // remove all
      remove()
    })
  }

  // inject register after link init flow
  describe("password scenario with inject registration by another user after start linking and before end linking", function () {
    // user 1: otp register
    auth()
    otpGetCode()
    otpLogin()
    // user 1: start password link
    passwordInitLink()

    profile(
      "should return result true and password auth identity should not exists",
      (res) => {
        expect(res.user.auths).to.have.property(authTypes.otp).that.is.an("object")
        expect(res.user.auths).to.not.have.property(authTypes.password)
        userID = res.user.id
      }
    )
    // user 2: password register
    auth({ session: 2 })
    passwordRegister({ session: 2 })

    // user 1: end password link
    describe("password link account for user 1", function () {
      it(`should return result false with error: ${errors.userExist}`, function (done) {
        request("/link", "post", passwordLinkCreds, function (err, raw, res) {
          expect(res).to.have.property("result").that.is.false;
          expect(res).to.have.property("error");
          expect(res.error).to.have.property("code").that.equals(errors.userExist);
          done.apply(null, arguments);

        }, { status: 400 });
      });
    });

    profile(
      "should return result true and password auth identity should not exists",
      (res) => {
        expect(res.user.auths).to.have.property(authTypes.otp).that.is.an("object")
        expect(res.user.auths).to.not.have.property(authTypes.password)
      }
    )
    // user 1: password login result
    logout()
    passwordLogin()

    profile(
      "should return result true and auth identities should exists password type, not of otp type and user id not equals user 1",
      (res) => {
        expect(res.user.id).to.not.equal(userID)
        expect(res.user.auths).to.not.have.property(authTypes.otp)
        expect(res.user.auths).to.have.property(authTypes.password).that.is.an("object")
      }
    )
    // user 2: password login result not needed (standard flow)
    // remove all
    remove()
  });

  describe("otp scenario with inject registration by another user after start linking and before end linking", function () {
    // user 1: password register
    auth()
    passwordRegister()
    passwordConfirm()
    // user 1: start otp link
    otpGetCode()

    profile(
      "should return result true and otp auth identity should not exists",
      (res) => {
        expect(res.user.auths).to.have.property(authTypes.password).that.is.an("object")
        expect(res.user.auths).to.not.have.property(authTypes.otp)
        userID = res.user.id
      }
    )
    // user 2: otp register
    auth({ session: 2 })
    otpGetCode({ session: 2 })
    otpLogin({ session: 2 })
    // user 1: end otp link
    describe("otp login for user 1", function () {
      it(`should return result false and error: ${errors.userExist}`, function (done) {
        request("/otp/{key}/auth", "post", otpLoginCreds, function (err, raw, res) {
          expect(res).to.have.property("result").that.is.false
          expect(res).to.have.property("error")
          expect(res.error).to.have.property("code").that.equals(errors.userExist);
          done.apply(null, arguments)

        }, { status: 400, pathParams: { key: authTypes.otp } })
      })
    })

    profile(
      "should return result true and otp auth identity should not exists",
      (res) => {
        expect(res.user.auths).to.have.property(authTypes.password).that.is.an("object")
        expect(res.user.auths).to.not.have.property(authTypes.otp)
      }
    )
    // user 1: otp login result
    logout()
    otpGetCode()
    otpLogin()

    profile(
      "should return result true and auth identities should exists otp type, not of password type and user id not equals of user 1",
      (res) => {
        expect(res.user.id).to.not.equal(userID)
        expect(res.user.auths).to.not.have.property(authTypes.password)
        expect(res.user.auths).to.have.property(authTypes.otp).that.is.an("object")
      }
    )
    // user 2: otp login result not needed (standard flow)
    // remove all
    remove()
  });

  // link account by 2 users
  describe("password scenario with link account by 2 users. The first user confirms earlier", function () {
    // auth users
    auth()
    otpGetCode()
    otpLogin()
    auth({ session: 2 })
    otpGetCode({ session: 2, creds: 2 })
    otpLogin({ session: 2, creds: 2 })
    // user 1: start link
    passwordInitLink()
    // user 2: start link
    passwordInitLink({ session: 2 })
    // user 1: end link
    passwordLink()

    profile(
      "should return result true and password auth identity should exists",
      (res) => {
        expect(res.user.auths).to.have.property(authTypes.otp).that.is.an("object")
        expect(res.user.auths).to.have.property(authTypes.password).that.is.an("object")
        userID = res.user.id
      }
    )
    // user 2: end link
    describe("password link account for user 2", function () {
      it(`should return result false with error: ${errors.userExist}`, function (done) {
        request("/link", "post", passwordLinkCreds, function (err, raw, res) {
          expect(res).to.have.property("result").that.is.false;
          expect(res).to.have.property("error");
          expect(res.error).to.have.property("code").that.equals(errors.userExist);
          done.apply(null, arguments);

        }, { status: 400, token: apiToken2 });
      });
    });

    profile(
      "should return result true and password auth identity should not exists",
      (res) => {
        expect(res.user.auths).to.have.property(authTypes.otp).that.is.an("object")
        expect(res.user.auths).to.not.have.property(authTypes.password)
        userID2 = res.user.id
      },
      { session: 2 }
    )
    // user 1: login result
    logout()
    passwordLogin()

    profile(
      "should return result true and userID matches the user 1",
      (res) => {
        expect(res.user.auths).to.have.property(authTypes.otp).that.is.an("object")
        expect(res.user.auths).to.have.property(authTypes.password).that.is.an("object")
        expect(res.user.id).to.equal(userID)
      }
    )
    // user 2: login result
    logout({ session: 2 })
    passwordLogin({ session: 2 })

    profile(
      "should return result true and userID matches the user 1",
      (res) => {
        expect(res.user.auths).to.have.property(authTypes.otp).that.is.an("object")
        expect(res.user.auths).to.have.property(authTypes.password).that.is.an("object")
        expect(res.user.id).to.equal(userID)
      },
      { session: 2 }
    )
    // remove all
    remove()
  });

  describe("password scenario with link account by 2 users. The second user confirms earlier", function () {
    // auth users
    auth()
    otpGetCode()
    otpLogin()
    auth({ session: 2 })
    otpGetCode({ session: 2, creds: 2 })
    otpLogin({ session: 2, creds: 2 })
    // user 1: start link
    passwordInitLink()
    // user 2: start & end link
    passwordInitLink({ session: 2 })
    passwordLink({ session: 2 })

    profile(
      "should return result true and password auth identity should exists",
      (res) => {
        expect(res.user.auths).to.have.property(authTypes.otp).that.is.an("object")
        expect(res.user.auths).to.have.property(authTypes.password).that.is.an("object")
        userID2 = res.user.id
      },
      { session: 2 }
    )
    // user 1: login result
    describe("password link account for user 1", function () {
      it(`should return result false with error: ${errors.userExist}`, function (done) {
        request("/link", "post", passwordLinkCreds, function (err, raw, res) {
          expect(res).to.have.property("result").that.is.false;
          expect(res).to.have.property("error");
          expect(res.error).to.have.property("code").that.equals(errors.userExist);
          done.apply(null, arguments);

        }, { status: 400 });
      });
    });

    profile(
      "should return result true and password auth identity should not exists",
      (res) => {
        expect(res.user.auths).to.have.property(authTypes.otp).that.is.an("object")
        expect(res.user.auths).to.not.have.property(authTypes.password)
        userID = res.user.id
      }
    )
    // user 1: login result
    logout()
    passwordLogin()

    profile(
      "should return result true and userID matches the user 2",
      (res) => {
        expect(res.user.auths).to.have.property(authTypes.otp).that.is.an("object")
        expect(res.user.auths).to.have.property(authTypes.password).that.is.an("object")
        expect(res.user.id).to.equal(userID2)
      }
    )
    // user 2: login result
    logout({ session: 2 })
    passwordLogin({ session: 2 })

    profile(
      "should return result true and userID matches the user 2",
      (res) => {
        expect(res.user.auths).to.have.property(authTypes.otp).that.is.an("object")
        expect(res.user.auths).to.have.property(authTypes.password).that.is.an("object")
        expect(res.user.id).to.equal(userID2)
      },
      { session: 2 }
    )
    // remove all
    remove()
  });

  describe("otp scenario with link account by 2 users. The first user confirms earlier", function () {
    // auth users
    auth()
    passwordRegister()
    passwordConfirm()
    auth({ session: 2 })
    passwordRegister({ session: 2, creds: 2 })
    passwordConfirm({ session: 2, creds: 2 })
    // user 1: start link
    otpGetCode()
    // user 2: start link
    otpGetCode({ session: 2 })
    // user 1: end link
    otpLogin()

    profile(
      "should return result true and password auth identity should exists",
      (res) => {
        expect(res.user.auths).to.have.property(authTypes.password).that.is.an("object")
        expect(res.user.auths).to.have.property(authTypes.otp).that.is.an("object")
        userID = res.user.id
      }
    )
    // user 2: end link
    describe("otp login for user 2", function () {
      it(`should return result false and error: ${errors.userExist}`, function (done) {
        request("/otp/{key}/auth", "post", otpLoginCreds, function (err, raw, res) {
          expect(res).to.have.property("result").that.is.false
          expect(res).to.have.property("error")
          expect(res.error).to.have.property("code").that.equals(errors.userExist);
          done.apply(null, arguments)

        }, { status: 400, token: apiToken2, pathParams: { key: authTypes.otp } })
      })
    })

    profile(
      "should return result true and password auth identity should not exists",
      (res) => {
        expect(res.user.auths).to.have.property(authTypes.password).that.is.an("object")
        expect(res.user.auths).to.not.have.property(authTypes.otp)
        userID2 = res.user.id
      },
      { session: 2 }
    )
    // user 1: login result
    logout()
    otpGetCode()
    otpLogin()

    profile(
      "should return result true and userID matches the user 1",
      (res) => {
        expect(res.user.auths).to.have.property(authTypes.password).that.is.an("object")
        expect(res.user.auths).to.have.property(authTypes.otp).that.is.an("object")
        expect(res.user.id).to.equal(userID)
      }
    )
    // user 2: login result
    logout({ session: 2 })
    otpGetCode({ session: 2 })
    otpLogin({ session: 2 })

    profile(
      "should return result true and userID matches the user 1",
      (res) => {
        expect(res.user.auths).to.have.property(authTypes.password).that.is.an("object")
        expect(res.user.auths).to.have.property(authTypes.otp)
        expect(res.user.id).to.equal(userID)
      },
      { session: 2 }
    )
    // remove all
    remove()
  });

  describe("otp scenario with link account by 2 users. The second user confirms earlier", function () {
    // auth users
    auth()
    passwordRegister()
    passwordConfirm()
    auth({ session: 2 })
    passwordRegister({ session: 2, creds: 2 })
    passwordConfirm({ session: 2, creds: 2 })
    // user 1: start link
    otpGetCode()
    // user 2: start & end link
    otpGetCode({ session: 2 })
    otpLogin({ session: 2 })

    profile(
      "should return result true and password auth identity should exists",
      (res) => {
        expect(res.user.auths).to.have.property(authTypes.password).that.is.an("object")
        expect(res.user.auths).to.have.property(authTypes.otp).that.is.an("object")
        userID2 = res.user.id
      },
      { session: 2 }
    )
    // user 1: end link
    describe("otp login for user 1", function () {
      it(`should return result false and error: ${errors.userExist}`, function (done) {
        request("/otp/{key}/auth", "post", otpLoginCreds, function (err, raw, res) {
          expect(res).to.have.property("result").that.is.false
          expect(res).to.have.property("error")
          expect(res.error).to.have.property("code").that.equals(errors.userExist);
          done.apply(null, arguments)

        }, { status: 400, pathParams: { key: authTypes.otp } })
      })
    })

    profile(
      "should return result true and password auth identity should not exists",
      (res) => {
        expect(res.user.auths).to.have.property(authTypes.password).that.is.an("object")
        expect(res.user.auths).to.not.have.property(authTypes.otp)
        userID = res.user.id
      }
    )
    // user 1: login result
    logout()
    otpGetCode()
    otpLogin()

    profile(
      "should return result true and userID matches the user 2",
      (res) => {
        expect(res.user.auths).to.have.property(authTypes.password).that.is.an("object")
        expect(res.user.auths).to.have.property(authTypes.otp).that.is.an("object")
        expect(res.user.id).to.equal(userID2)
      }
    )
    // user 2: login result
    logout({ session: 2 })
    otpGetCode({ session: 2 })
    otpLogin({ session: 2 })

    profile(
      "should return result true and userID matches the user 2",
      (res) => {
        expect(res.user.auths).to.have.property(authTypes.password).that.is.an("object")
        expect(res.user.auths).to.have.property(authTypes.otp).that.is.an("object")
        expect(res.user.id).to.equal(userID2)
      },
      { session: 2 }
    )
    // remove all
    remove()
  });

  // link account by 2 users without init by another user
  describe("password scenario with link account by 2 users without link init by another user. The first user initializes and the second user confirms", function () {
    // auth users
    auth()
    otpGetCode()
    otpLogin()
    auth({ session: 2 })
    otpGetCode({ session: 2, creds: 2 })
    otpLogin({ session: 2, creds: 2 })
    // user 1: start link
    passwordInitLink()
    // user 2: end link
    passwordLink({ session: 2 })
    // user 1: end link
    describe("password link account for user 1", function () {
      it(`should return result false with error: ${errors.userExist}`, function (done) {
        request("/link", "post", passwordLinkCreds, function (err, raw, res) {
          expect(res).to.have.property("result").that.is.false;
          expect(res).to.have.property("error");
          expect(res.error).to.have.property("code").that.equals(errors.userExist);
          done.apply(null, arguments);

        }, { status: 400 });
      });
    });

    profile(
      "should return result true and password auth identity should not exists",
      (res) => {
        expect(res.user.auths).to.have.property(authTypes.otp).that.is.an("object")
        expect(res.user.auths).to.not.have.property(authTypes.password)
        userID = res.user.id
      }
    )
    // user 2: end link
    profile(
      "should return result true and password auth identity should exists",
      (res) => {
        expect(res.user.auths).to.have.property(authTypes.otp).that.is.an("object")
        expect(res.user.auths).to.have.property(authTypes.password).that.is.an("object")
        userID2 = res.user.id
      },
      { session: 2 }
    )
    // user 1: login result
    logout()
    passwordLogin()

    profile(
      "should return result true and userID matches the user 2",
      (res) => {
        expect(res.user.auths).to.have.property(authTypes.otp).that.is.an("object")
        expect(res.user.auths).to.have.property(authTypes.password).that.is.an("object")
        expect(res.user.id).to.equal(userID2)
      }
    )
    // user 2: login result
    logout({ session: 2 })
    passwordLogin({ session: 2 })

    profile(
      "should return result true and userID matches the user 2",
      (res) => {
        expect(res.user.auths).to.have.property(authTypes.otp).that.is.an("object")
        expect(res.user.auths).to.have.property(authTypes.password).that.is.an("object")
        expect(res.user.id).to.equal(userID2)
      },
      { session: 2 }
    )
    // remove all
    remove()
  });

  describe("otp scenario with link account by 2 users without link init by another user. The first user initializes and the second user confirms", function () {
    // auth users
    auth()
    passwordRegister()
    passwordConfirm()
    auth({ session: 2 })
    passwordRegister({ session: 2, creds: 2 })
    passwordConfirm({ session: 2, creds: 2 })
    // user 1: start link
    otpGetCode()
    // user 2: end link
    otpLogin({ session: 2 })
    // user 1: end link
    describe("otp login for user 1", function () {
      it(`should return result false and error: ${errors.userExist}`, function (done) {
        request("/otp/{key}/auth", "post", otpLoginCreds, function (err, raw, res) {
          expect(res).to.have.property("result").that.is.false
          expect(res).to.have.property("error")
          expect(res.error).to.have.property("code").that.equals(errors.userExist);
          done.apply(null, arguments)

        }, { status: 400, pathParams: { key: authTypes.otp } })
      })
    })

    // user 1: profile
    profile(
      "should return result true and password auth identity should not exists",
      (res) => {
        expect(res.user.auths).to.have.property(authTypes.password).that.is.an("object")
        expect(res.user.auths).to.not.have.property(authTypes.otp)
        userID = res.user.id
      }
    )
    // user 2: profile
    profile(
      "should return result true and password auth identity should exists",
      (res) => {
        expect(res.user.auths).to.have.property(authTypes.password).that.is.an("object")
        expect(res.user.auths).to.have.property(authTypes.otp).that.is.an("object")
        userID2 = res.user.id
      },
      { session: 2 }
    )
    // user 1: login result
    logout()
    otpGetCode()
    otpLogin()

    profile(
      "should return result true and userID matches the user 1",
      (res) => {
        expect(res.user.auths).to.have.property(authTypes.password).that.is.an("object")
        expect(res.user.auths).to.have.property(authTypes.otp).that.is.an("object")
        expect(res.user.id).to.equal(userID2)
      }
    )
    // user 2: login result
    logout({ session: 2 })
    otpGetCode({ session: 2 })
    otpLogin({ session: 2 })

    profile(
      "should return result true and userID matches the user 1",
      (res) => {
        expect(res.user.auths).to.have.property(authTypes.password).that.is.an("object")
        expect(res.user.auths).to.have.property(authTypes.otp).that.is.an("object")
        expect(res.user.id).to.equal(userID2)
      },
      { session: 2 }
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

function getSession(params) {
  let session = 1
  let token

  if (typeof params !== "undefined" && typeof params.session !== "undefined") {
    session = params.session
  }

  switch (session) {
    case 1:
      token = apiToken
      break;
    case 2:
      token = apiToken2
      break;
  }

  return [token, session]
}

function auth(params) {
  const [_, sess] = getSession(params)
  describe(`auth user ${sess}`, function () {
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

        switch (sess) {
          case 1:
            apiToken = res.token;
            break;
          case 2:
            apiToken2 = res.token;
            break;
        }
        done.apply(null, arguments);

      }, { hasToken: false })
    });
  });
}

function passwordRegister(params) {
  describe(`password register for user ${getSession(params)[1]}`, function () {
    it("should return result true with uid", function (done) {
      let credsNum = 1
      let creds
      if (typeof params !== "undefined" && typeof params.creds !== "undefined") {
        credsNum = params.creds
      }

      switch (credsNum) {
        case 1:
          creds = emailRegCreds
          break;
        case 2:
          creds = emailRegCreds2
          break;
      }

      request("/register", "post", creds, function (err, raw, res) {
        expect(res).to.have.property("result").that.is.true
        expect(res).to.not.have.property("error")
        expect(res).to.have.property("uid")
        done.apply(null, arguments);

      }, { token: getSession(params)[0] });
    });
  });
}

function passwordConfirm(params) {
  describe(`password confirm for user ${getSession(params)[1]}`, function () {
    it("should return result true", function (done) {
      let credsNum = 1
      let creds
      if (typeof params !== "undefined" && typeof params.creds !== "undefined") {
        credsNum = params.creds
      }

      switch (credsNum) {
        case 1:
          creds = passwordConfirmCreds
          break;
        case 2:
          creds = passwordConfirmCreds2
          break;
      }
      request("/confirm", "post", creds, function (err, raw, res) {
        expect(res).to.have.property("result").that.is.true;
        expect(res).to.not.have.property("error");
        done.apply(null, arguments);

      }, { token: getSession(params)[0] });
    });
  });
}

function passwordLogin(params) {
  describe(`password login for user ${getSession(params)[1]}`, function () {
    it("should return result true with uid", function (done) {
      let credsNum = 1
      let creds
      if (typeof params !== "undefined" && typeof params.creds !== "undefined") {
        credsNum = params.creds
      }

      switch (credsNum) {
        case 1:
          creds = emailRegCreds
          break;
        case 2:
          creds = emailRegCreds2
          break;
      }
      request("/login", "post", creds, function (err, raw, res) {
        expect(res).to.have.property("result").that.is.true
        expect(res).to.not.have.property("error")
        done.apply(null, arguments);

      }, { token: getSession(params)[0] });
    });
  });
}

function passwordInitLink(params) {
  describe(`init linking password account for user ${getSession(params)[1]}`, function () {
    it("should return result true", function (done) {
      this.timeout(sentCodeTimeout + 1000);
      setTimeout(function () {
        let credsNum = 1
        let creds
        if (typeof params !== "undefined" && typeof params.creds !== "undefined") {
          credsNum = params.creds
        }

        switch (credsNum) {
          case 1:
            creds = passwordInitLinkingCreds
            break;
          case 2:
            creds = passwordInitLinkingCreds2
            break;
        }

        request("/initLink", "post", creds, function (err, raw, res) {
          expect(res).to.have.property("result").that.is.true
          expect(res).to.not.have.property("error")
          done.apply(null, arguments);

        }, { token: getSession(params)[0] });
      }, sentCodeTimeout)
    });
  });
}

function passwordLink(params) {
  describe(`link password account for user ${getSession(params)[1]}`, function () {
    it("should return result true", function (done) {
      let credsNum = 1
      let creds
      if (typeof params !== "undefined" && typeof params.creds !== "undefined") {
        credsNum = params.creds
      }

      switch (credsNum) {
        case 1:
          creds = passwordLinkCreds
          break;
        case 2:
          creds = passwordLinkCreds2
          break;
      }

      request("/link", "post", creds, function (err, raw, res) {
        expect(res).to.have.property("result").that.is.true
        expect(res).to.not.have.property("error")
        done.apply(null, arguments);

      }, { token: getSession(params)[0] });
    });
  });
}

function profile(should, callback, params) {
  describe(`profile for user ${getSession(params)[1]}`, function () {
    it(should, function (done) {
      request("/profile", "get", null, function (err, raw, res) {
        expect(res).to.have.property("result").that.is.true
        expect(res).to.not.have.property("error")
        expect(res).to.have.property("user").that.is.an("object")
        expect(res.user).to.have.property("guest").that.is.false
        expect(res.user).to.have.property("auths").that.is.an("object")

        callback(res)
        done.apply(null, arguments);

      }, { token: getSession(params)[0] });
    });
  });
}

function logout(params) {
  const [_, sess] = getSession(params)
  describe(`logout for user ${getSession(params)[1]}`, function () {
    it("should return result true", function (done) {
      request("/logout", "post", null, function (err, raw, res) {
        expect(res).to.have.property("result").that.is.true
        expect(res).to.have.property("token")
        expect(res).to.not.have.property("error")

        switch (sess) {
          case 1:
            apiToken = res.token;
            break;
          case 2:
            apiToken2 = res.token;
            break;
        }

        done.apply(null, arguments)

      }, { token: getSession(params)[0] });
    })
  })
}

function socialLogin(params) {
  if (googleToken !== "") {
    describe(`social login ${getSession(params)[1]}`, function () {
      it("should return result true", function (done) {
        request("/social/login", "post", googleRegCreds, function (err, raw, res) {
          expect(res).to.have.property("result").that.is.true
          expect(res).to.not.have.property("error")
          done.apply(null, arguments);

        }, { token: getSession(params)[0] });
      });
    });
  }
}

function otpGetCode(params) {
  describe(`get otp code for user ${getSession(params)[1]}`, function () {
    it("should return result true", function (done) {
      this.timeout(sentCodeTimeout + 1000);
      setTimeout(function () {
        let credsNum = 1
        let creds
        if (typeof params !== "undefined" && typeof params.creds !== "undefined") {
          credsNum = params.creds
        }

        switch (credsNum) {
          case 1:
            creds = otpRegCreds
            break;
          case 2:
            creds = otpRegCreds2
            break;
        }
        request("/otp/{key}/code", "post", creds, function (err, raw, res) {
          expect(res).to.have.property("result").that.is.true
          expect(res).to.not.have.property("error")
          done.apply(null, arguments)

        }, { token: getSession(params)[0], pathParams: { key: authTypes.otp } })
      }, sentCodeTimeout)
    })
  })
}

function otpLogin(params) {
  describe(`otp login for user ${getSession(params)[1]}`, function () {
    it("should return result true", function (done) {
      let credsNum = 1
      let creds
      if (typeof params !== "undefined" && typeof params.creds !== "undefined") {
        credsNum = params.creds
      }

      switch (credsNum) {
        case 1:
          creds = otpLoginCreds
          break;
        case 2:
          creds = otpLoginCreds2
          break;
      }
      request("/otp/{key}/auth", "post", creds, function (err, raw, res) {
        expect(res).to.have.property("result").that.is.true
        expect(res).to.not.have.property("error")
        done.apply(null, arguments)

      }, { token: getSession(params)[0], pathParams: { key: authTypes.otp } })
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

