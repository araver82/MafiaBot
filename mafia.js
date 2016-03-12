"use strict";

var config = require('./config.js');
var _ = require('lodash');
var store = require('node-persist');
var Discord = require('discord.js');

// init stuff
store.initSync();
var defaults = {
    channelsActivated: [],
    games: [],
};
_.each(defaults, (val, key) => {
    var objWithDefaults = _.merge({}, {[key]: val}, {[key]: store.getItem(key)});
    store.setItem(key, objWithDefaults[key]);
});
var mafiabot = new Discord.Client();

// utilities
var adminCheck = message => {
    if (config.admins.indexOf(message.author.id) >= 0) {
        return true;
    }
    mafiabot.reply(message, `You must be an admin to perform command *${message.content}*!`);
    return false;
};
var activatedCheck = message => {
    return store.getItem('channelsActivated').indexOf(message.channel.id) >= 0;
}
var listUsers = listOfUserIds => {
    var output = '';
    for (var i = 0; i < listOfUserIds.length; i++) {
        output += `\n${i + 1}. <@${listOfUserIds[i]}>`;
    }
    return output;
}
var printCurrentPlayers = channelId => {
    var currentGames = store.getItem('games');
    var gameInChannel = _.find(currentGames, {channelId: channelId});
    if (gameInChannel) {
        var output = `Currently ${gameInChannel.players.length} players in game hosted by <@${gameInChannel.hostId}>:${listUsers(_.map(gameInChannel.players, 'id'))}`;
        mafiabot.sendMessage(channelId, output);
        return true;
    }
    return false;
}
var printUnconfirmedPlayers = channelId => {
    var currentGames = store.getItem('games');
    var gameInChannel = _.find(currentGames, {channelId: channelId});
    if (gameInChannel) {
        var unconfirmedPlayers = _.filter(gameInChannel.players, {confirmed: false});
        var output = unconfirmedPlayers.length 
            ? `${unconfirmedPlayers.length} players still need to ##confirm for game hosted by <@${gameInChannel.hostId}>:${listUsers(_.map(unconfirmedPlayers, 'id'))}`
            : `All players confirmed for game hosted by <@${gameInChannel.hostId}>!`
            ;
        mafiabot.sendMessage(channelId, output);
        return true;
    }
    return false;
}
var printDayState = channelId => {
    var currentGames = store.getItem('games');
    var gameInChannel = _.find(currentGames, {channelId: channelId});
    if (gameInChannel && gameInChannel.day > 0) {
        mafiabot.sendMessage(channelId, 
`It is currently **${gameInChannel.state == STATE.DAY ? 'DAY' : 'NIGHT'} ${gameInChannel.day}** in game hosted by <@${gameInChannel.hostId}>!
**${gameInChannel.players.length} alive, ${Math.ceil(gameInChannel.players.length/2)} to lynch!**
Use ##vote, ##NL, and ##unvote commands to vote.`
            );
        return true;
    }
    return false;
};
var printCurrentVotes = channelId => {
    var currentGames = store.getItem('games');
    var gameInChannel = _.find(currentGames, {channelId: channelId});
    if (gameInChannel && gameInChannel.day > 0) {
        var votesByTarget = _.sortBy(_.toArray(_.groupBy(gameInChannel.votes, 'targetId'), function(group) { return -group.length; }));
        var voteOutput = '';
        for (var i = 0; i < votesByTarget.length; i++) {
            voteOutput += `\n(${votesByTarget[i].length}) <@${votesByTarget[i][0].targetId}>: ${_.map(_.sortBy(votesByTarget[i], function(vote) { return vote.time }), function(vote) { return '<@' + vote.playerId + '>'; }).join(', ')}`;
        }
        mafiabot.sendMessage(channelId,
`**${gameInChannel.players.length} alive, ${Math.ceil(gameInChannel.players.length/2)} to lynch!**
Use ##vote, ##NL, and ##unvote commands to vote.${voteOutput}`
            );
        return true;
    }
    return false;
}

