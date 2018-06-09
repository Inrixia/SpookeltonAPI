const glob = require("glob")
const async = require("async")
const fs = require('fs-extra')
const nbt   = require('nbt-js')
const nbtn = require('nbt')
const db = require('./db')
const me = require('mongo-escape').escape
const request = require('request')
const properties = require('properties')
const StreamArray = require('./node_modules/stream-json/utils/StreamObject');
const stream = StreamArray.make();
const stringSearcher = require('string-search');
const moment = require('moment');
const AdmZip = require('adm-zip');
const unzip = require('unzip2');
const Discord = require("discord.js");
const http = require ('http');
const Auth = new Discord.Client();
const Echo = new Discord.Client();

var playerDict = {}
var discordArray = []

//--- Begin Discord Functions
// Echo ID: 412266457834192898
// Auth ID: 387098195580289025

Auth.login('***REMOVED***');
Echo.login('***REMOVED***');

//E2E.on('ready', () => {
//	console.log(`E2E Logged in as ${E2E.user.tag}!`);
//	E2E.user.setActivity('Enigmatica 2 Expert 1.18', { type: 'WATCHING' }).catch(console.error);
//})

Echo.on('ready', () => {
	console.log(`Echo Logged in as ${Echo.user.tag}!`);
	Echo.guilds.get('155507830076604416').channels.get('412615383472930816').send('This is indeed running');
	//Echo.guilds.get('155507830076604416').members.forEach(function(guildMember, guildMemberId) {
	   //console.log(guildMember.user.username);
		 //guildMember.setNickname(guildMember.user.username)
	//})
	//Echo.on('messageDelete', message => {
	//	if (message.author.id != 412266457834192898 && message.author.id != 189586642011422721) {
	//		Echo.guilds.get('155507830076604416').channels.get(message.channel.id).send(message+'')
	//	}
	//})
	Echo.on('message', message => {
		if (message.author.id != 412266457834192898) {
			//message.member.setNickname('brian')
			//Echo.on('message', message => {
				//message.member.setNickname(message.member.username)
			//});
			//if (message.author.id != 412266457834192898 && message.channel.id == 412615383472930816) {
			//	Echo.guilds.get('155507830076604416').channels.get('412615383472930816').send(message.author.username+' Said: '+message);

			//if (message.author.id == 208268769452097537) {
			//	message.author.send(''+message);
			//}&& message.author.id == 426011036844556289
			messageString = message+''
			if(messageString.indexOf('!spread') > -1 ) {
				player = messageString.substring(5, messageString.indexOf('!spread')-6)
				if(!playerDict[player]) {
					Echo.guilds.get('155507830076604416').channels.get('210309486341128193').send('!spreadplayers 0 0 10000 50000 true '+player);
					playerDict[player] = new Date();
				} else if(playerDict[player].getTime() < new Date().getTime()-(20*60*1000)) {
					Echo.guilds.get('155507830076604416').channels.get('210309486341128193').send('!spreadplayers 0 0 10000 50000 true '+player);
				} else {
					Echo.guilds.get('155507830076604416').channels.get('210309486341128193').send('Please wait '+(((playerDict[player].getTime()-(new Date().getTime()-(20*60*1000)))/1000/60)+'').substring(0, 5)+' minutes.');
				}
			}
		}
	})
})

Auth.on('ready', () => {
  	console.log(`Auth Logged in as ${Auth.user.tag}!`);
  	serv.upAllServData().then(updateServerMOTD)
});

function updateServerMOTD() {
	db.get().collection('servers').find({}, {'dir': 1, 'properties.motd': 1}).forEach(function(server){
		fs.stat(server.dir+'Cookies/level.dat', (err, data) => {
			if (data) {
				var date1 = new Date();
				var date2 = new Date(data.mtime);
				if(date1-date2 < 5*60*1000){ // If modified less than 5 minutes ago
				   	discordArray[server._id] = new Discord.Client();
				   	discordArray[server._id].login(fs.readFileSync(server.dir+'config/Chikachi/DiscordIntegration.json', 'utf8').slice(31, 90));
				   	discordArray[server._id].on('ready', () => {
				   		console.log(server.dir+` Logged in as ${discordArray[server._id].user.tag}!`);
				   		//console.log(server.properties.motd.replace(/§./g, '').replace(/\n.*/g, '').replace('// Von Spookelton - ', '').replace(' \\\\', ''))
				   		discordArray[server._id].user.setActivity(server.properties.motd.replace(/§./g, '').replace(/\n.*/g, '').replace('// Von Spookelton - ', '').replace(' \\\\', ''), { type: 'WATCHING' })
				   	})
				}
			}
		});
	});
}

