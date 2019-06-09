var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var convert = require('color-convert');

function randint(min, max) {
    return min + Math.floor(Math.random() * (max-min));
}

function randomColor() {
    return '#'+convert.hsl.hex([randint(0,256), randint(50,200), randint(150,256)]);
}

function rgbToHex(r, g, b) {
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

function usernameTaken(i, username) {
    var keys = Object.keys(list);
    var taken = false;
    keys.forEach(function (iid) {
        if (i !== iid && list[iid].name.toLowerCase() === username.toLowerCase())
            taken = true;
    });
    return taken;
}

function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

app.get('/', function (req, res) {
    res.sendFile(__dirname + '/chat.html');
});

var list = {};

io.on('connection', function (socket) {
    socket.iid = randint(9999999);
    socket.name = 'anonymous#' + ('0000' + randint(0,9999)).slice(-4);
    socket.color = randomColor();
    list['u'+socket.iid] = socket;
    console.log(socket.name + ' connected');
    socket.emit('chat message', {
        color: '#fff',
        name: '',
        text: 'Welcome to the server'
    });
    setTimeout(function(){
        socket.emit('new name', socket.name);
        socket.emit('new color', socket.color);
    },1000);
    io.emit('chat message', {
        color: '#fff',
        name: '',
        text: '<span style="color:' + socket.color + '">' + escapeHtml(socket.name) + '</span> connected.'
    });
    socket.on('disconnect', function () {
        delete list['u'+socket.iid];
        console.log(socket.name + ' disconnected');
        io.emit('chat message', {
            color: '#fff',
            name: '',
            text: '<span style="color:' + socket.color + '">' + escapeHtml(socket.name) + '</span> disconnected.'
        });
    });
    socket.on('chat message', function (msg) {
        if (!msg.trim())
            return;
        console.log(socket.name + '>' + msg);
        if (msg[0] === '/') {
            switch (msg.split(' ')[0]) {
                case '/help':
                    socket.emit('chat message', {
                        color: '#fff',
                        name: '',
                        text: '' +
                        'List of commands :<br>' +
                        '<b>/color (color)</b> : change color (random if blank)<br>' +
                        '<b>/img [url]</b> : show image<br>' +
                        '<b>/list</b> : list users<br>' +
                        '<b>/me</b> : express yourself<br>' +
                        '<b>/nick [username]</b> : change username<br>'
                    });
                    break;
                case '/color':
                    var arg1 = msg.split(' ')[1];
                    if (arg1 && /^#[0-9a-fA-F]{3,6}|[a-zA-Z-_]*$/.test(arg1)) {
                        socket.color = arg1;
                    } else {
                        socket.color = randomColor();
                    }
                    socket.emit('chat message', {
                        color: '#fff',
                        name: '',
                        text: 'Your new color is <span style="color:' + socket.color + '">' + escapeHtml(socket.color) + '</span>.'
                    });
                    socket.emit('new color', socket.color);
                    break;
                case '/img':
                    var arg1 = msg.split(' ')[1];
                    if(!arg1){
                        socket.emit('chat message', {
                            color: '#f00',
                            name: '',
                            text: 'Please specify url'
                        });
                    }else{
                        io.emit('chat message', {
                            color: '#fff',
                            name: '',
                            text: '<span style="color:' + socket.color + '">' + escapeHtml(socket.name) + '</span><br><br>' +
                            '<img title="'+escapeHtml(arg1)+'" src="'+encodeURI(arg1)+'"/>'
                        });
                    }
                    break;
                case '/list':
                    var keys = Object.keys(list);
                    var text = keys.length + ' users :';
                    keys.forEach(function (iid) {
                        var m = list[iid];
                        text += '<br>&gt;&nbsp;<span style="color:' + m.color + '">' + escapeHtml(m.name) + '</span>'
                    });
                    socket.emit('chat message', {
                        color: '#fff',
                        name: '',
                        text: text
                    });
                    break;
                case '/nick':
                    var name = msg.trim().substr(msg.indexOf(' ') + 1);
                    if (name) {
                        name = name.substr(0,200);
                        if (!usernameTaken(socket.iid, name)) {
                            var oldname = socket.name;
                            socket.name = name;
                            io.emit('chat message', {
                                color: '#fff',
                                name: '',
                                text: '<span style="color:' + socket.color + '">' + escapeHtml(oldname) + '</span> is now <span style="color:' + socket.color + '">' + escapeHtml(socket.name) + '</span>.'
                            });
                            socket.emit('new name', socket.name);
                        } else {
                            socket.emit('chat message', {
                                color: '#f00',
                                name: '',
                                text: 'Username already taken'
                            });
                        }
                    } else {
                        socket.emit('chat message', {
                            color: '#f00',
                            name: '',
                            text: 'Please specify username'
                        });
                    }
                    break;
                case '/me':
                    io.emit('chat message', {
                        color: socket.color,
                        name: '',
                        text: '*<b>' + escapeHtml(socket.name) + '</b> ' + escapeHtml(msg.trim().substr(msg.indexOf(' ') + 1)) + '*'
                    });
                    break;
                default:
                    socket.emit('chat message', {
                        color: '#f00',
                        name: '',
                        text: 'Unknown command ' + msg.split(' ')[0] + '<br/>type /help for list of commands'
                    });
                    break;
            }
        } else {
            io.emit('chat message', {
                color: socket.color,
                name: socket.name,
                text: msg.substr(0,2000)
            });
        }
    });
});

http.listen(3000, function () {
    console.log('listening on *:3000');
});