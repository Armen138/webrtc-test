var express = require('express');
var bodyParser = require('body-parser');
var app = express();
var candidates = [];
var offers = {};
var answers = {};
app.use(bodyParser());

app.get('/', function(req, res) {
    res.send('oi');
});

app.post('/', function(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    console.log('something something');
    console.log(req.body);
    candidates.push(req.body.q);
    var data = JSON.parse(req.body.q);
    if(!offers[data.id]) {
        offers[data.id] = {};
    }
    if(!offers[data.id][data.type]) {
        offers[data.id][data.type] = [];
    }
    offers[data.id][data.type].push(data.data);
    res.send('something something');
});

app.get('/offers', function(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.send(JSON.stringify(offers));
});

app.listen(8988);