// Gets the roles a specific discord user has based of their memberID
module.exports.getDiscordUserRoles = function getDiscordUserRoles(memberID) {
  return new Promise(function(resolve, reject){
    var promises = []
    Auth.guilds.get('155507830076604416').members.get(memberID).roles.forEach(function(role) {
      promises.push(new Promise(function(resolve, reject){
        delete role.guild
        resolve(JSON.parse(JSON.stringify(role)))
      }))
    })
    Promise.all(promises).then(data => {
		db.get().collection('users').update({ _id: memberID }, { $set: {discordRoles: data} }, { upsert: true }, function (err) { // Insert the data as a new document into the games collection
			if(err){console.log(err);}
		});
      resolve(data)
    })
  })
}

//--- End Discord Functions


//--- Begin Giveaway Functions

// Function for modifying a game in a users giveaway list based on discord memberID, giveawayID and gameID
// the steamGameID and giveawayIndex (Priority for that user winning versus other games)
module.exports.userModifyGiveawayGame = function userModifyGiveawayGame(memberID, giveawayID, gameID, gameIndex) {
	return new Promise(function(resolve, reject){
		var query = {}
		query["giveaway."+giveawayID+".applied."+gameID+".index"] = gameIndex
		db.get().collection('users').update({"_id": memberID}, {$set: query}, function(err, data) {
      resolve({err, data})
    })
	})
}

module.exports.addGiveawayGame = function addGiveawwayGame(gameID, giveawayID) {
	return new Promise(function(resolve, reject){
		db.get().collection("giveaway_games").findOne({"_id": gameID}, function(err, data) {
			var query = {}
			query["games."+gameID] = data
			db.get().collection('giveaway').update({"_id": giveawayID}, {$set: query}, {upsert: true}, function(err, data) {
	      resolve({err, data})
	    })
	  });
	})
}

module.exports.indexGame = function indexGame(appid, data) {
	return new Promise(function(resolve, reject){
		db.get().collection("giveaway_games").update({"_id": appid}, {$set: data}, {upsert: true}, function(err, data) {
      		resolve({err, data})
    	})
	})
}

// Remove a giveaway game from a user
module.exports.userRemoveGiveawayGame = function userRemoveGiveawayGame(memberID, giveawayID, gameID) {
	return new Promise(function(resolve, reject){
		var query = {}
		query["giveaway."+giveawayID+".applied."+gameID] = true
		db.get().collection('users').update({"_id": memberID}, {$unset: query}, function(err, data) {
      resolve({err, data})
    })
	})
}

// Create a new giveaway from a date
module.exports.newGiveaway = function newGiveaway() {
	return new Promise(function(resolve, reject){
		var date = new Date()
		db.get().collection('giveaway').update({"_id": date}, {$set: {"_id": date}}, {upsert: true}, function(err, data) {
      resolve({err, data})
    })
	})
}

// Return the current giveaway object
module.exports.getCurrentGiveaway = function getCurrentGiveaway() {
	return new Promise(function(resolve, reject){
		db.get().collection('giveaway').find({}).sort({"_id": -1}).limit(1).toArray(function(err, data){
      resolve(data[0])
    })
	})
}

// Add/Update a game in the giveaway
module.exports.modifyGiveawayGame = function modifyGiveawayGame(giveawayID, gameID, data) {
	return new Promise(function(resolve, reject){
		var query = {}
		query["games."+gameID] = data
		db.get().collection('giveaway').update({"_id": giveawayID}, {$set: query}, function (err, result) {
    	resolve(err)
			if(err){console.log(err);}
		})
		db.get().collection('steam_games_index').update({appid: gameID}, {$set: {"in_giveaway":true}}, function (err) { // Insert the data as a new document into the games collection
			if(err){console.log(err);}
		});
  })
}

