"use strict";
const fs = require('fs');
const config = require('../config.js');
const _ = require('lodash');
const ext = require('./ext.js');
const game = require('./gameLogic.js');
const s = require('./pluralize.js');
const closestPlayer = require('./closestPlayer.js');
const STATE = require('./gameStates.js');

var utils = this;

utils.getData = () => {
    try { return JSON.parse(fs.readFileSync(config.dataJSONPath).toString()); } catch (e) { return {}; };
}

utils.saveData = (freshData) => {
    //reloads it as well
    data = freshData;
    fs.writeFileSync(config.dataJSONPath, JSON.stringify(freshData, null, '\t'));
}

utils.loadData = () => {
	return _.merge({
		syncMessages: [],
		channelsActivated: [],
		signals: [],
		pmChannels: [],
		games: [],
	}, utils.getData())
}

//need to use data to be ... util
var data = utils.loadData();
utils.saveData(data);

utils.findGameById = (channelId) => {
	return _.find(data.games, {channelId: channelId});
};

utils.findPlayerByGameAndPlayerId = (gameInChannel, playerId) => {
    return _.find(gameInChannel.players, {id: playerId});
};

utils.findPlayerNameByGameAndPlayerId = (gameInChannel, playerId) => {
    var player = utils.findPlayerByGameAndPlayerId(gameInChannel, playerId);
	return !!player && !!player.name ? player.name : null;
};

utils.findPMChannelForPlayerId = (playerId) => {
    return _.find(data.pmChannels, {playerId: playerId});
};

utils.findGameByPlayerId = (playerId) => {
    return _.find(data.games, function(eachGame) { return _.find(eachGame.players, {id: playerId}); });
};

utils.findClosestPlayerNameInGame = (string, gameInChannel) => {
    return !!gameInChannel ? closestPlayer(string, gameInChannel.players) : null;
};

utils.findPlayerByNameAndChannelId = (string, channelId) => {
    if(!!channelId){
        var gameInChannel = utils.findGameById(channelId);
        return !!gameInChannel ? utils.findClosestPlayerNameInGame(string, gameInChannel) : null;    
    } else {
        console.log(`>>WARN Cannot find channel to retrieve playerName`);
    }
};

utils.findSignalsByServerId = (guildId) => {
    return _.find(data.signals, {serverId: guildId});
};

utils.isChannelActivated = (channelId) => {
    return data.channelsActivated.indexOf(channelId) >= 0;
};

utils.listUsers = listOfUserIds => {
    var output = '';
    for (var i = 0; i < listOfUserIds.length; i++) {
        output += `\n${i + 1}. <@${listOfUserIds[i]}>`;
    }
    return output;
};

utils.listVotes = (listOfVotes, channelId) => {
    var voteOutput = '',
		gameInChannel = utils.findGameById(channelId);
		
    if (listOfVotes.length && !!gameInChannel) {
		//SCUM STYLE
        var votesByTarget = _.sortBy(_.toArray(_.groupBy(listOfVotes, 'targetId')), group => -group.length);
		
        for (var i = 0; i < votesByTarget.length; i++) {
            var voteId = votesByTarget[i][0].targetId;
            if (voteId !== 'NO LYNCH') {
                voteId = '<@' + voteId + '>';
            }

            var countOfVotes = votesByTarget[i].length;

            var votedBy = _.map(_.sortBy(votesByTarget[i], vote => vote.time), 
                                    function(vote) {
                                        return utils.findPlayerNameByGameAndPlayerId(gameInChannel, vote.playerId); 
                                    })
                            .join(', ');

            voteOutput += `\n(${countOfVotes}) ${voteId}: ${votedBy}`;
        }
		//TODO: Roster-based voting
    } else {
        voteOutput += `**\nThere are currently no votes!**`;
    }
	
    return voteOutput;
};

utils.getPlayerRoleInfo = player => {
    var modIds = player.role.split('+'),
		baseRole = _.find(game.roles, {id: modIds.pop()}),
		modList = modIds.map(mod => _.find(game.mods, {id: mod})),
		role = game.getRole(player.role);
		
    var output = `Your role is ***${game.getFaction(player.faction).name} ${role.name}***`;
    output += `\n    \`${game.getFaction(player.faction).name}\`: ${game.getFaction(player.faction).description}`;
    output += `\n    \`${baseRole.name}\`: ${baseRole.description}`;
	
    for (var i = 0; i < modList.length; i++) {
        output += `\n    \`${modList[i].name}\`: ${modList[i].description}`;
    }
	
	return output;
};

