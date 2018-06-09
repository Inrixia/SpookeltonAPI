const io = require('socket.io')(),
db = require('./db'),
serv = require('./serverAPI');
//ioClient = require('socket.io-client');
var uid = [];

io.on('connection', function (socket) {
	socket.on('game_search', function (search) {
	  db.get().collection('steam_games_index').find( { $text: { $search: search } }, { appid: 1, name: 1, in_giveaway: 1 } ).toArray(function(err, info) { // Find from GameCollection where game name matches textbox search
	    socket.emit('return_game_search', { info });
	  })
	});

	socket.on('get_server_archives', function (data) {
	  serv.listServerArchives(data.server, data.limit).then(archives => {
	    socket.emit('return_server_archives', archives);
	  })
	});

	socket.on('get_server_playerdata_files', function (serverDir) {
	  serv.getServerPlayers(serverDir).then(serverPlayers => {
	    socket.emit('return_server_playerdata_files', serverPlayers);
	  })
	});

	socket.on('get_playerdata_files', function(data){
	  serv.get_playerdata_files(data.playerArray, data.serverDir).then(playerArray => {
	    socket.emit('return_get_playerdata_files', playerArray)
	  })
	})

	socket.on('game_patron_change', function(game){
		serv.getCurrentGiveaway().then(giveaway => {
			serv.modifyGiveawayGame(giveaway._id, game._id, game).then(err => socket.emit('return_game_patron_change', err))
		})
	})

	socket.on('game_delete', function(appid){
		serv.getCurrentGiveaway().then(giveaway => {
			serv.deleteGiveawayGame(giveaway._id, appid).then(err => socket.emit('return_game_delete', err))
		})
	})

	socket.on('giveaway_sub_game', function(data) {
		serv.subGiveawayGame(data.gameID, data.memberID, data.subIndex).then(info => {
			socket.emit('return_giveaway_sub_game', info)
		})
	})

	socket.on('giveaway_unsub_game', function(data) {
		serv.unsubGiveawayGame(data.gameID, data.memberID).then(info => {
			socket.emit('return_giveaway_unsub_game', info)
		})
	})

	socket.on('game_add', function(appid){
		serv.getSteamGameData(appid).then(data => {
			serv.indexGame(appid, data).then(
				serv.getCurrentGiveaway().then(giveaway => {
					serv.addGiveawayGame(appid, giveaway._id).then(err => {
						socket.emit('return_game_add', err)
					})
				})
			)
		})
	})

	//serv.modifyGiveawayGame(data[0].data._id, appid, data[0]).then(err => {
	//	socket.emit('return_game_add', err)
	//})

  socket.on('rollback_files', function (data) {
    serv.rollbackFiles(data.zip, data.server, data.files).then(response => {
      socket.emit('return_rollback_files', response)
    })
  });

});

  /*
  socket.on('DepositReturn', function (data) {
    console.log(data);
    //console.log(uid[data.sid]);
    if (data.stat == 'Declined') {
      db.get().collection('users').update({ _id: uid[data.sid].uid }, { $inc: { credits: +uid[data.sid].sum } }, { upsert: true }, function (err, result) {
        if (err) {
          console.log("ERROR: ", err);
        };
      });
      io.to(uid[data.sid].id).emit('r-deposit', { status: ('Trade ' + data.stat + ', Credits Deposited!') });
    } else {
      io.to(uid[data.sid].id).emit('r-deposit', { status: ('Trade ' + data.stat + ', Deposit Canceled!') });
    }
  });

  socket.on('checkout', function (data) {
    cart = JSON.parse(data.cart);
    id = cart[0].gameid;
    db.get().collection('games').findOne({ _id: id }, { storage: 1 }, function(err, data) {
      asset = data.storage[0];
      console.log(asset);
      SendGift(asset, 'catohenshall@gmail.com', 'FancyPants', 'Hi There, Take this!', 'A Person', 0, function (ret) {
        console.log(ret);
        //db.get().collection('games').findOne({ _id: id }, { storage: 1 }, function(err, data) {
        //  console.log(data);
        //});
      });
    });
  });

  socket.on('deposit', function (data) {
    var total = 0;
    async.map(data.items, processItem, function(err, results){
      db.get().collection('users').find({ _id: data.id }, { turl: 1 }).toArray(function(err, info) {
        if (typeof info[0].turl == 'undefined') {
          socket.emit('r-deposit', { status: 'No Token Set!'});
        } else {
          socket.emit('r-deposit', { status : 'Trade processing....'});
          SendRequest(data.id, info[0].turl, data.items, data.uuid, socket.id, function (ret) {
            socket.emit('r-deposit', { status: ret.info });
            uid[ret.id] = { id: socket.id, sum: total, uid: data.id };
          });
        }
      })
    });
    function processItem(item, callback){
      db.get().collection('prices').find({ name: item.name }, { safe_price: 1 }).toArray(function(err, stat){
        //item.safe_price = (stat[0].safe_price * 0.72 * 100).toFixed(0);
        total += (stat[0].safe_price * 0.72 * 100).toFixed(0) - 0;
        callback();
      })
    }
  });

  socket.on('tur', function (data) {
    console.log(data);
    db.get().collection('users').update({ _id: data.id }, { $set: data }, { upsert: true }, function (err, result) {
      if (err) {
        console.log("ERROR: ", err);
      } else {
        socket.emit('r-tur');
      };
    });
  });

  socket.on('cart-update', function (data) {
    console.log('wha');
    idl = data.id;
    var object = {};
    object[idl] = 1;
    console.log(object);
    db.get().collection('users').update({ _id: data.id }, { $addToSet: { cart: data } }, { upsert: true }, function (err, result) {
      if (err) {
        console.log("ERROR: ", err);
        socket.emit('cart-updated', { err: 'A Error Occoured!' });
      } else {
        console.log('done', data);
        socket.emit('cart-updated', { return: 'In Cart' });
      };
    });
  });

  socket.on('cart-remove', function (data) {
    console.log(data);
    db.get().collection('users').update( { _id: data.id }, { $pull: { cart: { gameid: data.gameid } } }).then(function() {
      socket.emit('cart-return');
    })
  });

function SendRequest(userID, Token, Items, uuid, sid, Inv) {
  request.post(
    'http://localhost:3001/st',
    { json: { id: userID, tok: Token, ims: Items, uuid: uuid, sid: sid } },
    function (error, response, body) {
      console.log(response.statusCode, body);
      if (!error && response.statusCode == 200) {
        Inv(body);
      }
    }
  );
};

function SendGift(id, email, name, message, signature, bot, back) {
  request.post(
    'http://localhost:3001/g',
    { json: { id: id, email: email, name: name, message: message, signature: signature, bot: bot } },
    function (error, response, body) {
      if (!error && response.statusCode == 200) {
        back(body);
      }
    }
  );
};
*/

module.exports = io;