// Gets all steamID's for existing games on the steamDB
module.exports.updateGamesIndex = function updateGamesIndex() {
	http.get('http://api.steampowered.com/ISteamApps/GetAppList/v0001/', function(res){
	    var body = '';
	    res.on('data', function(chunk){
	        body += chunk;
	    });
	    res.on('end', function(){
	    	var steamRes = JSON.parse(body);
        db.get().collection('steam_games_index').drop(); // Drop the current gamescore collection
        db.get().collection('steam_games_index').insert(steamRes.applist.apps.app); // Create a new collection with every app that exits
        db.get().collection('steam_games_index').createIndex({name: "text"});
			})
	}).on('error', function(e){
	  console.log("Got an error: ", e);
	});
}

// Gets store data for a steam game
module.exports.getSteamGameData = function getSteamGameData (id) {
	return new Promise(function(resolve, reject){
	  http.get('http://store.steampowered.com/api/appdetails/?appids='+id, function(res){ // Preform http request
	    var body = '';
	    res.on('data', function(chunk){
	        body += chunk;
	    });
	    res.on('end', function(){
	      try {
	        var steamRes = JSON.parse(body); // Prase returned game info into json object
	        steamRes[id].name = steamRes[id].data.name; // Create a new name value at the root of the document
	        delete steamRes[id].data.name; // Delete the old name value in the subdocument data
	        steamRes[id]._id = id; // Set the id of the document to the game id
	        steamRes = steamRes[id]; // Set steamres to equal the updated version and return it
	        resolve(steamRes);
	      } catch (e) {
	        console.log(id, ": is not JSON");
	      }
	    });
	  }).on('error', function(e){
	    console.log("http error: ", e);
	  });
	})
}

//--- End Giveaway Functions


//--- Begin Rollback Functions

