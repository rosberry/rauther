var env = process.env.ENV || "local";

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

var config = {
    baseUrl: baseUrl,
    specFile: specFile
};

console.log("Selected environment: " + env);

module.exports = config