utils.printCurrentPlayersWithTrueRole = (channelId) => {
    return utils.printCurrentPlayers(channelId, true);
};

utils.printCurrentPlayers = (channelId, printTrueRole) => {
    var gameInChannel = utils.findGameById(channelId),
        output = '';
    console.log(`>>INFO Printing current players with true roles: ${!!printTrueRole}`);
	
    if (!!gameInChannel) {
        output = `Currently ${s(gameInChannel.players.length, 'player')} in game:`;
        for (var i = 0; i < gameInChannel.players.length; i++) {
            var player = gameInChannel.players[i];
            output += `\n${i + 1}) `;
            if (player.alive) {
                output += `\`${player.name}\``;
            } else {
                output += `~~\`${player.name}\`~~ - ${game.getFaction(player.faction).name} ${(printTrueRole && game.getRole(player.role).trueName) || game.getRole(player.role).name} - *${player.deathReason}*`;
            }
        }
    } else {
        console.log(`>>WARN No channel found for id ${channelId}!`);
    }
    return output;
};

utils.printUnconfirmedPlayers = channelId => {
	var gameInChannel = utils.findGameById(channelId),
		output = '';
    console.log(`>>INFO Printing unconfirmed players`);

    if (!!gameInChannel) {
        var unconfirmedPlayers = _.filter(gameInChannel.players, {confirmed: false});
		
        output = unconfirmedPlayers.length 
            ? `**${s(unconfirmedPlayers.length, 'player')}** still must type ***${pre}confirm*** **IN THIS CHANNEL, NOT PM** for game:${utils.listUsers(_.map(unconfirmedPlayers, 'id'))}`
            : `All players confirmed for the game!`
            ;
    } else {
        console.log(`>>WARN No channel found for id ${channelId}!`);
    }
    return output;
};

utils.printDayState = channelId => {
    var gameInChannel = utils.findGameById(channelId),
		output = '';
	console.log(`>>INFO Printing day state`);

    if (!!gameInChannel && gameInChannel.day > 0) {
        output = `It is currently **${gameInChannel.state == STATE.DAY ? 'DAY' : 'NIGHT'} ${gameInChannel.day}**!`;
		
        if (gameInChannel.state == STATE.DAY) {
            //TODO this is SCUM-only
            var alivePlayers = _.filter(gameInChannel.players, 'alive').length,
                toLynchPlayers = game.majorityOf(_.filter(gameInChannel.players, 'alive'));

            output += `\n**${alivePlayers} alive, ${toLynchPlayers} to lynch!**`;
            output += `\nUse ${pre}vote, ${pre}NL, and ${pre}unvote commands to vote.`;
        } else {//NIGHT
            output += `\n**Send in your night actions via PM. `;
            output += `Every player must check their PMs, regardless of role!**.`;
        }
    } else {
        console.log(`>>WARN Either channel ${channelId} is broken or it's not Day 1 yet`);
    }
    return output;
};

utils.printCurrentVotes = channelId => {
    var gameInChannel = utils.findGameById(channelId),
		output = '';
	
    if (gameInChannel && gameInChannel.day > 0) {
        var voteOutput = utils.listVotes(gameInChannel.votes, channelId);
        //TODO this is SCUM-only
        var alivePlayers = _.filter(gameInChannel.players, 'alive').length,
            toLynchPlayers = game.majorityOf(_.filter(gameInChannel.players, 'alive'));
		
		output += `**${alivePlayers} alive, ${toLynchPlayers} to lynch!**`;
        output += `\nUse ${pre}vote, ${pre}NL (or ${pre}abstain) and ${pre}unvote commands to vote!`;
        output += `\n${voteOutput}`;
    }
    return output;
};

utils.checkForLynch = channelId => {
    var gameInChannel = utils.findGameById(channelId);
	
    if (!!gameInChannel) {
		//SCUM Mafia
		//TODO: Den Mafia rules
        var votesRequired = game.majorityOf(_.filter(gameInChannel.players, 'alive'));
        var votesByTarget = _.groupBy(gameInChannel.votes, 'targetId');
		
        for (var targetId in votesByTarget) {
            if (votesByTarget[targetId].length >= votesRequired) {
				//TODO
                //endDay(channelId, targetId);
                return true;
            }
        }
    }
    return false;
};

module.exports = utils