// rollbackFiles -> Moves a array of files from a zip to a folder.
module.exports.rollbackFiles = function rollbackFiles(zip, folder, files) {
  return new Promise(function(resolve, reject){
    try {
      if (fs.existsSync(zip) == false) {
        resolve({state: 'Archive zip does not exist!', zip: zip})
      } else {
        var fzip = new AdmZip(zip);
        async.map(files, function(file, done) {
          var file = file.replace(/\//g, '\\') // Replace / with \\ for zip browsing
          if (fzip.getEntry(file) != null) {
            fzip.extractEntryTo(/*file to extract*/file, /*target path*/"T:/", /*maintainEntryPath*/false, /*overwrite*/true);
            done(null, {file: file, zip: zip, state: 'Success'})
          } else {
            done(null, {file: file, zip: zip, state: 'File does not exist within zip!', zipEntry: fzip.getEntry(file)})
          }
        }, function(err, responses) {
          resolve(responses)
        })
      }
    } catch(error) {
      resolve('Error Occoured. You probably cant rollback this server. Soz | BETA Till NAS is setup')
    }
  })
}

// Returns a array of users playerdata files based on a array of uuid&username's
module.exports.get_playerdata_files = function get_playerdata_files(playerArray, serverDir) {
  return new Promise(function(resolve, reject){
    async.map(playerArray, function(player, done){
      player = JSON.parse(player)
      player.files = glob.sync(serverDir+'/Cookies/playerdata/'+serv.dirtyUUID(player.uuid)+'*').concat(glob.sync(serverDir+'/Cookies/playerdata/'+player.name+'*'))
      done(null, player)
    }, function(err, playerArray) {
      resolve(playerArray)
    })
  })
}

// Lists all server archives (zip files) within a archive directory
module.exports.listServerArchives = function listServerArchives(ServerArchiveDir, limit) {
  return new Promise(function(resolve, reject){
    var archiveArray = []
    async.each(glob.sync(ServerArchiveDir+'/**/*.zip*'), function (arc, done) {
      var dir = arc
      if(arc.indexOf('backup.zip') > -1) {
        var arc = arc.slice(0, -11)+'.zip'
      }
      var date = new Date(arc.slice(-23, -19), arc.slice(-18, -16)-1, arc.slice(-15, -13), arc.slice(-12, -10), arc.slice(-9, -7), arc.slice(-6, -4))
      //moment(date).format('dddd Do, MMM YYYY | hh:mm a') // Old moment date formatting which has been moved to clientside for per region date formatting
      archiveArray.push({date: date, fromNow: moment(date).fromNow(), dir: dir})
      done()
    }, function() {
      resolve(archiveArray.reverse().slice(0, limit))
    })
  })
}

// List the directories servers are being archives in based on the ftbUTILS configs of each server.
module.exports.listServerArchiveDirs = function listServerArchiveDirs() {
  return new Promise(function(resolve, reject){
    module.exports.getServerDirs().then(dirArray => { // Get each server directory and work off a array of them
      var archiveDirArray = []
      async.each(dirArray, function (dir, done) {
        module.exports.getServerVersion(dir.dir).then(version => { // Get the server version since 1.7.10 and 1.12 configs are different
          if (version == '1.7.10') {
            module.exports.getServerFTBUSettings(dir.dir).then(data => { // For 1.7.10 its just a json file so its easy to pull the settings data
              archiveDirArray.push({server: dir.dir, backup_folder: data.backups.folder})
              done()
            })
          } else { // For the config file you have to get creative and manually find the string containing the directory
            fs.readFile(dir.dir+'/local/ftbutilities/config.cfg', "utf8", function(err, string) {
              if (string != null) {
                stringSearcher.find(string, 'S:folder=').then(function(resultArr) {
                  archiveDirArray.push({server: dir.dir, backup_folder: resultArr[0].text.replace(/\\/g, '/').slice(17, -1)})
                  done()
                });
              } else {
                done()
              }
            });
          }
        })
      }, function() {
        resolve(archiveDirArray)
      })
    })
  })
}

function getDirectories(path) { // Simple function to find directories within a directory
  return fs.readdirSync(path).filter(function (file) {
    return fs.statSync(path+'/'+file).isDirectory();
  });
}

//--- End Rollback Functions

//--- Begin ServerModifyFunctions

module.exports.wipeRegions = function wipeRegions(serverDir, regionArray) {
	return new Promise(function(resolve, reject){
		regionArray = regionArray.map(region => serverDir+'Cookies/region/r.'+region.x+'.'+ region.z+'.mca');
		var deleteArray = glob.sync(serverDir+'Cookies/region/*').filter(function(region){
			return regionArray.indexOf(region) < 0;
		})
		var date = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '').replace(/:/g, '-')
		var backup_dir = serverDir+'Cookies_Backup/'+date+'/'
		if (fs.existsSync(backup_dir)) {
			deleteArray.forEach(function(region) {
				fs.rename(region, region.replace(serverDir+'Cookies/region/', backup_dir))
			})
		} else {
			fs.mkdir(serverDir+'Cookies_Backup/').then(function(){
				fs.mkdir(backup_dir).then(function(){
					deleteArray.forEach(function(region) {
						fs.rename(region, region.replace(serverDir+'Cookies/region/', backup_dir))
					})
				})
			})
		}
		resolve(true)
	})
}

//--- End ServerModifyFunctions


//--- Begin Raw ServerData Functions

// Returns region object from chunk object {x:xCoord, z:zCoord}
module.exports.chunkRegion = function chunkRegion(chunkObj) {
	return new Promise(function(resolve, reject){
		resolve({'x':Math.floor(chunkObj.x/32.0), 'z':Math.floor(chunkObj.z/32.0)})
	})
}

// Returns array of claimed region coordinates (objects)
module.exports.claimedRegions = function claimedRegions(serverDir) {
	return new Promise(function(resolve, reject){
		db.get().collection('servers').find({dir: serverDir}, {'ftbData.teams': 1}).toArray(function(err, data){
			var promises = []
			data[0].ftbData.teams.forEach(function(team) {
				async.each(team.Data.ftbutilities.ClaimedChunks, function(chunks, done) {
					chunks.forEach(function(chunk) {
	        	promises.push(serv.chunkRegion(chunk))
					})
					done();
				})
      })
			Promise.all(promises).then(regionArray => {
				//resolve(regionArray.filter(
				//	(regionArray, index, self) =>
				//	index === self.findIndex((t) => (
				//		t.x === regionArray.x && t.y === regionArray.y
				//	))
				//))
				resolve(regionArray)
			})
		})
	})
}

// Returns a uuid seperated by dashes
module.exports.dirtyUUID = function dirtyUUID(uuid){
	if (uuid) {
		uuid = serv.cleanUUID(uuid)
		return uuid = [uuid.slice(0, 8), '-', uuid.slice(8, 12), '-', uuid.slice(12, 16), '-', uuid.slice(16, 20), '-', uuid.slice(20)].join('')
	}
}

