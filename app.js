const logger = require('morgan'),
express  = require('express'),
session  = require('express-session'),
passport = require('passport'),
DiscordStrategy = require('passport-discord').Strategy,
MongoStore = require('connect-mongo')(session);
app = express(),
http = require('http'),
where = require('node-where'),
db = require('./db'),
serv = require('./serverAPI')
nbt = require('nbt'),
nbtjs = require('nbt-js');
fs = require('fs'),
async = require('async'),
scopes = ['identify'];

app.set('view engine', 'ejs');
app.use(express.static(__dirname + '/public'));
app.use(logger('dev'))

passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(user, done) {
  done(null, user);
});

passport.use(new DiscordStrategy({
    clientID: '387098195580289025',
    clientSecret: '***REMOVED***',
    callbackURL: 'http://spookelton.net:25565/callback',
    scope: scopes
}, function(accessToken, refreshToken, profile, done) {
    process.nextTick(function() {
        return done(null, profile);
    });
}));

app.use(session({
  secret: '***REMOVED***',
  saveUninitialized: false, // don't create session until something stored
  resave: false, //don't save session if unmodified
  store: new MongoStore({
    url: 'mongodb://Administrator:***REMOVED***@localhost:27117/spookelton?authSource=admin',
    touchAfter: 24 * 3600 // time period in seconds [24 Hours]
  })
}));
app.use(passport.initialize());
app.use(passport.session());

function checkAuth(rank, req, res, next) {
  if (req.isAuthenticated() && req.user.id != null) return next();
  res.redirect('/login');
}

function checkAdminAuth(req, res, next) {
  req.session.returnTo = req.path;
  if (req.isAuthenticated() && req.user.id) {
    serv.getDiscordUserRoles(req.user.id).then(roles => {
      if(roles.some(function(role){
        if (role.id == '278046497789181954') {return true}
        return false
      })) {
        return next();
      } else {res.render('403.ejs', {type: '<span style="color: #FF00F2;">Admins</span>'})}
    })
  } else {res.render('403.ejs', {type: '<span style="color: #FF00F2;">Admins</span>'})}
}

app.get('/login', passport.authenticate('discord', { scope: scopes }), function(req, res) {});
app.get('/callback',
    passport.authenticate('discord', { failureRedirect: '/login' }), function(req, res) {
      res.redirect(req.session.returnTo || '/giveaway');
      serv.getDiscordUserRoles(req.user.id).then(roles => {
        where.is(req.ip, function(err, result){
          data = {
            discord: req.user,
            ip: req.ip,
            location: result.attributes,
            discordRoles: roles
          }
          db.get().collection('users').update({ _id: req.user.id }, { $set: data }, { upsert: true }, function (err) { // Insert the data as a new document into the games collection
            if(err){console.log(err);}
          });
        })
      })
    } // auth success
);

app.get('/admin/giveaway', checkAdminAuth, function(req, res) {
  res.render('admin/giveaway')
})

app.get('/giveaway', function(req, res) {
  serv.getCurrentGiveaway().then(data => {
		res.render('giveaway', { games: data.games, user: req.user });
	})
})

//app.get('/bulk', function(req, res) {
//  serv.bulk()
//  res.send('Working')
//})

app.get('/reset', checkAdminAuth, function(req, res) {
  //serv.updateGamesIndex()
})

app.get('/admin/api/update', checkAdminAuth, function(req, res) {
  serv.upAllServData().then(result =>{
    res.json(result)
  })
})

app.get('/admin/api/dump', checkAdminAuth, function(req, res) {
  db.get().collection('servers').find({}).toArray(function(err, data){
    res.json(data);
  })
});

app.get('/admin/api/listServerDirs', checkAuth, function(req, res) {
  serv.getServerDirs().then(dirArray => {
    res.json(dirArray)
  })
})

app.get('/admin/api/listServerArchiveDirs', checkAuth, function(req, res) {
  serv.listServerArchiveDirs().then(dirArray => {
    res.json(dirArray)
  })
})

app.get('/admin/api/listServerArchives', checkAuth, function(req, res) {
  serv.listServerArchives(req.query.dir, req.query.limit).then(archives => {
    res.json(archives)
  })
})

app.get('/admin/api/listClaimedRegions', checkAdminAuth, function(req, res) {
  if (!req.query.server){
    db.get().collection('servers').find({}, {dir: 1, name: 1, _id: 0}).toArray(function(err, serverArray){
      res.json({error: 'Missing Server', servers: serverArray})
    })
  } else {
		serv.upAllServData().then(result =>{
			serv.claimedRegions(req.query.server).then(data => {
				res.json(data)
			})
		})
  }
})

app.get('/admin/api/wipeRegions', checkAdminAuth, function(req, res) {
  if (!req.query.server){
    db.get().collection('servers').find({}, {dir: 1, name: 1, _id: 0}).toArray(function(err, serverArray){
      res.json({error: 'Missing Server', servers: serverArray})
    })
  } else {
		serv.upAllServData().then(result =>{
			serv.claimedRegions(req.query.server).then(regionArray => {
				serv.wipeRegions(req.query.server, regionArray).then(status => {
					res.json(status)
				})
			})
	  })
  }
})

app.get('/admin/api/rollback', checkAdminAuth, function(req, res) {
  console.log(req.query)
  serv.rollback(req.query.type, {uuid: req.query.uuid, username: req.query.username}, req.query.zip).then(response => {
    res.json(response)
  })
})

app.get('/admin/rollback', checkAdminAuth, function(req, res) {
  var data = {}
  serv.upAllServData().then(result =>{
    serv.listServerArchiveDirs(req.query.dir, req.query.limit).then(archiveFolders => {
      res.render('admin/rollback', {servers: archiveFolders})
    })
  })
})

app.get('/admin/api/playerdata', checkAuth, function(req, res) {
  var options = {
    name: req.query.name,
    uuid: serv.cleanUUID(req.query.uuid),
    playerdata: req.query.playerdata,
    baubles: req.query.baubles,
    thaumcraft: req.query.thaumcraft,
    ftb: req.query.ftb
  }
  serv.getPlayerNameUUID(options).then(opt => {
    if (opt.error) res.send(opt.error)
    if (!req.query.server){
      db.get().collection('servers').find({}, {dir: 1, name: 1, _id: 0}).toArray(function(err, serverArray){
        res.json({error: 'Missing Server', servers: serverArray})
      })
    } else {
      serv.getPlayerData(opt.options, req.query.server).then(data => {
        res.json(data);
      })
    }
  })
});

app.get('/', function(req, res){
  res.render('index')
})

app.get('/logout', function(req, res) {
    req.logout();
    res.redirect('/giveaway');
});

app.get('/info', checkAuth, function(req, res) {
    where.is(req.ip, function(err, result){
      data = {
        discord: req.user,
        ip: req.ip,
        location: result.attributes
      }
      db.get().collection('users').update({ _id: req.user.id }, { $set: data }, { upsert: true }, function (err) { // Insert the data as a new document into the games collection
        if(err){console.log(err);}
      });
      res.json(data);
    })
});

module.exports = app;
