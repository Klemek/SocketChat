const app = require('express')();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const convert = require('color-convert');

function randint(min, max) {
  return min + Math.floor(Math.random() * (max - min));
}

function randomColor() {
  return '#' + convert.hsl.hex([randint(0, 256), randint(50, 200), randint(150, 256)]);
}

function usernameTaken(list, username) {
  return Object.values(list).filter(m => m.name.toLowerCase() === username.toLowerCase()).length > 0;
}

function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function connectUser(list, socket) {
  const iid = randint(0, 9999999);
  const u = {
    name: 'anonymous#' + ('0000' + randint(0, 9999)).slice(-4),
    color: randomColor()
  };
  list[iid] = u;
  console.log(u.name + ' connected');
  socket.emit('chat message', {
    color: '#fff',
    name: '',
    text: 'Welcome to the server'
  });
  setTimeout(function () {
    socket.emit('new name', u.name);
    socket.emit('new color', u.color);
  }, 1000);
  io.emit('chat message', {
    color: '#fff',
    name: '',
    text: '<span style="color:' + u.color + '">' + escapeHtml(u.name) + '</span> connected.'
  });
  return iid;
}

function disconnectUser(list, iid) {
  const u = list[iid];
  if (!u)
    return;
  delete list[iid];
  console.log(u.name + ' disconnected');
  io.emit('chat message', {
    color: '#fff',
    name: '',
    text: '<span style="color:' + u.color + '">' + escapeHtml(u.name) + '</span> disconnected.'
  });
}

function userAction(list, iid, socket, msg) {
  const u = list[iid];
  if (!u) {
    socket.emit('chat message', {
      color: '#f00',
      name: '',
      text: 'You are not registered on the server'
    });
    return;
  }
  if (!msg.trim())
    return;
  console.log(u.name + '>' + msg);
  if (msg[0] === '/') {
    const arg1 = msg.split(' ')[1];
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
        if (arg1 && /^#[0-9a-fA-F]{3,6}|[a-zA-Z-_]*$/.test(arg1)) {
          u.color = arg1;
        } else {
          u.color = randomColor();
        }
        socket.emit('chat message', {
          color: '#fff',
          name: '',
          text: 'Your new color is <span style="color:' + u.color + '">' + escapeHtml(u.color) + '</span>.'
        });
        socket.emit('new color', u.color);
        break;
      case '/img':
        if (!arg1) {
          socket.emit('chat message', {
            color: '#f00',
            name: '',
            text: 'Please specify url'
          });
        } else {
          io.emit('chat message', {
            color: '#fff',
            name: '',
            text: '<span style="color:' + u.color + '">' + escapeHtml(u.name) + '</span><br><br>' +
              '<img alt="' + encodeURI(arg1) + '" title="' + escapeHtml(arg1) + '" src="' + encodeURI(arg1) + '"/>'
          });
        }
        break;
      case '/list':
        const keys = Object.keys(list);
        let text = keys.length + ' users :';
        keys.forEach(function (iid2) {
          const m = list[iid2];
          text += '<br>&gt;&nbsp;<span style="color:' + m.color + '">' + escapeHtml(m.name) + '</span>'
        });
        socket.emit('chat message', {
          color: '#fff',
          name: '',
          text: text
        });
        break;
      case '/nick':
        let name = msg.trim().substr(msg.indexOf(' ') + 1);
        if (name) {
          name = name.substr(0, 200);
          if (!usernameTaken(list, name)) {
            let oldname = u.name;
            u.name = name;
            io.emit('chat message', {
              color: '#fff',
              name: '',
              text: '<span style="color:' + socket.color + '">' + escapeHtml(oldname) + '</span> is now <span style="color:' + u.color + '">' + escapeHtml(u.name) + '</span>.'
            });
            socket.emit('new name', u.name);
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
          color: u.color,
          name: '',
          text: '*<b>' + escapeHtml(u.name) + '</b> ' + escapeHtml(msg.trim().substr(msg.indexOf(' ') + 1)) + '*'
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
      color: u.color,
      name: u.name,
      text: msg.substr(0, 2000)
    });
  }
}

app.get('/', function (req, res) {
  res.sendFile(__dirname + '/chat.html');
});

const list = {};

io.on('connection', function (socket) {
  const iid = connectUser(list, socket);

  socket.on('disconnect', function () {
    disconnectUser(list, iid);
  });
  socket.on('chat message', function (msg) {
    userAction(list, iid, socket, msg);
  });
});

http.listen(3000, function () {
  console.log('listening on *:3000');
});