// Returns a uuid not seperated by dashes
module.exports.cleanUUID = function cleanUUID(uuid) {
  if (!uuid) {return false}
  return uuid.replace(/-/g, '')
}


// Returns a array of players uuid/username based on server FTBUtils Data
// Used over raw file lookups as it allows quick return of uuid and
// playerdata without needing to lookup via the mojang api
module.exports.getServerPlayers = function getServerPlayers(serverDir) {
  return new Promise(function(resolve, reject){
    db.get().collection('servers').aggregate(
    {'$unwind': "$ftbData.players"},
    {'$match': {'dir': serverDir}},
    {'$group': {
        '_id': '$ftbData.players.Name',
        'UUID': {'$last': '$ftbData.players.UUID'}
        }
    }, function(err, data) {
      resolve(data)
    })
  })
}

// Takes in a object with name and uuid, returns a object with whatever is missing
module.exports.getPlayerNameUUID = function getPlayerNameUUID(options){
  return new Promise(function(resolve, reject){
    if (!options.name && options.uuid){
      serv.getUUID(options.uuid, true).then(player => {
        options.name = player.name
        resolve({options: options})
      })
    } else if (options.name && !options.uuid) {
      serv.getUUID(options.name, false).then(player => {
        options.uuid = serv.cleanUUID(player.uuid)
        resolve({options: options})
      })
    } else {
      resolve({error: 'Missing Username or Player UUID', options: options})
    }
  })
}

// Returns a json object containing the playerdata of a user based on their uuid,
// will also return baubles or thaumcraft data if specified
module.exports.getPlayerData = function getPlayerData(options, serverDir){
  return new Promise(function(resolve, reject){
    var promises = []
    if (options.playerdata) {
      promises.push(new Promise(function(resolve, reject){resolve(module.exports.getNbt(serverDir+'Cookies/playerdata/'+serv.dirtyUUID(options.uuid)+'.dat'))}))
    }
    if (options.baubles) {
      promises.push(new Promise(function(resolve, reject){resolve(module.exports.getNbt(serverDir+'Cookies/playerdata/'+options.name+'.baub'))}))
    }
    if (options.thaumcraft) {
      promises.push(new Promise(function(resolve, reject){resolve(module.exports.getNbt(serverDir+'Cookies/playerdata/'+options.name+'.thaum'))}))
    } else {
			promises.push(new Promise(function(resolve, reject){resolve(module.exports.getNbt(serverDir+'Cookies/playerdata/'+serv.dirtyUUID(options.uuid)+'.dat'))}))
			promises.push(new Promise(function(resolve, reject){resolve(module.exports.getNbt(serverDir+'Cookies/playerdata/'+options.name+'.baub'))}))
			promises.push(new Promise(function(resolve, reject){resolve(module.exports.getNbt(serverDir+'Cookies/playerdata/'+options.name+'.thaum'))}))
		}
    Promise.all(promises).then(data => {
      resolve(data)
    })
  })
}

// Function for importing a large json object, not used
module.exports.bulk = function bulk(){
  var objectCount = 0;
  stream.output.on("data", function(object){
    db.get().collection('fim').insert(object.value)
    objectCount ++;
    console.log(objectCount);
  });
  stream.output.on("end", function(){
    console.log("done");
  });
  fs.createReadStream("index.json").pipe(stream.input);
}

// Function for getting and returning NBT data from a file
module.exports.getNbt = function getNbt(fileDir){
  return new Promise(function(resolve, reject){
    fs.exists(fileDir,function(exists){ // Check if the file exists
			console.log(exists, fileDir);
      if (exists){
        fs.readFile(fileDir, function(error, file){ // Read it
          if(error) reject(error)
          nbtn.parse(file, function(error, nbtData){ // Parse the file into NBT data as a json object
            if(error) reject(error)
            resolve(module.exports.cleanNbt(nbtData))
          })
        })
      } else {
        resolve({error: 'File does not exist'})
      }
    })
  })
}

// Function for converting NBT data to json
module.exports.cleanNbt = function cleanNbt(obj){
  if (obj.hasOwnProperty('value')) {
    obj = cleanNbt(obj.value);
  }
  var k;
  if (obj instanceof Object) {
    for (k in obj){
      if (obj[k].hasOwnProperty('value')) {
        obj[k] = cleanNbt(obj[k].value);
      }
      cleanNbt(obj[k]);
    }
  }
  return obj
}

