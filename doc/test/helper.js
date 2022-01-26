"use strict"

var SwaggerParser = require("swagger-parser");
var parser = new SwaggerParser();
var api = require("hippie");
var expect = require("chai").expect;
var chai = require("chai");
var chaihttp = require("chai-http")
let should = chai.should();
var spec;

var config = require("./config.js");

chai.use(chaihttp);

var baseUrl = config.baseUrl;
var specFile = config.specFile;
var apiToken = "";

async function auth(device_id) {
    console.log("AUTH!", device_id);

    return api()
        .base(baseUrl)
        .post("/auth")
        .json()
        .send({
            device_id: device_id
        })
        .expectStatus(200)
        .end(function (err, raw, res) {
            apiToken = res.token;
        });
}

class APIClient {
    baseUrl = "";
    apiToken = "";
    confirmCode = "";

    constructor(baseUrl) {
        this.baseUrl = baseUrl;
        this.apiToken = "";
    }

    async auth(device_id) {
        var client = this;
        console.log("AUTH!", device_id);

        return api()
            .base(this.baseUrl)
            .post("/auth")
            .json()
            .send({
                device_id: device_id
            })
            .expectStatus(200)
            .end()
            .then(function (res) {
                client.apiToken = JSON.parse(res.body).token;
            });
    }

    async getOTPCode(uid) {
        var client = this;
        console.log("GET OTP CODE!", uid);
        console.log("[get otp code] this:", this)

        return api()
            .header("Authorization", "Bearer " + client.apiToken)
            .base(client.baseUrl)
            .post("/otp/telegram/code")
            .json()
            .send({
                phone: uid
            })
            .expectStatus(200)
            .end();
    }

    async otpAuth(uid, code) {
        var client = this;
        console.log("OTP AUTH!", uid, code);

        return api()
            .header("Authorization", "Bearer " + client.apiToken)
            .base(baseUrl)
            .post("/otp/telegram/auth")
            .json()
            .send({
                phone: uid,
                code: code
            })
            .expectStatus(200)
            .end();
    }

    async register(uid, password) {
        var client = this;
        console.log("REGISTER!", uid, password)

        return api()
            .header("Authorization", "Bearer " + client.apiToken)
            .base(baseUrl)
            .post("/register")
            .json()
            .send({
                type: "email",
                email: uid,
                password: password,
                name: "Test1"
            })
            .expectStatus(200)
            .end();
    }

    async getProfile() {
        var client = this;
        console.log("PROFILE!")

        var code = "";

        return api()
            .header("Authorization", "Bearer " + client.apiToken)
            .base(baseUrl)
            .get("/profile")
            .json()
            .expectStatus(200)
            .end()
            .then(function (res) {
                console.log("res.body", res.body)
                code = JSON.parse(res.body).user.auths.email.confirmCode;
                console.log("res.user.auths.email.confirmCode:", code)
                client.confirmCode = code;
            });

        return code
    }

    async confirm(uid) {
        var client = this;
        console.log("CONFIRM!", uid, client.confirmCode)

        return api()
            .header("Authorization", "Bearer " + client.apiToken)
            .base(baseUrl)
            .post("/confirm")
            .json()
            .send({
                type: "email",
                uid: uid,
                code: client.confirmCode
            })
            .expectStatus(200)
            .end();
    }
}

var client = new APIClient(baseUrl);

module.exports = client