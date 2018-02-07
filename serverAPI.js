const glob = require("glob")
const async = require("async")
const fs = require('fs')
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
const AdmZip = require('adm-zip')
const Discord = require("discord.js");
const client = new Discord.Client();

// Begin Rollback Functions
// type = region or playerdata
// data = {region_coordinates, uuid, username, archive_dir}
// zip = path to zip containing backup
module.exports.rollback = function rollback(type, data, zip) {
  return new Promise(function(resolve, reject){
    var fzip = new AdmZip(zip);
    if (type == 'region') {
      resolve()
    } else if(type == 'playerdata') {
      serv.getUUID(data.username, serv.cleanUUID(data.uuid)).then(dat => {
        resolve({id: dat.uuid, username: dat.username})
        fzip.extractEntryTo('Cookies\\playerdata\\'+dat.uuid+'.dat', /*target path*/"T:/", /*maintainEntryPath*/false, /*overwrite*/true);
      })
    }
  })
}

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

client.login('***REMOVED***');

module.exports.listServerArchives = function listServerArchives(ServerArchiveDir, limit) {
  return new Promise(function(resolve, reject){
    var archiveArray = []
    async.each(glob.sync(ServerArchiveDir+'/**/*.zip*'), function (arc, done) {
      var dir = arc
      if(arc.indexOf('backup.zip') > -1) {
        var arc = arc.slice(0, -11)+'.zip'
      }
      var date = new Date(arc.slice(-23, -19), arc.slice(-18, -16)-1, arc.slice(-15, -13), arc.slice(-12, -10), arc.slice(-9, -7), arc.slice(-6, -4))
      //moment(date).format('dddd Do, MMM YYYY | hh:mm a')
      archiveArray.push({date: date, fromNow: moment(date).fromNow(), dir: dir})
      done()
    }, function() {
      resolve(archiveArray.reverse().slice(0, limit))
    })
  })
}