// Returns a players FTBUtils data, and/or their team data from a playername
module.exports.getFTBPlayerData = function getFTBPlayerData(options){
  var promises = []
  if (options.player) { // Returns: uuid, _id (Player Name), and array of servers with ftbData
    promises.push(
      new Promise(function(resolve, reject){
        db.get().collection('servers').aggregate(
        {'$unwind': "$ftbData.players"},
        {'$match': {'ftbData.players.Name': req.query.name}},
        {'$group': {
            '_id': '$ftbData.players.Name',
            'UUID': {'$last': '$ftbData.players.UUID'},
            'servers': {
                '$push': {
                    'serverName': '$name',
                    'version': '$version',
                    'dir': '$dir',
                    'properties': '$properties',
                    'lastSeen': '$ftbData.players.LastTimeSeen',
                    'lastDeath': '$ftbData.players.Data.ftbu:data.LastDeath',
                    'homes_1_7': '$ftbData.players.Homes',
                    'homes': '$ftbData.players.Data.ftbu:data.Homes',
                    'teamID': '$ftbData.players.TeamID',
                    'lastPos': '$ftbData.players.LastPos',
                    'lastItems': '$ftbData.players.LastItems',
                    'stats': '$ftbData.players.Stats',
                    }
                }
            }
        }, function(err, data) {
          resolve(data)
        })
      })
    )
  } if (options.team) { // Returns: _id (Team ID/PlayerName) & array of servers with ftbData & servername
    promises.push(
      new Promise(function(resolve, reject){
        db.get().collection('servers').aggregate(
        {'$unwind': "$ftbData.teams"},
        {'$match': {'ftbData.teams.TeamID': (req.query.name).toLowerCase()}},
        {'$group': {
            '_id': '$ftbData.teams.TeamID',
            'servers': {
                '$push': {
                    'serverName': '$name',
                    'team': '$ftbData.teams'
                    }
                }
            }
        }, function(err, data) {
          resolve(data)
        })
      })
    )
  }
  Promise.all(promises).then(data => {
    for(var i=0; i<data[0][0].servers.length; i++){
      data[0][0].servers[i].team = data[1][0].servers[i]
    }
    resolve(data[0][0])
  })
}

// Returns array of server directories {dir:serverDir} for folders that contain a server.properties file
module.exports.getServerDirs = function getServerDirs() {
  return new Promise(function(resolve, reject){
    var dirArray = []
    async.each(glob.sync("ds/*/*/server.properties", {ignore: 'ds/*/System Volume Information/**'}), function (server, done) {
      dirArray.push({dir:server.slice(0, -17)})
      done()
    }, function() {
      resolve(dirArray)
    })
  })
}

// Find the version of a server based on the minecraft_server.jar file inside a serverDirectory
module.exports.getServerVersion = function getServerVersion(serverDir) {
  return new Promise(function(resolve, reject){
    resolve(glob.sync(serverDir+'minecraft_server*.jar')[0].replace(serverDir+'minecraft_server.','').slice(0, -4))
  })
}

// Import server.properties into a json object and return it
module.exports.getServerProperties = function getServerProperties(serverDir) {
  return new Promise(function(resolve, reject){
    properties.parse(serverDir+'server.properties', {path: true}, function(err, properties){
      if (err) reject(err);
      resolve(properties);
    });
  })
}

// Import FTBU settings into a json object and return it. Only works for 1.7.10-1.10.2 (non .cfg FTBU versions)
module.exports.getServerFTBUSettings = function getServerFTBUSettings(dir) {
  return new Promise(function(resolve, reject){
    fs.readFile(dir+'/local/ftbu/config.json', "utf8", function(err, json) {
      resolve(JSON.parse(json))
    });
  })
}

// Gets a servers name that is set in the start.bat
module.exports.getServerName = function getServerName(serverDir){
  return new Promise(function(resolve, reject){
    fs.readFile(serverDir+'start.bat', "utf8", (err, data) => {
      if (err) resolve(err);
		if(data) {
			resolve(/RawUI.WindowTitle = .*/.exec(data)[0].slice(21, -2));
		} else {
			resolve('Cannot find name')
		}
    });
  })
}