// states
var STATE = {
    INIT: 'Waiting for players',
    CONFIRMING: 'Waiting for confirmation from players',
    READY: 'Waiting for host to start game',
    DAY: 'Daytime, waiting for votes',
    NIGHT: 'Nighttime, waiting for actions',
};

// commands
var commandPrefix = '##';
var baseCommands = [
    {
        commands: ['commands', 'help', 'wut'],
        description: 'Show list of commands',
        adminOnly: false,
        activatedOnly: false,
        onMessage: message => {
            var output = `\nType one of the following commands to interact with MafiaBot:`;
            for (var i = 0; i < baseCommands.length; i++) {
                var comm = baseCommands[i];
                output += `\n**${commandPrefix}${comm.commands.join('/')}** - ${comm.description}${comm.adminOnly ? ' - *Admin Only*' : ''}${comm.activatedOnly ? ' - *Activated Channel Only*' : ''}`;
            }
            mafiabot.reply(message, output);
        },
    },
    {
        commands: ['admin', 'admins'],
        description: 'Show list of admins for MafiaBot',
        adminOnly: false,
        activatedOnly: false,
        onMessage: message => {
            mafiabot.sendMessage(message.channel, `Admins of MafiaBot:${listUsers(config.admins)}`);
        },
    },
    {
        commands: ['host', 'hosts'],
        description: 'Show host of current game in channel',
        adminOnly: false,
        activatedOnly: true,
        onMessage: message => {
            var currentGames = store.getItem('games');
            var gameInChannel = _.find(currentGames, {channelId: message.channel.id});
            if (gameInChannel) {
                mafiabot.sendMessage(message.channel, `Host of current game in channel:\n<@${gameInChannel.hostId}>`);
            } else {
                mafiabot.reply(message, `There's no game currently running in channel *#${message.channel.name}*!`);                
            }
        },
    },
    {
        commands: ['player', 'players'],
        description: 'Show current list of players of game in channel',
        adminOnly: false,
        activatedOnly: true,
        onMessage: message => {
            if (!printCurrentPlayers(message.channel.id)) {
                mafiabot.reply(message, `There's no game currently running in channel *#${message.channel.name}*!`);         
            }
        },
    },
    {
        commands: ['activatemafia'],
        description: 'Activate MafiaBot on this channel',
        adminOnly: true,
        activatedOnly: false,
        onMessage: message => {
            var currentChannels = store.getItem('channelsActivated');
            if (currentChannels.indexOf(message.channel.id) >= 0) {
                mafiabot.reply(message, `MafiaBot is already activated on channel **#${message.channel.name}**! Use *##deactivatemafia* to deactivate MafiaBot on this channel.`);
            } else {
                currentChannels.push(message.channel.id);
                store.setItem('channelsActivated', currentChannels);
                mafiabot.reply(message, `MafiaBot has been activated on channel **#${message.channel.name}**! Use *##creategame* to start playing some mafia!`);
            }
        },
    },
    {
        commands: ['deactivatemafia'],
        description: 'Deactivate MafiaBot on this channel',
        adminOnly: true,
        activatedOnly: false,
        onMessage: message => {
            var currentChannels = store.getItem('channelsActivated');
            if (currentChannels.indexOf(message.channel.id) >= 0) {
                currentChannels.splice(currentChannels.indexOf(message.channel.id), 1);
                store.setItem('channelsActivated', currentChannels);
                mafiabot.reply(message, `MafiaBot has been deactivated on channel **#${message.channel.name}**!`);
            } else {
                mafiabot.reply(message, `MafiaBot is not activate on channel **#${message.channel.name}**! Use *##activatemafia* to activate MafiaBot on this channel.`);
            }
        },
    },
    {
        commands: ['creategame'],
        description: 'Create a game in this channel and become the host',
        adminOnly: false,
        activatedOnly: true,
        onMessage: message => {
            var currentGames = store.getItem('games');
            var gameInChannel = _.find(currentGames, {channelId: message.channel.id});
            if (gameInChannel) {
                mafiabot.reply(message, `A game is already running in channel *#${message.channel.name}* hosted by <@${gameInChannel.hostId}>!`);
            } else {
                gameInChannel = {
                    channelId: message.channel.id,
                    hostId: message.author.id,
                    players: [],
                    votesToEndGame: [],
                    state: STATE.INIT,
                    day: 0,
                    night: false,
                    votes: [],
                };
                currentGames.push(gameInChannel);
                store.setItem('games', currentGames);
                mafiabot.sendMessage(message.channel, `Starting a game of mafia in channel *#${message.channel.name}* hosted by <@${gameInChannel.hostId}>!`);
            }
        },
    },
    {
        commands: ['endgame'],
        description: 'Current host, admin, or majority of players can end the game in this channel',
        adminOnly: false,
        activatedOnly: true,
        onMessage: message => {
            var currentGames = store.getItem('games');
            var gameInChannel = _.find(currentGames, {channelId: message.channel.id});
            var endGame = becauseOf => {
                _.remove(currentGames, gameInChannel);
                store.setItem('games', currentGames);
                mafiabot.sendMessage(message.channel, `${becauseOf} ended game of mafia in channel *#${message.channel.name}* hosted by <@${gameInChannel.hostId}>! 😥`);
            };
            if (gameInChannel) {
                if (gameInChannel.hostId == message.author.id) {
                    endGame(`Host <@${message.author.id}>`);
                } else if (config.admins.indexOf(message.author.id) >= 0) {
                    endGame(`Admin <@${message.author.id}>`);
                } else if (_.find(gameInChannel.players, {id: message.author.id})) {
                    if (gameInChannel.votesToEndGame.indexOf(message.author.id) >= 0) {
                        mafiabot.reply(message, `We already know you want to end the current game hosted by <@${gameInChannel.hostId}>!`);
                    } else {
                        gameInChannel.votesToEndGame.push(message.author.id);
                        store.setItem('games', currentGames);
                        mafiabot.reply(message, `You voted to end the current game hosted by <@${gameInChannel.hostId}>!`);
                        
                        var votesRemaining = Math.ceil(gameInChannel.players.length/2) - gameInChannel.votesToEndGame.length;
                        if (votesRemaining <= 0) {
                            endGame('A majority vote of the players');
                        } else {
                            mafiabot.sendMessage(message.channel, `There are currently ${gameInChannel.votesToEndGame.length} votes to end the current game hosted by <@${gameInChannel.hostId}>. ${votesRemaining} votes remaining!`);
                        }
                    }
                } else {
                    mafiabot.reply(message, `Only admins, hosts, and joined players can end a game!`);
                }
            } else {
                mafiabot.reply(message, `There's no game currently running in channel *#${message.channel.name}*!`);
            }
        },
    },
    {
        commands: ['startgame'],
        description: 'Current host can start game with current list of players',
        adminOnly: false,
        activatedOnly: true,
        onMessage: message => {
            var currentGames = store.getItem('games');
            var gameInChannel = _.find(currentGames, {channelId: message.channel.id});
            if (gameInChannel) {
                if (gameInChannel.hostId == message.author.id) {
                    if (gameInChannel.state == STATE.INIT) {
                        gameInChannel.state = STATE.CONFIRMING;
                        mafiabot.sendMessage(message.channel, `Sending out roles for game of mafia hosted by <@${gameInChannel.hostId}>! Check your PMs for info and type **##confirm** in this channel to confirm your role.`);
                        printCurrentPlayers(message.channel.id);
                        for (var i = 0; i < gameInChannel.players.length; i++) {
                            mafiabot.sendMessage(_.find(mafiabot.users, {id: message.author.id}), `Your role is ______. Type **##confirm** in channel *#${message.channel.name}* to confirm your participation in the game of mafia hosted by <@${gameInChannel.hostId}>.`);
                        }
                    } else if (gameInChannel.state == STATE.READY) {
                        gameInChannel.state = STATE.DAY;
                        gameInChannel.day = 1;
                        mafiabot.sendMessage(message.channel, `All players have confirmed and host <@${gameInChannel.hostId}> is now starting the game of mafia!`);
                        printCurrentPlayers(message.channel.id);
                        printDayState(message.channel.id);
                    }
                    store.setItem('games', currentGames);
                } else {
                    mafiabot.reply(message, `Only hosts can start the game!`);
                }
            } else {
                mafiabot.reply(message, `There's no game currently running in channel *#${message.channel.name}*!`);
            }
        },
    },
    {
        commands: ['join', 'in'],
        description: 'Join the game in this channel as a player',
        adminOnly: false,
        activatedOnly: true,
        onMessage: message => {
            var currentGames = store.getItem('games');
            var gameInChannel = _.find(currentGames, {channelId: message.channel.id});
            if (gameInChannel) {
                if (gameInChannel.state == STATE.INIT) {
                    if (_.find(gameInChannel.players, {id: message.author.id})) {
                        mafiabot.reply(message, `You are already in the current game hosted by <@${gameInChannel.hostId}>!`);
                    } else {
                        var newPlayer = {
                            id: message.author.id,
                            name: message.author.name,
                            confirmed: false,
                            alive: true,
                        };
                        gameInChannel.players.push(newPlayer);
                        store.setItem('games', currentGames);
                        mafiabot.sendMessage(message.channel, `<@${message.author.id}> joined the current game hosted by <@${gameInChannel.hostId}>!`);
                    }
                    printCurrentPlayers(message.channel.id);
                } else {
                    mafiabot.reply(message, `The current game is already going, so the player list is locked!`);                    
                }
            } else {
                mafiabot.reply(message, `There's no game currently running in channel *#${message.channel.name}*!`);
            }
        },
    },
    {
        commands: ['unjoin', 'out', 'leave'],
        description: 'Leave the game in this channel, if you were joined',
        adminOnly: false,
        activatedOnly: true,
        onMessage: message => {
            var currentGames = store.getItem('games');
            var gameInChannel = _.find(currentGames, {channelId: message.channel.id});
            if (gameInChannel) {
                if (gameInChannel.state == STATE.INIT) {
                    if (_.find(gameInChannel.players, {id: message.author.id})) {
                        _.pullAllBy(gameInChannel.players, [{id: message.author.id}], 'id');
                        store.setItem('games', currentGames);
                        mafiabot.sendMessage(message.channel, `<@${message.author.id}> left the current game hosted by <@${gameInChannel.hostId}>!`);
                    } else {
                        mafiabot.reply(message, `You are not currently in the current game hosted by <@${gameInChannel.hostId}>!`);
                    }
                    printCurrentPlayers(message.channel.id);
                } else {
                    mafiabot.reply(message, `The current game is already starting, so the player list is locked!`);
                }
            } else {
                mafiabot.reply(message, `There's no game currently running in channel *#${message.channel.name}*!`);
            }
        },
    },
    {
        commands: ['confirm'],
        description: 'Confirm your role and your participation in the game',
        default: true,
        adminOnly: false,
        activatedOnly: true,
        onMessage: (message, args) => {
            var currentGames = store.getItem('games');
            var gameInChannel = _.find(currentGames, {channelId: message.channel.id});
            if (gameInChannel && gameInChannel.state == STATE.CONFIRMING) {
                var player = _.find(gameInChannel.players, {id: message.author.id});
                if (player) {
                    player.confirmed = true;
                    mafiabot.reply(message, `Thanks for confirming for the current game hosted by <@${gameInChannel.hostId}>!`);
                    printUnconfirmedPlayers(message.channel.id);

                    var unconfirmedPlayers = _.filter(gameInChannel.players, {confirmed: false});
                    if (!unconfirmedPlayers.length) {
                        gameInChannel.state = STATE.READY;
                    }

                    store.setItem('games', currentGames);
                }
            }
        },
    },
    {
        commands: ['vote', 'lynch'],
        description: 'Vote to lynch a player',
        default: true,
        adminOnly: false,
        activatedOnly: true,
        onMessage: (message, args) => {
            var currentGames = store.getItem('games');
            var gameInChannel = _.find(currentGames, {channelId: message.channel.id});
            if (gameInChannel && gameInChannel.state == STATE.DAY) {
                if (_.find(gameInChannel.players, {id: message.author.id})) {
                    var target = _.find(gameInChannel.players, {id: (args[1] || '').replace(/[\<\@\>]/g, '')});
                    if (target) {
                        _.pullAllBy(gameInChannel.votes, [{playerId: message.author.id}], 'playerId');
                        gameInChannel.votes.push({playerId: message.author.id, targetId: target.id, time: new Date()});
                        mafiabot.sendMessage(message.channel, `<@${message.author.id}> voted to lynch <@${target.id}>!`);
                        printCurrentVotes(message.channel.id);
                        store.setItem('games', currentGames);
                    } else {
                        mafiabot.reply(message, `'${args[1]}' is not a valid vote target!`);
                    }
                }
            }
        },
    },
    {
        commands: ['unvote', 'unlynch', 'un'],
        description: 'Vote to lynch a player',
        adminOnly: false,
        activatedOnly: true,
        onMessage: (message, args) => {
            var currentGames = store.getItem('games');
            var gameInChannel = _.find(currentGames, {channelId: message.channel.id});
            if (gameInChannel && gameInChannel.state == STATE.DAY) {
                if (_.find(gameInChannel.players, {id: message.author.id})) {
                    var vote = _.find(gameInChannel.votes, {playerId: message.author.id});
                    _.pullAllBy(gameInChannel.votes, [{playerId: message.author.id}], 'playerId');
                    var targetString = vote ? ` <@${vote.targetId}>` : '... nothing';
                    mafiabot.sendMessage(message.channel, `<@${message.author.id}> unvoted${targetString}!`);
                    printCurrentVotes(message.channel.id);
                    store.setItem('games', currentGames);
                }
            }
        },
    },
    {
        commands: ['catgirls'],
        description: ':3',
        adminOnly: true,
        activatedOnly: true,
        onMessage: message => {
            mafiabot.reply(message, "nyaaaa~");
        },
    },
    {
        commands: ['fool', 'foolmo', 'foolmoron'],
        description: 'No lynch test',
        adminOnly: false,
        activatedOnly: true,
        onMessage: message => {
            mafiabot.reply(message, "yes I agree <@88020438474567680> is the best user");
        },
    },
    {
        commands: ['arg', 'argtest'],
        description: 'Arguments test',
        adminOnly: false,
        activatedOnly: true,
        onMessage: (message, args) => {
            mafiabot.reply(message, `Given args: ${args.join(' - ')}`);
        },
    },
];