module.exports.listServerArchiveDirs = function listServerArchiveDirs() {
  return new Promise(function(resolve, reject){
    module.exports.getServerDirs().then(dirArray => {
      var archiveDirArray = []
      async.each(dirArray, function (dir, done) {
        module.exports.getServerVersion(dir.dir).then(version => {
          if (version == '1.7.10') {
            module.exports.getServerFTBUSettings(dir.dir).then(data => {
              archiveDirArray.push({server: dir.dir, backup_folder: data.backups.folder})
              done()
            })
          } else {
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

function getDirectories(path) {
  return fs.readdirSync(path).filter(function (file) {
    return fs.statSync(path+'/'+file).isDirectory();
  });
}

// End Rollback Functions

// Returns a uuid seperated by dashes
module.exports.dirtyUUID = function dirtyUUID(uuid){
  return uuid = [uuid.slice(0, 8), '-', uuid.slice(8, 12), '-', uuid.slice(12, 16), '-', uuid.slice(16, 20), '-', uuid.slice(20)].join('')
}

// Returns a uuid not seperated by dashes
module.exports.cleanUUID = function cleanUUID(uuid) {
  if (!uuid) { return false}
  return uuid.replace(/-/g, '')
}

// Begin Discord Functions

module.exports.getDiscordUserRoles = function getDiscordUserRoles(memberID) {
  return new Promise(function(resolve, reject){
    var promises = []
    client.guilds.get('155507830076604416').members.get(memberID).roles.forEach(function(role) {
      promises.push(new Promise(function(resolve, reject){
        delete role.guild
        resolve(JSON.parse(JSON.stringify(role)))
      }))
    })
    Promise.all(promises).then(data => {
      resolve(data)
    })
  })
}

// End Discord Functions

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

module.exports.checkOptions = function checkOptions(options){
  return new Promise(function(resolve, reject){
    if (!options.name && options.uuid){
      serv.getUUID(options.name, true).then(player => {
        options.name = player.name
        resolve({options: options})
      })
    } else if (options.name && !options.uuid) {
      serv.getUUID(options.name, false).then(player => {
        options.uuid = module.exports.dirtyUUID(player.id)
        resolve({options: options})
      })
    } else {
      resolve({error: 'Missing Username or Player UUID', options: options})
    }
  })
}

module.exports.getPlayerData = function getPlayerData(options, serverDir){
  return new Promise(function(resolve, reject){
    console.log(options);
    var promises = []
    if (options.playerdata) {
      promises.push(new Promise(function(resolve, reject){resolve(module.exports.getNbt(serverDir+'/Cookies/playerdata/'+options.uuid+'.dat'))}))
    }
    if (options.baubles) {
      promises.push(new Promise(function(resolve, reject){resolve(module.exports.getNbt(serverDir+'/Cookies/playerdata/'+options.name+'.baub'))}))
    }
    if (options.thaumcraft) {
      promises.push(new Promise(function(resolve, reject){resolve(module.exports.getNbt(serverDir+'/Cookies/playerdata/'+options.name+'.thaum'))}))
    }
    Promise.all(promises).then(data => {
      resolve(data)
    })
  })
}

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

module.exports.getNbt = function getNbt(fileDir){
  return new Promise(function(resolve, reject){
    console.log(fileDir);
    fs.exists(fileDir,function(exists){
      console.log(exists);
      if (exists){
        fs.readFile(fileDir, function(error, file){
          if(error) reject(error)
          nbtn.parse(file, function(error, nbtData){
            if(error) reject(error)
            resolve(module.exports.cleanNbt(nbtData))
          })
        })
      } else {
        resolve({error: 'No Data'})
      }
    })
  })
}

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

module.exports.getFTBPlayerData = function getFTBPlayerData(options){
  var promises = []
  if (options.player) {
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
  } if (options.team) {
    promises.push(
      new Promise(function(resolve, reject){
        db.get().collection('servers').aggregate(
        {'$unwind': "$ftbData.teams"},
        {'$match': {'ftbData.teams.TeamID': 'rosareven'}},
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

module.exports.getServerVersion = function getServerVersion(serverDir) {
  return new Promise(function(resolve, reject){
    resolve(glob.sync(serverDir+'minecraft_server*.jar')[0].replace(serverDir+'minecraft_server.','').slice(0, -4))
  })
}

module.exports.getServerProperties = function getServerProperties(serverDir) {
  return new Promise(function(resolve, reject){
    properties.parse(serverDir+'server.properties', {path: true}, function(err, properties){
      if (err) reject(err);
      resolve(properties);
    });
  })
}

module.exports.getServerFTBUSettings = function getServerFTBUSettings(dir) {
  return new Promise(function(resolve, reject){
    fs.readFile(dir+'/local/ftbu/config.json', "utf8", function(err, json) {
      resolve(JSON.parse(json))
    });
  })
}

module.exports.getServerName = function getServerName(serverDir){
  return new Promise(function(resolve, reject){
    fs.readFile(serverDir+'start.bat', "utf8", (err, data) => {
      if (err) reject(err);
      resolve(/RawUI.WindowTitle = .*/.exec(data)[0].slice(21, -2));
    });
  })
}

module.exports.getFTBServerData = function getFTBServerData(serverDir, version){
  return new Promise(function(resolve, reject){
    if (version == '1.7.10') {
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
          console.log(err);
          resolve({players: err})
        }
      });
    } else {
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
      console.log(data)
      if(uuid){
        resolve({username: data[data.length-1].name, uuid: serv.dirtyUUID(uuid)})
      } else {
        resolve({username: data.name, uuid: serv.dirtyUUID(data.id)})
      }
    })
  })
}

module.exports.upAllServData = function upAllServData(){
  return new Promise(function(resolve, reject){
    var promises = []
    module.exports.getServerDirs().then(serverArray => {
      async.map(serverArray, function(serverObj, done){
        promises.push(module.exports.upServData(serverObj))
      })
      Promise.all(promises).then(result => {resolve(result)})
    })
  })
}

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
