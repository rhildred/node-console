var express = require('express');
var path = require('path');
var app = express();
var expressWs = require('express-ws')(app);
var os = require('os');
var pty = require('node-pty');
var session = require('express-session');
var https = require('https');
var sess = {
  secret: 'keyboard cat',
  cookie: {}
}
const fetch = require('node-fetch');

app.use(session(sess))

var terminals = {},
    logs = {};


// Define the port to run on
app.set('port', process.env.PORT || parseInt(process.argv.pop()) || 1026);

// Define the Document Root path
var sPath = path.join(__dirname, '.');
var oGithub = require(__dirname + "/github.json");

app.get("/console/", function(req, res, next){
  if(req.session.username){
    next();
  }else{
    return res.redirect("https://github.com/login/oauth/authorize?client_id=" + oGithub.client_id);
  }
});

app.get("/console/oauth2callback", function(req, response){
  sCode = req.query.code;
  console.log(sCode);
  oData = {
    client_id: oGithub.client_id,
    client_secret: oGithub.client_secret,
    code: sCode,
  }
  fetch('https://github.com/login/oauth/access_token', {
  method: 'post',
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(oData)
}).then(res=>res.json())
  .then(res => {
    console.log(res);
    fetch("https://api.github.com/user", {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': "token " + res.access_token
      },      
    }).then(res=>res.json())
    .then(res =>{
      console.log(res);
      sUserName = res.login;
      if(oGithub.logins.includes(sUserName)){
        //then we are in
        req.session.username = sUserName;
        return response.redirect("/console/");
      }else{
        res.statusCode = 401;
        return response.end("unauthorized");  
      }
    });
  });
});

app.use("/console", express.static(sPath));

app.post('/console/terminals', function (req, res) {
  var cols = parseInt(req.query.cols),
      rows = parseInt(req.query.rows),
      term = pty.spawn(process.platform === 'win32' ? 'cmd.exe' : 'bash', [], {
        name: 'xterm-color',
        cols: cols || 80,
        rows: rows || 24,
        cwd: process.env.HOME,
        env: process.env
      });

  console.log('Created terminal with PID: ' + term.pid);
  terminals[term.pid] = term;
  logs[term.pid] = '';
  term.on('data', function(data) {
    logs[term.pid] += data;
  });
  res.send(term.pid.toString());
  res.end();
});

app.post('/console/terminals/:pid/size', function (req, res) {
  var pid = parseInt(req.params.pid),
      cols = parseInt(req.query.cols),
      rows = parseInt(req.query.rows),
      term = terminals[pid];

  term.resize(cols, rows);
  console.log('Resized terminal ' + pid + ' to ' + cols + ' cols and ' + rows + ' rows.');
  res.end();
});

app.ws('/console/terminals/:pid', function (ws, req) {
  var term = terminals[parseInt(req.params.pid)];
  console.log('Connected to terminal ' + term.pid);
  ws.send(logs[term.pid]);

  function buffer(socket, timeout) {
    let s = '';
    let sender = null;
    return (data) => {
      s += data;
      if (!sender) {
        sender = setTimeout(() => {
          socket.send(s);
          s = '';
          sender = null;
        }, timeout);
      }
    };
  }
  const send = buffer(ws, 5);

  term.on('data', function(data) {
    try {
      send(data);
    } catch (ex) {
      // The WebSocket is not open, ignore
    }
  });
  ws.on('message', function(msg) {
    term.write(msg);
  });
  ws.on('close', function () {
    term.kill();
    console.log('Closed terminal ' + term.pid);
    // Clean things up
    delete terminals[term.pid];
    delete logs[term.pid];
  });
});


// Listen for requests
var server = app.listen(app.get('port'), () =>{
  var port = server.address().port;
  console.log('Listening on localhost:' + port);
  console.log("Document Root is " + sPath);
});
