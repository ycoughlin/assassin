var express = require('express')
var router = express.Router()
var db = require('../models')

router.get('/', function (request, response) {
  response.redirect('browse')
})

router.get('/browse', function (request, response) {
  db.Game.findAll({}).then(function(dbGame){
    var hbsObject = {
      game: dbGame
    }
    response.render('gamebrowser', hbsObject)
  })
})

router.get('/create', function (request, response) {
  response.render('creategame')
})

router.get('/game/id/:id', function (request, response) {
  var hbsObject = {}
  db.Game.findOne({
    where: {
      id: request.params.id
    }
  }).then(function(dbGame) {
    hbsObject['game'] = dbGame
    db.Player.findAll({
      where: {
        GameId: request.params.id
      }
    }).then(function(dbPlayer) {
      hbsObject['player'] = dbPlayer
      // PASTED FROM PLAYER
      db.Player.findAll({
        where: {
          GameId: request.params.id,
          isDead: false
        }
      }).then(function(dbAlive) {
        if(dbAlive.length == 1) {
          hbsObject['win'] = true
        } else {
          hbsObject['win'] = false
        }
        response.render('game', hbsObject)
      })
    })
  })
})

router.get('/admin/:id', function (request, response) {
  var gameId = request.params.id
  var hbsObject = {}
  db.Game.findOne({
    where: {
      id: gameId
    }
  }).then(function(dbGame) {
    db.Player.findAll({
      where: {
        GameId: gameId
      }
    }).then(function(dbPlayer) {
      hbsObject = {
        game: dbGame,
        player: dbPlayer
      }
      response.render('admin', hbsObject)
    })
  })
})

router.get('/player/:name/:gameid', function (request, response) {
  var nameInput = request.params.name
  var gameid = request.params.gameid
  var hbsObject = {}
  db.Player.findOne({
    where: {
      name: nameInput,
      GameId: gameid
    }
  }).then(function(dbPlayer) {
    hbsObject['player'] = dbPlayer
    // check if they are the only one alive (then they win!)
    db.Player.findAll({
      where: {
        GameId: gameid,
        isDead: false
      }
    }).then(function(dbAlive) {
      console.log(`dbAlive.length = ${dbAlive.length}`)
      // If there's one person standing and player viewing page's name
      // is equal to the final person's name, set win to true.
      // if(dbAlive.length === 1 && (dbPlayer.name === dbAlive[0].name) && dbAlive[0].isSuccessful) { // "THERE IS A WINNER.. SOMEWHERE"
      if(dbAlive.length == 1 && dbAlive[0].name == dbAlive[0].target && dbAlive[0].target == dbPlayer.name) { // "THERE IS A WINNER.. SOMEWHERE"
        hbsObject['win'] = true
      } else {
        hbsObject['win'] = false
      }
      response.render('player', hbsObject)
    })
  })
})

router.post('/api/:id/authenticatePlayer', function(request,response) {
  var inputPlayerPass = request.body.password
  var nameInput = request.body.name
  var gameid = request.params.id
  db.Player.findOne({
    where: {
      name: nameInput,
      GameId: gameid
    }
  }).then(function(dbPlayer) {
    console.log(`inputPlayerPass = ${inputPlayerPass}, dbPlayer.password = ${dbPlayer.password}`)
    if(inputPlayerPass == dbPlayer.password) {
      response.redirect(`/player/${nameInput}/${gameid}`)
    }
    response.redirect('back')
  })
})

router.post('/api/authenticateAdmin/:id', function(request, response) {
  var inputAdminPass = request.body.adminpassword
  var gameId = request.params.id
  db.Game.findOne({
    where: {
      id: gameId
    }
  }).then(function(dbGame) {
    if(inputAdminPass == dbGame.adminPassword) {
      response.redirect(`/admin/${dbGame.id}`)
    } else {
      response.redirect('back')
    }
  })
})

router.post('/api/startGame/:id', function(request, response) {
  var gameid = request.params.id
  var weaponList = ['balloon', 'cake', 'croissant', 'friedbutter', 'jarglitter', 'lego', 'unicorn']
  db.Game.update({
    gameIsActive: true
  }, {
    where: {
      id: gameid
    }
  }).then(function(dbGame) {
    db.Player.findAll({
      where: {
        GameId: gameid
      }
    }).then(function(dbPlayer) {
      // This assumes the id's are chronological and won't skip.
      // however, ids are global and auto increment, so they wont necessarily
      // be in order. (ie. 10 ppl join game 1 then 10 ppl join game 2, then 1
      // person joins game 1, that persons id will be 10 off from the first 10 ppl
      // who joined game 1)
      db.Player.update({
        target: dbPlayer[0].name,
        weapon: weaponList[Math.floor(Math.random() * weaponList.length)]
      }, {
        where: {
          id: dbPlayer[dbPlayer.length-1].id,
          GameId: gameid
        }
      }).then(function(result) {
        for(var i = dbPlayer[0].id; i < dbPlayer[dbPlayer.length-1].id; i++) {
          console.log(`i = ${i}\n`)
          db.Player.update({
            target: dbPlayer[i - dbPlayer[0].id + 1].name, // at i = 9  , i - 9 = 0, i = 10, i - 9 = 1
            weapon: weaponList[Math.floor(Math.random() * weaponList.length)]
          }, {
            where: {
              id: i,
              GameId: gameid
            }
          })
        }
        response.redirect(`/admin/${gameid}`)
      })
    })
  })
})

