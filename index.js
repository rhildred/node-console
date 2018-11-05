var express = require('express');
var path = require('path');
var app = express();

// Define the port to run on
app.set('port', process.env.PORT || parseInt(process.argv.pop()) || 8080);

// Define the Document Root path
var aPath = path.join(__dirname, '.').split(path.sep);
aPath.pop()
var sPath = aPath.join(path.sep) + "/jekyll-admin-example" + path.sep + "_site";

app.use(express.static(sPath));

// Listen for requests
var server = app.listen(app.get('port'), () =>{
  var port = server.address().port;
  console.log('Listening on localhost:' + port);
  console.log("Document Root is " + sPath);
});