// Get the time the server world data file was last modified
module.exports.getServerWorldLastModified = function getServerWorldLastModified(serverDir){
  return new Promise(function(resolve, reject){
  	fs.stat(serverDir+'Cookies/level.dat', (err, data) => {
		resolve(data.mtime)
	});
  })
}

// Gets FTBData from a server, collating FTB Playerdata and FTB Teams data
module.exports.getFTBServerData = function getFTBServerData(serverDir, version){
  return new Promise(function(resolve, reject){
    if (version == '1.7.10') { // 1.7.10 is easy everything is stored in one file
      fs.readFile(serverDir+'/Cookies/LatMod/LMPlayers.dat', (err, data) => {
        if (err) resolve({players: err});
        try {
          data = (nbt.read(data).payload[''])
          var players = []
          for(var i=1; i<data.LastID; i++){
            players.push(data.Players[i])
          }
          resolve({players: players})
        } catch(err) {
          console.log(err, serverDir);
          resolve({players: err})
        }
      });
    } else { // Other versions store stuff in seperate files
      var playersPromise = new Promise(function(resolve, reject){
        var players = []
        glob(serverDir+'/Cookies/data/ftb_lib/players/*', function(err, files){
          if (err) resolve(err);
          try {
            async.each(files, function(file, done){
              players.push(nbt.read(fs.readFileSync(file)).payload[''])
              done()
            }, function() {
              resolve(players)
            })
          } catch(err) {
            console.log(err);
            resolve(err)
          }
        })
      })
      var teamsPromise = new Promise(function(resolve, reject){
        var teams = []
        glob(serverDir+'/Cookies/data/ftb_lib/teams/*', function(err, files){
          if (err) resolve(err);
          try {
            async.each(files, function(file, done){
              team = nbt.read(fs.readFileSync(file)).payload['']
              team.TeamID = file.slice((serverDir+'/Cookies/data/ftb_lib/teams/').length - 1,-4)
              teams.push(team)
              done()
            }, function() {
              resolve(teams)
            })
          } catch(err) {
            console.log(err);
            resolve(err)
          }
        })
      })
      Promise.all([playersPromise, teamsPromise]).then(data => {
        resolve({players: data[0], teams: data[1]})
      })
    }
  })
}

// Returns a uuid or a username depending on what is given
module.exports.getUUID = function getUUID(username, uuid){
  return new Promise(function(resolve, reject){
    if (username) {
      url = 'https://api.mojang.com/users/profiles/minecraft/'+username
    } else {
      url = 'https://api.mojang.com/user/profiles/'+uuid+'/names'
    }
    request.get({
      url: url,
      json: true,
    }, (err, res, data) => {
      if(uuid){
        resolve({username: data[data.length-1].name, uuid: serv.dirtyUUID(uuid)})
      } else {
        resolve({username: data.name, uuid: serv.dirtyUUID(data.id)})
      }
    })
  })
}



// Updates all server data for old and new servers
module.exports.upAllServData = function upAllServData(){
  return new Promise(function(resolve, reject){
    var promises = []
    module.exports.getServerDirs().then(serverArray => {
      async.map(serverArray, function(serverObj, done){
        promises.push(module.exports.upServData(serverObj))
        done()
      })
      Promise.all(promises).then(result => {resolve(result)})
    })
  })
}

// Updates server data for a single server
module.exports.upServData = function upServData(serverObj){
  return new Promise(function(resolve, reject){
    var promises = [
      module.exports.getServerName(serverObj.dir),
      module.exports.getServerProperties(serverObj.dir),
      module.exports.getServerVersion(serverObj.dir),
    ]
    Promise.all(promises).then(data => {
      serverObj.name = data[0]
      serverObj.properties = data[1]
      serverObj.version = data[2]
      module.exports.getFTBServerData(serverObj.dir, serverObj.version).then(ftbData => {
        serverObj.ftbData = me(ftbData)
        db.get().collection('servers').update({ dir: serverObj.dir},{ $set: serverObj }, { upsert: true }, function (err) { // Insert the data as a new document into the games collection
          if(err){resolve({'server': serverObj.dir, 'status': err}), console.log(err);}
          resolve({server: serverObj.dir, status: 'Completed!'})
        });
      })
    })
  })
}