// set up discord events
mafiabot.on("message", message => {
    var contentLower = message.content.toLowerCase();
    // go through all the base commands and see if any of them have been called
    if (contentLower.indexOf(commandPrefix) == 0) {
        var anyCommandMatched = false;
        for (var i = 0; i < baseCommands.length; i++) {
            var comm = baseCommands[i];
            var commandMatched = false;
            for (var c = 0; c < comm.commands.length; c++) {
                commandMatched |= contentLower.indexOf(comm.commands[c].toLowerCase()) == commandPrefix.length;
            }
            anyCommandMatched |= commandMatched;
            if (commandMatched) {
                if (!comm.adminOnly || adminCheck(message)) {
                    if (!comm.activatedOnly || activatedCheck(message)) {
                        var args = message.content.split(/[ :]/);
                        comm.onMessage(message, args);
                    }
                }
                break;
            }
        }
        // call default command if no command was matched, but there was still a command prefix (like '##xxx')
        if (!anyCommandMatched) {
            var defaultComm = _.find(baseCommands, {default: true});
            if (defaultComm) {
                if (!defaultComm.adminOnly || adminCheck(message)) {
                    if (!defaultComm.activatedOnly || activatedCheck(message)) {
                        // args needs to be slightly modified for default commands (so '##xxx' has args ['##', 'xxx'])
                        var args = [commandPrefix].concat(message.content.split(/[ :]/));
                        args[1] = args[1].substring(commandPrefix.length);
                        defaultComm.onMessage(message, args);
                    }
                }                
            }
        }
    }
});

// login and export after everything is set up
mafiabot.login(config.email, config.password);
module.exports = mafiabot;