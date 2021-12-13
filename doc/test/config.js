var env = process.env.ENV || "";

var baseUrl;
var specFile;

switch (env) {
  case "local":
    // local
    baseUrl = "http://localhost:8080";
    specFile = process.env.GOPATH + "/src/github.com/rosberry/rauther/doc/swagger.yaml";
    break;
  default:
    // custom
    baseUrl = process.env.BASE_URL || "";
    specFile = process.env.SPEC_FILE || "";

    if (baseUrl == "" || specFile == "") {
      console.error('Please set BASE_URL and SPEC_FILE env variables');
      process.exit();
      return;
    }
}

var config = {
    baseUrl: baseUrl,
    specFile: specFile
};

console.log("Selected environment: " + env);

module.exports = config