router.post('/api/deleteGame/:id', function(request, response) {
  gameid = request.params.id
  db.Player.destroy({
    where: {
      GameId: gameid
    }
  }).then(function(dbGame) {
    db.Game.destroy({
      where: {
        id: gameid
      }
    }).then(function(dbPlayer) {
      response.redirect('/browse')
    })
  })
})

router.post('/api/addPlayer/:toGameWithid', function(request, response) {
  var inputName = request.body.name
  var playerPass = request.body.password
  var gamePass = request.body.gamepasscode
  var gameid = request.params.toGameWithid
  db.Game.findOne({
    where: {
      id: gameid
    }
  }).then(function(dbGame) {
    // check if player already exists
    db.Player.findOne({
      where: {
        GameId: gameid,
        name: inputName
      }
    }).then(function(entry) {
      if(entry == null) {
        console.log('entry == null')
        // check if passcode is valid
        if(gamePass == dbGame.password) {
          db.Player.create({
            name: inputName,
            password: playerPass,
            GameId: gameid
          }).then(function(result) {
            response.redirect(`back`)
          })
        }
      } else {
        console.log('entry already exists')
        response.redirect(`back`)
      }
    })
  })
})

router.post('/api/sendStatus/:gameid/:playerid', function(request, response) {
  var gameid = request.params.gameid
  var playerid = request.params.playerid
  console.log('success ' + request.body.success + '.')
  console.log('fail ' + request.body.fail + '.')
  // get player info
  db.Player.findOne({
    where: {
      id: playerid,
      GameId: gameid
    }
  }).then(function(dbPlayer) {
    // If player says they killed their target
    // TODO: how can we check if someone has won?
    if(request.body.fail === undefined) {
      // check if target is dead
      db.Player.findOne({
        where: {
          name: dbPlayer.target,
          GameId: gameid
        }
      }).then(function(dbTarget) {
        if(dbTarget.isDead) {
          // if target is dead give assassin their target and weapon
          db.Player.update({
            target: dbTarget.target,
            weapon: dbTarget.weapon
          }, {
            where: {
              id: playerid,
              GameId: gameid
            }
          })
          // update who they were killed by
          db.Player.update({
            killedBy: dbPlayer.name
          }, {
            where: {
              id: dbTarget.id,
              GameId: gameid
            }
          })
        } else {
          // otherwise, just mark player as successful
          db.Player.update({
            isSuccessful: true
          }, {
            where: {
              id: playerid,
              GameId: gameid
            }
          })
        }
      })
    }
    // If player says they died..
    if(request.body.success === undefined) {
      // check if their assassin succeeded,
      db.Player.findOne({
        where: {
          target: dbPlayer.name,
          GameId: gameid
        }
      }).then(function(dbAssassin) {
        if(dbAssassin.isSuccessful) {
          // if assassin succeeded, give them their target and their weapon
          db.Player.update({
            target: dbPlayer.target,
            weapon: dbPlayer.weapon,
            isSuccessful: false
          }, {
            where: {
              id: dbAssassin.id,
              GameId: gameid
            }
          })
          // update who player was killed by
          db.Player.update({
            killedBy: dbAssassin.name,
            isDead: true
          }, {
            where: {
              id: dbPlayer.id,
              GameId: gameid
            }
          })
        } else {
          // otherwise, just mark self as dead
          db.Player.update({
            isDead: true
          }, {
            where: {
              id: playerid,
              GameId: gameid
            }
          })
        }
      })
    }
    console.log('status sent')
    response.redirect('back')
  })
})

router.post('/api/creategame', function(request, response) {
  if (request.body.inputTitle.length < 7) {
    response.redirect('back')
  } else {
    db.Game.create({
      title: request.body.inputTitle,
      location: request.body.inputLocation,
      description: request.body.inputDescription,
      password: request.body.inputPlayerPassword,
      adminPassword: request.body.inputAdminPassword,
      gameIsActive: false,
      gameiIsComplete: false
    }).then(function(dbGame) {
      response.redirect(`/game/id/${dbGame.id}`)
    })
  }
})

module.exports = router