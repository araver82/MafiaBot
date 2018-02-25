"use strict";
const fs = require('fs');
const config = require('../config.js');
const _ = require('lodash');
const ext = require('./ext.js');
const game = require('./gameLogic.js');
const s = require('./pluralize.js');
const closestPlayer = require('./closestPlayer.js');

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

utils.findPlayerByGameAndPlayerId = (gameChannel, playerId) => {
    return _.find(gameChannel.players, {id: playerId});
};

utils.findPlayerNameByGameAndPlayerId = (gameChannel, playerId) => {
    var player = utils.findPlayerByGameAndPlayerId(gameChannel, playerId);
	return !!player && !!player.name ? player.name : null;
};

utils.findPMChannelForPlayerId = (playerId) => {
    return _.find(data.pmChannels, {playerId: playerId});
};

utils.findGameByPlayerId = (playerId) => {
    return _.find(data.games, function(eachGame) { return _.find(eachGame.players, {id: playerId}); });
};

utils.findClosestPlayerNameInGame = (string, gameChannel) => {
    return !!gameInChannel ? closestPlayer(string, gameInChannel.players) : null;
};

utils.findPlayerByNameAndGameId = (string, channelId) => {
    var gameInChannel = utils.findGameById(channelId);
    return !!gameInChannel ? utils.findClosestPlayerNameInGame(string, gameInChannel) : null;
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
		
    if (listOfVotes.length && gameInChannel) {
		//SCUM STYLE
        var votesByTarget = _.sortBy(_.toArray(_.groupBy(listOfVotes, 'targetId')), group => -group.length);
		
        for (var i = 0; i < votesByTarget.length; i++) {
            var voteId = votesByTarget[i][0].targetId;
            if (voteId !== 'NO LYNCH') {
                voteId = '<@' + voteId + '>';
            }
            voteOutput += `\n(${votesByTarget[i].length}) ${voteId}: ${_.map(_.sortBy(votesByTarget[i], vote => vote.time), function(vote) { return '`' + utils.findPlayerName(gameInChannel, vote.playerId) + '`'; }).join(', ')}`;
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
    var gameInChannel = utils.findGameById(channelId);
	var output = '';
	
    if (gameInChannel) {
        output = `Currently ${s(gameInChannel.players.length, 'player')} in game:`;
        for (var i = 0; i < gameInChannel.players.length; i++) {
            var player = gameInChannel.players[i];
            output += `\n${i + 1}) `;
            if (player.alive) {
                output += `\`${player.name}\``;
            } else {
                output += `~~\`${player.name}\`~~ - ${getFaction(player.faction).name} ${(printTrueRole && game.getRole(player.role).trueName) || game.getRole(player.role).name} - *${player.deathReason}*`;
            }
        }
    }
    return output;
};

utils.printUnconfirmedPlayers = channelId => {
	var gameInChannel = utils.findGameById(channelId),
		output = '';
   
    if (gameInChannel) {
        var unconfirmedPlayers = _.filter(gameInChannel.players, {confirmed: false});
		
        output = unconfirmedPlayers.length 
            ? `**${s(unconfirmedPlayers.length, 'player')}** still must type ***${pre}confirm*** **IN THIS CHANNEL, NOT PM** for game:${utils.listUsers(_.map(unconfirmedPlayers, 'id'))}`
            : `All players confirmed for the game!`
            ;
    }
    return output;
};

utils.printDayState = channelId => {
    var gameInChannel = utils.findGameById(channelId),
		output = '';
	
    if (gameInChannel && gameInChannel.day > 0) {
        output = `It is currently **${gameInChannel.state == STATE.DAY ? 'DAY' : 'NIGHT'} ${gameInChannel.day}**!`;
		
        if (gameInChannel.state == STATE.DAY) {
            output += `\n**${_.filter(gameInChannel.players, 'alive').length} alive, ${game.majorityOf(_.filter(gameInChannel.players, 'alive'))} to lynch!**\nUse ${pre}vote, ${pre}NL, and ${pre}unvote commands to vote.`;
        } else {//NIGHT
            output += `\n**Send in your night actions via PM. Every player must check their PMs, regardless of role!**.`;
        }
    }
    return output;
};

utils.printCurrentVotes = channelId => {
    var gameInChannel = utils.findGameById(channelId),
		output = '';
	
    if (gameInChannel && gameInChannel.day > 0) {
        var voteOutput = utils.listVotes(gameInChannel.votes, channelId);
		
		output = `**${_.filter(gameInChannel.players, 'alive').length} alive, ${game.majorityOf(_.filter(gameInChannel.players, 'alive'))} to lynch!**\nUse ${pre}vote, ${pre}NL, and ${pre}unvote commands to vote.${voteOutput}`;
    }
    return output;
};

utils.checkForLynch = channelId => {
    var gameInChannel = utils.findGameById(channelId);
	
    if (gameInChannel) {
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