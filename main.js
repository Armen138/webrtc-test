'use strict';
var Peer = function(server, offer) {
    var serverId = null;
    var peerId = Date.now() + '-' +
        ('000' + (Math.random() * 65535 | 0).toString(16)).slice(-4)  + '-' +
        navigator.platform;

    console.log(peerId);

    var RTCPeerConnection = window.webkitRTCPeerConnection || window.mozRTCPeerConnection;
    var network = function(data) { for(var i in data) { network[i] = data[i]; } };

    var channels = {
        send: null,
        receive: null
    };

    var local = new RTCPeerConnection({
            iceServers: [ { url: 'stun:stun.l.google.com:19302' } ]
        }, {
            optional: [ { RtpDataChannels: true } ]
        }
    );
    local.addEventListener('datachannel', function(e) {
        console.log('datachannel got');
        channels.receive = e.channel;
        channels.receive.addEventListener('open', function() {
            network.connected = true;
            fire('connected');
        });
        channels.receive.addEventListener('close', function() {
            network.connected = false;
            fire('disconnected');
        });
        channels.receive.addEventListener('message', function(data) {
            fire('message', data);
        });
    });

    channels.send = local.createDataChannel('sendDataChannel', { reliable: false });

    channels.send.addEventListener('message', function(data) {
        fire('message', data);
    });

    var getRemoteDescription = function(desc) {
        console.log('got remote description');
        local.setRemoteDescription(desc);
    };

    var getDescription = function(desc) {
        console.log('got description');
        local.setLocalDescription(desc);
        if(desc.type === 'answer') {
            server.send(serverId, 'answer', {desc: desc, from: peerId });
        } else {
            server.send(peerId, 'description', desc);
        }
    };

    local.addEventListener('icecandidate', function(e) {
        if(e.candidate) {
            //send candidate to srv
            server.send(peerId, 'candidate', e.candidate);
        }
    });



    var events = {};
    var fire = function(ev, data) {
        if(events[ev]) {
            for (var i = 0; i < events[ev].length; i++) {
                events[ev][i](data);
            }
        }
    };
    network({
        id: peerId,
        role: 'host',
        send: function(data) {
            channels.send.send(data);
        },
        on: function(ev, cb) {
            if(!events[ev]) {
                events[ev] = [];
            }
            events[ev].push(cb);
        },
        accept: function(desc) {
            console.log('accept');
            local.setRemoteDescription(new RTCSessionDescription(desc.desc));
            if(desc.candidate) {
                for(var i = 0; i < desc.candidate.length; i++) {
                    local.addIceCandidate(new RTCIceCandidate(desc.candidate[i]));
                }
            }
        },
        connect: function(data) {
            for(var server in data) {
                var desc = data[server].description[0];
                serverId = server;
                local.setRemoteDescription(new RTCSessionDescription(desc));
                local.createAnswer(getDescription);
                if(data[server].candidate) {
                    for(var i = 0; i < data[server].candidate.length; i++) {
                        local.addIceCandidate(new RTCIceCandidate(data[server].candidate[i]));
                    }
                }
            }
        },
        channels: channels
    });

    if(offer) {
        local.createOffer(getDescription, function() {});
    }
    return network;
};

var srv = {
    send: function(id, type, data) {
        var sending = { id: id, type: type, data: data };
        data = 'q=' + encodeURIComponent(JSON.stringify(sending));
        console.log(data);
        var xhr = new XMLHttpRequest();
        xhr.open('POST', 'http://localhost:8988');
        xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
        xhr.send(data);
    }
};
window.addEventListener('load', function() {
    document.getElementById('host').addEventListener('click', function() {
        var peer = new Peer(srv, true);
        var poll = setInterval(function() {
            var xhr = new XMLHttpRequest();
            xhr.open('GET', 'http://localhost:8988/offers', true);
            xhr.onload = function() {
                var data = JSON.parse(xhr.responseText);
                console.log(data);
                //peer.connect(data);
                if(data[peer.id] && data[peer.id].answer) {
                    var answer = data[peer.id].answer[0];
                    if(data[answer.from] && data[answer.from].candidate) {
                        answer.candidate = data[answer.from].candidate;
                        //for(var i = 0; i < data[answer.from].candidate.length; i++) {

                        //}
                    }
                    peer.accept(answer);
                    clearInterval(poll);
                }
                window.peer = peer;
                peer.on('message', function(msg) {
                    console.log(msg);
                });
            };
            xhr.send(null);
        }, 5000);
    });

    document.getElementById('join').addEventListener('click', function() {
        var peer = new Peer(srv, false);
        var xhr = new XMLHttpRequest();
        xhr.open('GET', 'http://localhost:8988/offers', true);
        xhr.onload = function() {
            var data = JSON.parse(xhr.responseText);
            console.log(data);
            peer.connect(data);
            window.peer = peer;
        };
        xhr.send(null);
        peer.on('message', function(msg) {
            console.log(msg);
        });
    });
});
