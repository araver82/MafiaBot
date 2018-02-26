"use strict";

//requires
const fs = require('fs');
const config = require('./config.js');
const _ = require('lodash');
const Discord = require('discord.js');
const ext = require('./lib/ext.js');

//global
global.pre = config.prefix; // command prefix that can be used across all files
//XXX: beware of magic constants even though PI may have been involved here
global.bulletKill = 0.314; // sentinel number for differentiating bullet kills from other kills

const STATE = require('./lib/gameStates.js');
const s = require('./lib/pluralize.js');
const game = require('./lib/gameLogic.js');
const utils = require('./lib/utils.js');


// init stuff 
var bot = new Discord.Client();
var data = utils.loadData();

// service layer for channel/guild/user related functions
var findUserById = (userId) => {
        return bot.users.get(userId);
    },
    findHostByGame = (game) => {
        return bot.users.get(game.hostId);
    },
    findRoleEveryoneInGuild = (gameChannel) => {
        return gameChannel.guild.roles.find('name',"@everyone").id;
    },
    findChannelById = (channelId) => {
        return bot.channels.get(channelId);    
    },
    sendPlayerRoleInfo = player => {
        console.log(`>>INFO Sending info to player ${player.name}`);
        var output = utils.getPlayerRoleInfo(player);
        if(!!output){
            bot.privateMessage(player.id, output);  
        } else {
            console.log(`>>WARN: no player info for player!`);
        }
    },
    printCurrentPlayers = (channelId, outputChannelId, printTrueRole) => {
        console.log(`>>INFO Current players w/o role for channel: ${channelId}`);
        var output = utils.printCurrentPlayers(channelId, printTrueRole);
        if(!!output){
            bot.channelMessage(outputChannelId || channelId, output);   
            return true;
        } else {
            console.log(`>>WARN: no current players!`);
            return false;
        }
    },
    printCurrentPlayersWithTrueRole = (channelId, outputChannelId) => {
        console.log(`>>INFO Current players with true role for channel: ${channelId}`);
        return printCurrentPlayers(channelId, outputChannelId || channelId, true);
    },
    printUnconfirmedPlayers = (channelId, outputChannelId) => {
        console.log(`>>INFO Unconfirmed players for channel: ${channelId}`);
        var output = utils.printUnconfirmedPlayers(channelId);
        if(!!output){
            bot.channelMessage(outputChannelId || channelId, output);   
            return true;
        } else {
            console.log(`>>WARN: no unconfirmed players!`);
            return false;
        }
    },
    printDayState = (channelId, outputChannelId) => {
        console.log(`>>INFO Daystate players for channel: ${channelId}`);
        var output = utils.printDayState(channelId);
        if(!!output){
            bot.channelMessage(outputChannelId || channelId, output);   
            return true;
        } else {
            console.log(`>>WARN: no day state!`);
            return false;
        }
    },
    printCurrentVotes = (channelId, outputChannelId) => {
        console.log(`>>INFO Current votes for channel: ${channelId}`);
        var output = utils.printCurrentVotes(channelId);
        if(!!output){
            bot.channelMessage(outputChannelId || channelId, output);   
            return true;
        } else {
            console.log(`>>WARN: no current votes!`);
            return false;
        }
    };

//#1 login
bot.login(config.token);

//communication on a channel
bot.channelMessage = (channelId, message) => {
	if(!!channelId){
		//find channel and send message
		var channel = findChannelById(channelId);
		if(!!channel){
			channel.send(message, {split : true});
		} else {
			console.log(`>>WARN Failed to get a channel to speak in for ${channelId}!`);
			console.dir(bot.channels);
		}
	} else {
		console.log(`>>WARN No channel to speak in!`);
	}
};

bot.deleteChannel = (channelId) => {
    if(!channelId){
        console.log(`>>WARN Cannot delete empty channel!`);    
        return;
    }

    //find channel and delete it
    var channel = findChannelById(channelId);
    if(!!channel){
        channel.delete()
            .then(() => {
                var channel = findChannelById(channelId);
                if(!channel){
                    if(!config.silentMode) console.log(`>>INFO channel deleted successfully`);
                } else {
                    console.log(`>>WARN did not delete channel!`);
                }
            })
            .catch(error => {
                if (!!error) {
                    console.log(`>>ERROR from API trying to delete channel: ${error.message}`);
                } else {
                    console.log(`>>ERROR unknown trying to delete channel!`);
                }
                //TODO: alert gracefully
                //bot.channelMessage(bot.mainChannel,`Failed to delete channel!`);
            });
    } else {
        console.log(`>>WARN cannot delete channel that does not exist!`);
        return;
    }
};

bot.createChannel = (guild, channelName, channelType, callback) => {
    if(!channelName){
        console.log(`>>WARN Cannot create empty channel!`);    
        return;
    }

    if(!!guild){
        if(!config.silentMode) console.log(`>>INFO Creating channel: ${channelName} of type ${channelType}`);

        guild.createChannel(channelName, channelType)
            .then((channel)=> {
                if(!!channel){
                    if(!config.silentMode) console.log(`>>INFO Channel ${channelName} created!`);
                    if(!!callback){
                        callback(channel);
                    }
                } else {
                    console.log(`>>WARN Channel ${channelName} not created!`);
                }
            })
            .catch(error => {
                if (!!error) {
                    console.log(`>>ERROR from API trying to create channel: ${error.message}`);
                } else {
                    console.log(`>>ERROR unknown trying to create channel!`);
                }
                //TODO: alert gracefully
                //bot.channelMessage(bot.mainChannel,`Failed to create channel!`);
            }); 
    } else {
        console.log(`>>WARN cannot create channel with no guild!`);
        return;
    }
};

//communication with a player
bot.privateMessage = (playerId, message) => {
	if(!!playerId){
		//find player and send message
		var player = bot.users.get(playerId);	
		if(!!player){
			player.send(message, {split : true});
		} else {
			console.log(`>>WARN Failed to get a player for ${playerId}!`);
		}
	} else {
		console.log(`>>WARN Cannot PM player!`);
	}
};

//replying w/ or w/o logging
bot.reply = (message, replyMessage) =>{
	if(!!message){
		message.reply(replyMessage, {split : true});
	} else {
		console.log(`>>WARN Cannot reply!`);
	}
};

//changing permissions on channel
bot.overwritePermissions = (channel, subject, options) => {
    //test that channel exists before trying anything ;)
    if(!channel || !channel.id){
        return;//silent
    }

    //if(!config.silentMode) 
    console.log(`>>INFO Trying to override permissions for ${channel.name}`);

    var channelExists = bot.channels.get(channel.id);
    if(!channelExists){
        return;//silent
    }

	channelExists.overwritePermissions(subject, options)
		.then(response => {
			if (!response) {
				console.log(`>>ERROR Can't touch permissions for some role`);
			} else {
				//console.log(`>>DEBUG Channel now has ${response.permissionOverwrites.size} permission overwrites!`);
				//console.dir(response.permissionOverwrites);
			}
		})
		.catch(error => {
			if (!!error) {
				console.log(`>>ERROR from API trying to change permissions: ${error.message}`);
			} else {
				console.log(`>>ERROR unknown trying to change permissions`);
			}
			//TODO: alert gracefully
			//bot.channelMessage(bot.mainChannel,`Failed to overwrite permissions!`);
		});
};

//#2 get mainChannel on ready
bot.mainChannel = null;

bot.on('ready', () => {
	console.log(`>> Logged in successfully as ${bot.user.tag}!`);
	
	// wait for channels to be cached first or else there will be weird bugs
    var loginChecks = 0,
		checkForChannelsThenKickoff = () => {
        if (!!bot.channels && bot.channels.size) {
			console.log(`>>INFO I am in ${bot.channels.size} channels in ${bot.guilds.array().length} guilds!`);
			
			bot.user.setActivity(`on ${bot.guilds.size} servers (${bot.guilds.array()[0]})`);
						
			if(!!findChannelById(config.defaultChannelId)){
				
				console.log(`>>INFO Gonna use the testing environment ;)!`);
				bot.mainChannel = findChannelById(config.defaultChannelId);
				
			} else if(!!bot.channels.exists(val => val.name === config.defaultChannelName)){
				
				console.log(`>>INFO Gonna use the default channel ${config.defaultChannelName}`);
				bot.mainChannel = bot.channels.find(val => val.name === config.defaultChannelName);
				
			} else {
				console.log(`>>INFO Gonna use first available channel: ` + bot.channels.first());
				bot.mainChannel = bot.channels.first();
			}
			
			console.log(`>>INFO Using channel '${bot.mainChannel.name}' on '${bot.mainChannel.guild.name}'!`);
			
			//send message
			if(!!bot.mainChannel){
				console.log(`>>INFO I have no mouth but I can and must speak!`);
				if(!config.silentMode) {
					bot.channelMessage(bot.mainChannel.id,`MMBot is here ... have no fear ✌!`);
				}
			} else {
				console.log(`>>ERROR Failed to get a main channel to speak in!`);
			}
			
			//send message to admin
			console.log(`>>INFO I need to alert my masters!`);
			if(!config.silentMode) {
				config.admins.forEach(admin => {
					bot.privateMessage(admin, `>>INFO I am awake master! ❤`);	
				});
			}
			
            mainLoop(0);
        } else {
            loginChecks++;
			console.log(`>>WARN Cannot see channels! retrying: `+loginChecks);
            if (loginChecks >= config.loginChecksBeforeRebooting) {
                throw "Failed login check - rebooting!";
            } else {
                setTimeout(checkForChannelsThenKickoff, 1000);
            }
        }
    }
	
    checkForChannelsThenKickoff();
});

// utilities
var fireEvent = (event, params) => {
        return event == null ? null : event(_.assignIn({mafiabot: bot, data: data}, params));
    },
    adminCheck = message => {
        if (config.admins.indexOf(message.author.id) >= 0) {
            return true;
        }
        bot.reply(message, `You must be an admin to perform command *${message.content}*!`);
        return false;
    },
    activatedCheck = message => {
        return utils.isChannelActivated(message.channel.id);
    };

var endDay = (channelId, lynchTargetId) => {
    var gameInChannel = utils.findGameById(channelId);
    if (gameInChannel) {
        bot.channelMessage(channelId, `**STOP! STOP! STOP! STOP! STOP! STOP! STOP! STOP!**\n**STOP! STOP! STOP! STOP! STOP! STOP! STOP! STOP!**\n\n**!! *THERE IS NO TALKING AT NIGHT* !!**\n\n**STOP! STOP! STOP! STOP! STOP! STOP! STOP! STOP!**\n**STOP! STOP! STOP! STOP! STOP! STOP! STOP! STOP!**\n\n`);
        if (lynchTargetId == 'NO LYNCH') {
            bot.channelMessage(channelId, `No one was lynched.`, 1000);
        } else {
            var lynchedPlayer = _.find(gameInChannel.players, {id: lynchTargetId});
            fireEvent(game.getRole(lynchedPlayer.role).onLynched, {game: gameInChannel, player: lynchedPlayer});
            bot.channelMessage(channelId, `<@${lynchedPlayer.id}>, the **${game.getFaction(lynchedPlayer.faction).name} ${game.getRole(lynchedPlayer.role).name}**, was lynched!`, 1000);
            lynchedPlayer.alive = false;
            lynchedPlayer.deathReason = 'Lynched D' + gameInChannel.day;
        }
        gameInChannel.state = STATE.NIGHT;
        gameInChannel.voteHistory.push({
            day: gameInChannel.day,
            votes: _.clone(gameInChannel.votes), // clone because the array will be cleared soon
        });
        gameInChannel.timeLimit = config.nightTimeLimit;
        gameInChannel.nightActionReminderTime = config.nightActionReminderInterval;
        if (!checkForGameOver(channelId)) {
            var livePlayers = _.filter(gameInChannel.players, 'alive');
            for (var i = 0; i < livePlayers.length; i++) {
                var player = livePlayers[i];
                fireEvent(game.getRole(player.role).onNight, {game: gameInChannel, player: player});
                printCurrentPlayers(channelId, player.id);
            }

            gameInChannel.mafiaDidNightAction = false;
            bot.channelMessage(gameInChannel.mafiaChannelId, 
`It is now night ${gameInChannel.day}! Use the ***${pre}kill*** command in this chat to choose who the mafia will kill tonight (ex: *${pre}kill fool*). ***${pre}cancel*** to cancel.
Use the ***${pre}noaction*** command to confirm that you are active but taking no action tonight.

***IMPORTANT: DO NOT ping a non-mafia player with @ in this chat. They will get a notification even though they can't read this chat.***

**NOTE: The person who sends the kill command in this chat will be the one to perform the kill, for role purposes.**
**ALSO: If you have a power role, you must send me a private message separate from this chat to make that action!**`
            );
            printCurrentPlayers(channelId, gameInChannel.mafiaChannelId);
            
            printDayState(channelId);
        }
    }
}

var checkForGameOver = channelId => {
    var gameInChannel = utils.findGameById(channelId);
    if (gameInChannel) {
        var livePlayers = _.filter(gameInChannel.players, 'alive');
        var winningFactions = {};
        for (var i = 0; i < gameInChannel.players.length; i++) {
            var player = gameInChannel.players[i];
            var result = fireEvent(game.getFaction(player.faction).isVictory, {game: gameInChannel, player: player});
            if (result) {
                winningFactions[player.faction] = player.faction;
            }
        }
        winningFactions = _.toArray(winningFactions);

        const gameOver = gameOverMessage => {
            gameInChannel.state = STATE.GAMEOVER;
            for (var i = 0; i < livePlayers.length; i++) {
                livePlayers[i].alive = false;
                livePlayers[i].deathReason = 'Survivor!';
            }
            bot.channelMessage(channelId, gameOverMessage);
            printCurrentPlayersWithTrueRole(channelId);
            
            var mafiaChannel = findChannelById(gameInChannel.mafiaChannelId);
            bot.channelMessage(mafiaChannel.id, `**The game is over so this chat has been revealed to everyone. This is intentional!** Use *${pre}endgame* in the main chat to delete this room forever.`);
            bot.channelMessage(channelId, 
`The roleset used was called: \`${gameInChannel.roleset}\`

⚠️ **Use the *${pre}feedback* command to report any bad role setups and to send any other comments/suggestions/bugs to the server!** ⚠️

Mafia chat is now open to all players!
**Use the *${pre}endgame* command to end the game (and delete the mafia chat forever) so you can start a new game!**`);
        };

        if (winningFactions.length == 1) {
            var faction = game.getFaction(winningFactions[0]);
            gameOver(`***GAME OVER!***\n**THE ${faction.name.toUpperCase()} TEAM HAS WON!!!**\nCongrats:${utils.listUsers(_.map(_.filter(gameInChannel.players, {faction: faction.id}), 'id'))}`);
            return true;
        } else if (winningFactions.length > 1) {
            gameOver(`***GAME OVER!***\n**THERE WAS... A TIE?!** Winning factions: ${winningFactions.map(faction => game.getFaction(faction).name).join(', ')}`);
            return true;
        } else if (winningFactions.length == 0 && livePlayers.length == 0) {
            gameOver(`***GAME OVER!***\n**NOBODY WINS!!!!... somehow?**`);
            return true;
        }
    }
    return false;
}

// commands
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
                output += `\n**${pre}${comm.commands.join('/')}** - ${comm.description}${comm.adminOnly ? ' - *Admin Only*' : ''}${comm.activatedOnly ? ' - *Activated Channel Only*' : ''}`;
            }
            bot.channelMessage(message.channel.id, output);
        },
    },
    {
        commands: ['feedback', 'bug', 'bugreport'],
        description: 'Send feedback and comments and suggestions about MafiaBot to the admin',
        adminOnly: false,
        activatedOnly: false,
        onMessage: message => {
            //TODO: find a less resource intensive way of receiving feedback
            /*
            var gameInChannel = utils.findGameById(message.channel.id),
                output = `## Server: ${message.channel.server ? message.channel.server.name : 'PM'} |`;
            output +=` Channel: ${message.channel.name || 'N/A'} | User: ${message.author.username} |`;
            output +=` Roleset: ${gameInChannel ? gameInChannel.roleset : 'N/A'} | ${new Date()} |`;
            output +=` When: ${new Date(message.createdTimestamp)} ##\n`;
            output +=`${message.content.substring(11)}\n\n`;

            fs.appendFile(config.feedbackFilePath, output);
            */
			
            bot.reply(message, `Thanks for the feedback! ❤`);
        },
    },
    {
        commands: ['credits'],
        description: 'Show credits for MafiaBot',
        adminOnly: false,
        activatedOnly: false,
        onMessage: message => {
            bot.channelMessage(message.channel.id, 
			`Latest master is araver82. I was designed and developed by foolmoron. You can find me here: https://github.com/araver82/MafiaBot`);
        },
    },
    {
        commands: ['reboot'],
        description: 'Reboots MafiaBot on the server',
        adminOnly: true,
        activatedOnly: false,
        onMessage: message => {
			bot.channelMessage(message.channel.id, 
			`Be right back, someone just rebooted me ☠! (${message.author.username})`);
            throw new Error(`Rebooting MafiaBot due to admin ${message.author.username}'s ${pre}reboot command!`);
        },
    },
    {
        commands: ['activatemafia'],
        description: 'Activate MafiaBot on this channel',
        adminOnly: true,
        activatedOnly: false,
        onMessage: message => {
            if (data.channelsActivated.indexOf(message.channel.id) >= 0) {
                bot.reply(message, `MafiaBot is already activated in *<#${message.channel.id}>*! Use *${pre}deactivatemafia* to deactivate MafiaBot on this channel.`);
            } else {
                data.channelsActivated.push(message.channel.id);
                bot.reply(message, `MafiaBot has been activated in *<#${message.channel.id}>*! Use *${pre}creategame* to start playing some mafia!`);
            }
        },
    },
    {
        commands: ['deactivatemafia'],
        description: 'Deactivate MafiaBot on this channel',
        adminOnly: true,
        activatedOnly: false,
        onMessage: message => {
            if (data.channelsActivated.indexOf(message.channel.id) >= 0) {
                data.channelsActivated.splice(data.channelsActivated.indexOf(message.channel.id), 1);
                bot.reply(message, `MafiaBot has been deactivated in *<#${message.channel.id}>*!`);
            } else {
                bot.reply(message, `MafiaBot is not activate in *<#${message.channel.id}>*! Use *${pre}activatemafia* to activate MafiaBot on this channel.`);
            }
        },
    },
    {
        commands: ['signal', 'letsplay'],
        description: `Let people know that you want to play some mafia. Pings everyone players who joined the signal group with *${pre}joinsignal*.`,
        adminOnly: false,
        activatedOnly: true,
        onMessage: message => {
            var signalsForServer = utils.findSignalsByServerId(message.channel.guild.id);
            if (signalsForServer && signalsForServer.playerIds.length) {
                bot.channelMessage(message.channel.id, `**HEY! Let's play some MAFIA!** (use the *${pre}joinsignal* command to join this list)\n${signalsForServer.playerIds.map((id) => `<@${id}>`).join(' ')}`);
            } else {
                bot.reply(message, `There's no one in the signal group for server \`${message.channel.guild.name}\`! Use the *${pre}joinsignal* command to join it.`);
            }
        },
    },
    {
        commands: ['joinsignal'],
        description: `Join the signal group so you are pinged to play anytime someone uses the *${pre}signal* command.`,
        adminOnly: false,
        activatedOnly: true,
        onMessage: message => {
            var signalsForServer = utils.findSignalsByServerId(message.channel.guild.id);
            if (!signalsForServer) {
                signalsForServer = {
                    serverId: message.channel.guild.id,
                    playerIds: [],
                }
                data.signals.push(signalsForServer);
            }
            var prevLength = signalsForServer.playerIds.length;
            signalsForServer.playerIds = _.uniq(signalsForServer.playerIds.concat(message.author.id));
            if (signalsForServer.playerIds.length != prevLength) {
                bot.reply(message, `You have been added to the mafia signal for server \`${message.channel.guild.name}\`! Use the *${pre}signal* command to ping everyone in the signal group.`);
            } else {
                bot.reply(message, `You're already in the signal group for server \`${message.channel.guild.name}\`!`);
            }
        },
    },
    {
        commands: ['leavesignal'],
        description: `Leave the signal group so you don't get pinged to play anymore.`,
        adminOnly: false,
        activatedOnly: true,
        onMessage: message => {
            var signalsForServer = utils.findSignalsByServerId(message.channel.guild.id);
            if (signalsForServer) {
                var prevLength = signalsForServer.playerIds.length;
                _.pull(signalsForServer.playerIds, message.author.id);
                if (signalsForServer.playerIds.length != prevLength) {
                    bot.reply(message, `You have been removed from the mafia signal for server \`${message.channel.guild.name}\`!`);
                } else {
                    bot.reply(message, `You're not even in the signal group for server \`${message.channel.guild.name}\`!`);
                }
            } else {
                bot.reply(message, `There's no one in the signal group for server \`${message.channel.guild.name}\`! Use the *${pre}joinsignal* command to join it.`);
            }
        },
    },
    {
        commands: ['roles'],
        description: 'Show all available roles',
        adminOnly: false,
        activatedOnly: true,
        onMessage: message => {
            bot.channelMessage(message.channel.id, `Current list of available roles:${game.listRoles(game.roles)}\n\nAnd mods that can be applied to each role:${game.listMods(game.mods)}`);
        },
    },
    {
        commands: ['rolesets'],
        description: `Show all available rolesets names for you to choose with *${pre}startgame*`,
        adminOnly: false,
        activatedOnly: true,
        onMessage: message => {
            bot.channelMessage(message.channel.id, `Current list of available rolesets for use with *${pre}startgame*:${game.listRolesetNames(game.getRolesets())}`);
        },
    },
    {
        commands: ['addroleset'],
        description: 'Add a roleset to the random rotation',
        adminOnly: false,
        activatedOnly: true,
        onMessage: (message, args) => {
            const formatError = `That's the incorrect format!. To add a roleset, use the following format:\n\`${pre}addroleset [roleset id] | [faction1] [mod1]+[role1], [faction2] [mod2]+[mod3]+[role2], etc...\`\nex: *${pre}addroleset coolrolesetup | town vanilla, town bp+miller+insanecop, mafia roleblocker, independent inno+serialkiller*`;

            var name = args[1];
            var rolelistText = message.content.split('|')[1];
            if (typeof(name) === 'string' && typeof(rolelistText) === 'string') {
                var rolesets = game.getRolesets();
                if (!_.find(rolesets, {name: name})) {
                    var rolelist = rolelistText.split(',').map(item => item.trim().split(' '));
                    var error = null;
                    if (!_.every(rolelist, role => role.length == 2)) {
                        error = formatError;
                    } else if (!_.every(rolelist, role => _.find(factions, {id: role[0]}))) {
                        var badFaction = _.find(rolelist, role => !_.find(factions, {id: role[0]}))[0];
                        error = `The faction *${badFaction}* is not a valid faction ID. Make sure to use the ID and not the full name. Use *${pre}factions* to see the list of available factions.`;
                    } else {
                        for (var i = 0; i < rolelist.length; i++) {
                            var splitRoles = rolelist[i][1].split('+');
                            var baseRole = splitRoles.pop();
                            if (!_.find(roles, {id: baseRole})) {
                                if (_.find(mods, {id: baseRole})) {
                                    error = `The role *${baseRole}* is not a valid role ID, but it is a valid mod ID. Make sure that you always have a base role to attach mods to, and follow the mod format: \`[mod1]+[mod2]+[role]\`. Use *${pre}roles* to see the list of available roles and mods.`;
                                } else {
                                    error = `The role *${baseRole}* is not a valid role ID. Make sure to use the ID and not the full name. Use *${pre}roles* to see the list of available roles.`;
                                }
                            }
                            var badMod = _.find(splitRoles, mod => !_.find(mods, {id: mod}));
                            if (badMod) {
                                if (_.find(roles, {id: badMod})) {
                                    error = `The mod *${badMod}* is not a valid mod ID, but it is a valid role ID. Make sure that you only use one base role at a time, and follow the mod format: \`[mod1]+[mod2]+[role]\`. Use *${pre}roles* to see the list of available roles and mods.`;
                                } else {
                                    error = `The mod *${badMod}* is not a valid mod ID. Make sure to use the ID and follow the mod format: \`[mod1]+[mod2]+[role]\`. Use *${pre}roles* to see the list of available roles and mods.`;
                                }
                            }
                        }
                    }
                    if (!error) {
                        const rolesetHasher = rs => rs.reduce((acc, item) => {
                            var str = item.faction + item.role; 
                            acc[str] = (acc[str] || 0) + 1; 
                            return acc;
                        }, {});
                        var newRoleset = {name: name, roles: rolelist.map(item => ({faction: item[0], role: item[1]}))};
                        var newRolesetHash = rolesetHasher(newRoleset.roles);
                        var existingRoleset = _.find(rolesets, roleset => _.isEqual(newRolesetHash, rolesetHasher(roleset.roles)));
                        if (!existingRoleset) {
                            rolesets.push(newRoleset);
                            rolesets = _.sortBy(rolesets, rs => rs.roles.length);
                            game.saveRoleSets(rolesets);
                            bot.reply(message, `Added new roleset named *${newRoleset.name}*!`);
                        } else {
                            bot.reply(message, `There already exists a roleset with that set of roles, with the name *${existingRoleset.name}*!`);
                        }
                    } else {
                        bot.reply(message, error);
                    }
                } else {
                    bot.reply(message, `There already exists a roleset named *${name}*! Use ${pre}deleteroleset to delete it and then re-add it.`);
                }
            } else {
                bot.reply(message, formatError);
            }
        },
    },
    {
        commands: ['deleteroleset'],
        description: 'Delete a roleset',
        adminOnly: true,
        activatedOnly: true,
        onMessage: (message, args) => {
            var name = args[1];
            var rolesets = game.getRolesets();
            var existingRoleset = _.find(rolesets, {name: name});
            if (existingRoleset) {
                _.pull(rolesets, existingRoleset);
                game.saveRoleSets(rolesets);
                bot.reply(message, `Deleted roleset named *${existingRoleset.name}*!`);
            } else {
                bot.reply(message, `There is no roleset with the name *${name}*! Use ${pre}rolesets command to see the list of available rolesets.`);
            }
        },
    },
    {
        commands: ['admin', 'admins'],
        description: 'Show list of admins for MafiaBot',
        adminOnly: false,
        activatedOnly: false,
        onMessage: message => {
            bot.channelMessage(message.channel.id, `Admins of MafiaBot:${utils.listUsers(config.admins)}`);
        },
    },
    {
        commands: ['host', 'hosts'],
        description: 'Show host of current game in channel',
        adminOnly: false,
        activatedOnly: true,
        onMessage: message => {
            var gameInChannel = utils.findGameById(message.channel.id);
            if (gameInChannel) {
                bot.channelMessage(message.channel.id, `Host of current game in channel:\n<@${gameInChannel.hostId}>`);
            } else {
                bot.reply(message, `There's no game currently running in <#${message.channel.id}>!`);
            }
        },
    },
    {
        commands: ['player', 'players', 'playerlist'],
        description: 'Show current list of players of game in channel',
        adminOnly: false,
        activatedOnly: true,
        onMessage: message => {
            var gameInChannel = utils.findGameById(message.channel.id);
            if (gameInChannel) {
                var printPlayersFunc = gameInChannel.state === STATE.GAMEOVER ? printCurrentPlayersWithTrueRole : printCurrentPlayers;
                printPlayersFunc(message.channel.id);
            } else {
                bot.reply(message, `There's no game currently running in <#${message.channel.id}>!`);
            }
        },
    },
    {
        commands: ['myrole'],
        description: 'Sends you a PM of your role info again',
        adminOnly: false,
        activatedOnly: true,
        onMessage: message => {
            var gameInChannel = utils.findGameById(message.channel.id);
            if (gameInChannel) {
                var player = utils.findPlayerByGameAndPlayerId(gameInChannel, message.author.id);
                if (player) {
                    sendPlayerRoleInfo(player);
                }
            } else {
                bot.reply(message, `There's no game currently running in <#${message.channel.id}>!`);
            }
        },
    },
    {
        commands: ['day', 'info'],
        description: 'Show current day information',
        adminOnly: false,
        activatedOnly: true,
        onMessage: message => {
            if (!printDayState(message.channel.id)) {
                bot.reply(message, `There's no game currently running in <#${message.channel.id}>!`);
            }
        },
    },
    {
        commands: ['votes', 'votals'],
        description: 'Show current list of votes for the game in channel',
        adminOnly: false,
        activatedOnly: true,
        onMessage: message => {
            if (!printCurrentVotes(message.channel.id)) {
                bot.reply(message, `There's no game currently running in <#${message.channel.id}>!`);
            }
        },
    },
    {
        commands: ['votehistory', 'votalhistory'],
        description: 'Show list of votals at the end of each previous day for the game in channel',
        adminOnly: false,
        activatedOnly: true,
        onMessage: message => {
            var gameInChannel = utils.findGameById(message.channel.id);
            if (gameInChannel) {
                if (gameInChannel.voteHistory.length) {
                    var output = ``;
                    for (var i = 0; i < gameInChannel.voteHistory.length; i++) {
                        var voteHistory = gameInChannel.voteHistory[i];
                        output += `***Day ${voteHistory.day}:*** `;
                        output += utils.listVotes(voteHistory.votes, message.channel.id);
                        if (i != gameInChannel.voteHistory.length - 1) {
                            output += `\n\n`;
                        }
                    }
                    bot.channelMessage(message.channel.id, output);
                } else {
                    bot.reply(message, `There's no vote history yet! Use ${pre}votelog to see the current day's log!`);
                }
            } else {
                bot.reply(message, `There's no game currently running in <#${message.channel.id}>!`);
            }
        },
    },
    {
        commands: ['votelog'],
        description: 'Show a detailed log of every vote made for the game in channel',
        adminOnly: false,
        activatedOnly: true,
        onMessage: message => {
            var gameInChannel = utils.findGameById(message.channel.id);
            if (gameInChannel) {
                if (gameInChannel.voteLog.length > 1) {
                    var output = ``;
                    var day = 0;
                    var n = 1;
                    for (var i = 0; i < gameInChannel.voteLog.length; i++) {
                        var log = gameInChannel.voteLog[i];
                        if (log.day != null) {
                            output += `***Day ${log.day}:*** `;
                            n = 0;
                        } else if (log.targetName === 'NL') {
                            output += `${n}. \`${log.playerName}\` NL`;
                        } else if (log.targetName === null) {
                            output += `${n}. \`${log.playerName}\` un`;
                        } else {
                            output += `${n}. \`${log.playerName}\` -> \`${log.targetName}\``;
                        }
                        n++;
                        if (i != gameInChannel.voteLog.length - 1) {
                            output += `\n`;
                            if (gameInChannel.voteLog[i + 1].day != null) {
                                output += `\n`;
                            }
                        }
                    }
                    bot.channelMessage(message.channel.id, output);
                } else {
                    bot.reply(message, `There's no vote logs yet!`);
                }
            } else {
                bot.reply(message, `There's no game currently running in <#${message.channel.id}>!`);
            }
        },
    },
    {
        commands: ['creategame'],
        description: 'Create a game in this channel and become the host',
        adminOnly: false,
        activatedOnly: true,
        onMessage: message => {
            var gameInChannel = utils.findGameById(message.channel.id);
            if (gameInChannel) {
                bot.reply(message, `A game is already running in <#${message.channel.id}> hosted by <@${gameInChannel.hostId}>!`);
            } else {
                gameInChannel = {
                    hostId: message.author.id,
                    channelId: message.channel.id,
                    mafiaChannelId: null,
                    players: [],
                    roleset: '',
                    votesToEndGame: [],
                    state: STATE.INIT,
                    previousState: null,
                    day: 0,
                    votes: [],
                    voteHistory: [],
                    voteLog: [],
                    nightActions: [],
                    nightKills: {},
                    mafiaDidNightAction: false,
                    timeLimit: config.dayTimeLimit,
                    votesToExtend: [],
                    permissionsTime: config.permissionsInterval,
                    confirmingReminderTime: config.confirmingReminderInterval,
                    nightActionReminderTime: config.nightActionReminderInterval,
                };
                data.games.push(gameInChannel);
                bot.channelMessage(message.channel.id, `Starting a game of mafia in <#${message.channel.id}> hosted by <@${gameInChannel.hostId}>!`);
            }
        },
    },
    {
        commands: ['endgame'],
        description: 'Current host, admin, or majority of players can end the game in this channel',
        adminOnly: false,
        activatedOnly: true,
        onMessage: message => {
            var gameInChannel = utils.findGameById(message.channel.id);
            var endGame = becauseOf => {
                _.remove(data.games, gameInChannel);
                bot.deleteChannel(gameInChannel.mafiaChannelId);
                bot.channelMessage(message.channel.id, `${becauseOf} ended game of mafia in <#${message.channel.id}> hosted by <@${gameInChannel.hostId}>! 😥`);

                // enable talking just in case it was off
                var gameChannel = findChannelById(gameInChannel.channelId);
                var everyoneId = findRoleEveryoneInGuild(gameChannel);
                bot.overwritePermissions(gameChannel, everyoneId, { sendMessages: true, mentionEveryone: false });
            };
            if (gameInChannel) {
                if (gameInChannel.hostId == message.author.id) {
                    endGame(`Host <@${message.author.id}>`);
                } else if (config.admins.indexOf(message.author.id) >= 0) {
                    endGame(`Admin <@${message.author.id}>`);
                } else if (!!utils.findPlayerByGameAndPlayerId(gameInChannel, message.author.id)) {
                    if (gameInChannel.votesToEndGame.indexOf(message.author.id) >= 0) {
                        bot.reply(message, `We already know you want to end the current game hosted by <@${gameInChannel.hostId}>!`);
                    } else {
                        gameInChannel.votesToEndGame.push(message.author.id);
                        bot.reply(message, `You voted to end the current game hosted by <@${gameInChannel.hostId}>!`);
                        
                        var votesRemaining = game.majorityOf(gameInChannel.players) - gameInChannel.votesToEndGame.length;
                        if (votesRemaining <= 0) {
                            endGame('A majority vote of the players');
                        } else {
                            bot.channelMessage(message.channel.id, `Currently ${s(gameInChannel.votesToEndGame.length, 'vote')} to end the current game hosted by <@${gameInChannel.hostId}>. ${s(votesRemaining, 'vote')} remaining!`);
                        }
                    }
                } else {
                    bot.reply(message, `Only admins, hosts, and joined players can end a game!`);
                }
            } else {
                bot.reply(message, `There's no game currently running in <#${message.channel.id}>!`);
            }
        },
    },
    {
        commands: ['startgame'],
        description: 'Host can start game with current list of players, optionally specifying the name of a roleset to use.',
        adminOnly: false,
        activatedOnly: true,
        onMessage: (message, args) => {
            var gameInChannel = utils.findGameById(message.channel.id);
            if (gameInChannel) {
                if (gameInChannel.hostId == message.author.id) {
                    if (gameInChannel.state == STATE.INIT) {
                        // see if there are any available rolesets for this number of players
                        var possibleRolesets = game.getPossibleRolesets(gameInChannel.players.length);

                        if (possibleRolesets.length) {
                            // if there was a roleset passed in, use that
                            if (args[1]) {
                                possibleRolesets = _.filter(possibleRolesets, set => set.name === args[1]);
                            }

                            if (possibleRolesets.length) {
                                bot.createChannel(message.guild, 'mafia' + Math.random().toString().substring(2), 'text', 
                                    (mafiaChannel) => {
                                    if (!!mafiaChannel) {
                                        gameInChannel.state = STATE.CONFIRMING;
                                        gameInChannel.mafiaChannelId = mafiaChannel.id;
                                        gameInChannel.confirmingReminderTime = config.confirmingReminderInterval;

                                        bot.channelMessage(message.channel.id, `Sending out roles for game of mafia hosted by <@${gameInChannel.hostId}>! Check your PMs for info and type **${pre}confirm** in this channel to confirm your role.`);
                                        printCurrentPlayers(message.channel.id);

                                        var roleset = game.pickRoleSet(possibleRolesets);
                                        gameInChannel.roleset = roleset.name;

                                        console.log(`>>INFO Picking roleset: ${roleset.name}`);
                                        // randomly assign and send roles
                                        var shuffledRoles = _.shuffle(roleset.roles);
                                        for (var i = 0; i < gameInChannel.players.length; i++) {
                                            var player = gameInChannel.players[i];
                                            player.faction = shuffledRoles[i].faction;
                                            player.role = shuffledRoles[i].role;
                                            console.log(`>>INFO Role ${i+1}: ${player.name} as ${player.faction} with ${player.role}`);
                                        }
                                        console.log(`>>INFO Finishing shuffling roles!`);

                                        console.log(`>>INFO Sending roles to players!`);
                                        for (var i = 0; i < gameInChannel.players.length; i++) {
                                            var player = gameInChannel.players[i];
                                            sendPlayerRoleInfo(player);
                                            bot.privateMessage(player.id, `Type **${pre}confirm** in <#${message.channel.id}> to confirm your participation in the game of mafia hosted by <@${gameInChannel.hostId}>.`);
                                        }

                                        console.log(`>>INFO Sending roles to BTSC players!`);
                                        // then send mafia messages
                                        var mafiaPlayers = _.filter(gameInChannel.players, {faction: 'mafia'});
                                        for (var i = 0; i < mafiaPlayers.length; i++) {
                                            var mafiaPlayer = findUserById(mafiaPlayers[i].id);
                                            console.log('>>INFO Sending message to ${mafiaPlayer.name}');
                                            bot.privateMessage(mafiaPlayer, `Use the channel <#${mafiaChannel.id}> to chat with your fellow Mafia team members, and to send in your nightly kill.`);
                                        }

                                        console.log(`>>INFO Printing BTSC info!`);
                                        bot.channelMessage(mafiaChannel.id, `**Welcome to the mafia team!**\nYour team is:${utils.listUsers(_.map(mafiaPlayers, 'id'))}`);
                                        bot.channelMessage(mafiaChannel.id, `As a team you have **1 kill each night**. Use the ***${pre}kill*** command (ex: *${pre}kill fool*) to use that ability when I prompt you in this chat.`);
                                    }
                                });
                            } else {
                                bot.reply(message, `The roleset \`${args[1]}\` is not valid for ${s(gameInChannel.players.length, 'player')}! Use **${pre}rolesets** to view the available rolesets for each player count.`);
                            }
                        } else {
                            bot.reply(message, `Sorry, there are no available rolesets for ${s(gameInChannel.players.length, 'player')}! Use the **${pre}addroleset** command to add a new roleset for this number of players.`);
                        }
                    } else if (gameInChannel.state == STATE.READY) {
                        gameInChannel.state = STATE.DAY;
                        gameInChannel.day = 1;
                        gameInChannel.voteLog.push({day: gameInChannel.day});
                        gameInChannel.timeLimit = config.dayTimeLimit;
                        var livePlayers = _.filter(gameInChannel.players, 'alive');
                        for (var i = 0; i < livePlayers.length; i++) {
                            var player = livePlayers[i];
                            fireEvent(game.getRole(player.role).onGameStart, {game: gameInChannel, player: player});
                        }
                        bot.channelMessage(message.channel.id, `All players have confirmed and host <@${gameInChannel.hostId}> is now starting the game of mafia!`);
                        printCurrentPlayers(message.channel.id);
                        printDayState(message.channel.id);
                    }
                } else {
                    bot.reply(message, `Only hosts can start the game!`);
                }
            } else {
                bot.reply(message, `There's no game currently running in <#${message.channel.id}>!`);
            }
        },
    },
    {
        commands: ['join', 'in'],
        description: 'Join the game in this channel as a player',
        adminOnly: false,
        activatedOnly: true,
        onMessage: message => {
            var gameInChannel = utils.findGameById(message.channel.id);
            if (gameInChannel) {
                if (gameInChannel.state == STATE.INIT) {
                    if (!utils.findPMChannelForPlayerId(message.author.id)) {
                        bot.reply(message, `You need to send me a private message to open up a direct channel of communication between us before you can join a game!`);
                    } else if (!!utils.findPlayerByGameAndPlayerId(gameInChannel, message.author.id)) {
                        bot.reply(message, `You are already in the current game hosted by <@${gameInChannel.hostId}>!`);
                    } else {
                        var newPlayer = {
                            id: message.author.id,
                            name: message.author.username,
                            confirmed: false,
                            alive: true,
                            deathReason: '',
                            faction: null,
                            role: null,
                            roleData: {},
                        };
                        gameInChannel.players.push(newPlayer);
                        bot.channelMessage(message.channel.id, `<@${message.author.id}> joined the current game hosted by <@${gameInChannel.hostId}>!`);
                        printCurrentPlayers(message.channel.id);
                    }
                } else {
                    bot.reply(message, `The current game is already going, so the player list is locked!`);
                }
            } else {
                bot.reply(message, `There's no game currently running in <#${message.channel.id}>!`);
            }
        },
    },
    {
        commands: ['unjoin', 'out', 'leave'],
        description: 'Leave the game in this channel, if you were joined',
        adminOnly: false,
        activatedOnly: true,
        onMessage: message => {
            var gameInChannel = utils.findGameById(message.channel.id);
            if (gameInChannel) {
                if (gameInChannel.state == STATE.INIT) {
                    if (!!utils.findPlayerByGameAndPlayerId(gameInChannel, message.author.id)) {
                        _.pullAllBy(gameInChannel.players, [{id: message.author.id}], 'id');
                        bot.channelMessage(message.channel.id, `<@${message.author.id}> left the current game hosted by <@${gameInChannel.hostId}>!`);
                        printCurrentPlayers(message.channel.id);
                    } else {
                        bot.reply(message, `You are not currently in the current game hosted by <@${gameInChannel.hostId}>!`);
                    }
                } else {
                    bot.reply(message, `The current game is already starting, so the player list is locked!`);
                }
            } else {
                bot.reply(message, `There's no game currently running in <#${message.channel.id}>!`);
            }
        },
    },
    {
        commands: ['confirm'],
        description: 'Confirm your role and your participation in the game',
        adminOnly: false,
        activatedOnly: true,
        onMessage: (message, args) => {
            var gameInChannel = utils.findGameById(message.channel.id);
            if (gameInChannel && gameInChannel.state == STATE.CONFIRMING) {
                var player = utils.findPlayerByGameAndPlayerId(gameInChannel, message.author.id);
                if (player) {
                    player.confirmed = true;
                    bot.reply(message, `Thanks for confirming for the current game hosted by <@${gameInChannel.hostId}>!`);

                    var unconfirmedPlayers = _.filter(gameInChannel.players, {confirmed: false});
                    if (!unconfirmedPlayers.length) {
                        printUnconfirmedPlayers(message.channel.id);
                        gameInChannel.state = STATE.READY;
                    }
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
            var gameInChannel = utils.findGameById(message.channel.id);
            console.log(`>>INFO adding vote for game ${message.channel.name}`);

            if (!!gameInChannel && gameInChannel.state == STATE.DAY) {
                var player = utils.findPlayerByGameAndPlayerId(gameInChannel, message.author.id);
                console.log(`>>INFO adding ${player.name}'s vote ...`);
                if (!!player && player.alive) {
                    var target = utils.findPlayerByNameAndChannelId(args[1], message.channel.id);
                    if (!!target) {
                        console.log(`>>INFO Found player ${target} where intention was ${args[1]} ...`);
                        if (!target.alive) {
                            bot.reply(message, `You can't vote for the dead player ${args[1]}!`);
                        } else if (target.id == message.author.id) {
                            bot.reply(message, `You can't vote for yourself!`);
                        } else {
                            console.log(`>>INFO Vote is valid ... counting`);
                            _.pullAllBy(gameInChannel.votes, [{playerId: message.author.id}], 'playerId');
                            gameInChannel.votes.push({playerId: message.author.id, targetId: target.id, time: new Date()});
                            gameInChannel.voteLog.push({playerName: message.author.username, targetName: target.name});
                            console.log(`>>INFO Votes changed successfully!`);
                            bot.channelMessage(message.channel.id, `<@${message.author.id}> voted to lynch <@${target.id}>!`);

                            printCurrentVotes(message.channel.id);
                            utils.checkForLynch(message.channel.id);
                        }
                    } else {
                        console.log(`>>INFO Not a valid target ...`);
                        if(!!args[1]){
                            bot.reply(message, `'${args[1]}' is not a valid vote target!`);    
                        } else {
                            bot.reply(message, `I did not see a vote there, give me a name or use ${pre}NL to abstain`);
                        }
                        
                    }
                }
            }
        },
    },
    {
        commands: ['nl', 'nolynch', 'abstain'],
        description: 'Vote for no lynch today',
        adminOnly: false,
        activatedOnly: true,
        onMessage: (message, args) => {
            var gameInChannel = utils.findGameById(message.channel.id);
            if (gameInChannel && gameInChannel.state == STATE.DAY) {
                var player = utils.findPlayerByGameAndPlayerId(gameInChannel, message.author.id);
                if (player && player.alive) {
                    _.pullAllBy(gameInChannel.votes, [{playerId: message.author.id}], 'playerId');
                    gameInChannel.votes.push({playerId: message.author.id, targetId: 'NO LYNCH', time: new Date()});
                    gameInChannel.voteLog.push({playerName: message.author.username, targetName: 'NL'});
                    bot.channelMessage(message.channel.id, `<@${message.author.id}> voted to No Lynch!`);

                    printCurrentVotes(message.channel.id);
                    utils.checkForLynch(message.channel.id);
                }
            }
        },
    },
    {
        commands: ['unvote', 'unlynch', 'un'],
        description: 'Remove your vote to lynch a player',
        adminOnly: false,
        activatedOnly: true,
        onMessage: (message, args) => {
            var gameInChannel = utils.findGameById(message.channel.id);
            if (gameInChannel && gameInChannel.state == STATE.DAY) {
                var player = utils.findPlayerByGameAndPlayerId(gameInChannel, message.author.id);
                if (player && player.alive) {
                    var vote = _.find(gameInChannel.votes, {playerId: message.author.id});
                    _.pullAllBy(gameInChannel.votes, [{playerId: message.author.id}], 'playerId');
                    gameInChannel.voteLog.push({playerName: message.author.username, targetName: null});
                    var targetString = vote ? vote.targetId === 'NO LYNCH' ? ' No Lynch' : ` <@${vote.targetId}>` : '... nothing';
                    bot.channelMessage(message.channel.id, `<@${message.author.id}> unvoted${targetString}!`);
                    printCurrentVotes(message.channel.id);
                }
            }
        },
    },
    {
        commands: ['extend'],
        description: `Vote to extend the day time limit by ${s(Math.floor(config.dayTimeLimitExtension/(60*1000)), 'minute')}`,
        adminOnly: false,
        activatedOnly: true,
        onMessage: (message, args) => {
            var gameInChannel = utils.findGameById(message.channel.id);
            if (gameInChannel && gameInChannel.state == STATE.DAY) {
                var player = utils.findPlayerByGameAndPlayerId(gameInChannel, message.author.id);
                if (player && player.alive) {
                    if (gameInChannel.votesToExtend.indexOf(player.id) >= 0) {
                        bot.reply(message, `We already know you want to extend the day!`);
                    } else {
                        gameInChannel.votesToExtend.push(player.id);
                        bot.reply(message, `You voted to extend the day time limit!`);
                        
                        var votesRemaining = game.majorityOf(_.filter(gameInChannel.players, 'alive')) - gameInChannel.votesToExtend.length;
                        if (votesRemaining <= 0) {
                            gameInChannel.timeLimit += config.dayTimeLimitExtension;
                            gameInChannel.votesToExtend.length = 0;
                            bot.channelMessage(message.channel.id, `***The day time limit was extended by ${s(Math.floor(config.dayTimeLimitExtension/(60*1000)), 'minute')}!*** How exciting...`);
                        } else {
                            bot.channelMessage(message.channel.id, `Currently ${s(gameInChannel.votesToExtend.length, 'vote')} to extend the day. ${s(votesRemaining, 'vote')} remaining!`);
                        }
                    }
                }
            }
        },
    },
];

//#3 set up discord events
bot.on('message', async message => {
	//don't talk to bots
	if(message.author.bot) return;
	
	//easy debug
	if (message.content === 'ping') {
		message.reply('pong');
		return;
	}
	
    bot.latestChannel = message.channel.id; // for error handling purposes
	//console.dir(message);	
	
    var contentLower = message.content.toLowerCase(),
		args = message.content.split(/[ :]/);
    args[0] = args[0].substring(pre.length);
	
	if(!config.silentMode) console.log(`>>DEBUG Command received: `+(contentLower.indexOf(pre) == 0));
	
    // go through all the base commands and see if any of them have been called
    if (contentLower.indexOf(pre) == 0) {
        var anyCommandMatched = false;
        for (var i = 0; i < baseCommands.length; i++) {
            var comm = baseCommands[i];
            var commandMatched = false;
            for (var c = 0; c < comm.commands.length; c++) {
                commandMatched = 
                    args[0].toLowerCase().indexOf(comm.commands[c].toLowerCase()) == 0 && 
                    args[0].length == comm.commands[c].length;
                if (commandMatched) {
                    break;
                }
            }
            anyCommandMatched = anyCommandMatched || commandMatched;
            if (commandMatched) {
                if (!comm.adminOnly || adminCheck(message)) {
                    if (!comm.activatedOnly || activatedCheck(message)) {
                        comm.onMessage(message, args);
                    }
                }
                break;
            }
        }
        // call default command if no command was matched, but there was still a command prefix (like '--xxx')
        if (!anyCommandMatched) {
            var defaultComm = _.find(baseCommands, {default: true});
            if (defaultComm) {
                if (!defaultComm.adminOnly || adminCheck(message)) {
                    if (!defaultComm.activatedOnly || activatedCheck(message)) {
                        // args needs to be slightly modified for default commands (so '--xxx' has args ['', 'xxx'])
                        var args = [''].concat(message.content.split(/[ :]/));
                        args[1] = args[1].substring(pre.length);
                        defaultComm.onMessage(message, args);
                    }
                }
            }
        }
    }

    // receiving a PM
    if (message.channel.recipient) {
        // pm channel setup
        if (!utils.findPMChannelForPlayerId(message.channel.recipient.id)) {
            data.pmChannels.push({playerId: message.channel.recipient.id, channelId: message.channel.id});
            bot.reply(message, 'Thanks for the one-time private message to open a direct channel of communication between us! You can now join and play mafia games on this server.');
        }
        
        var gameWithPlayer = utils.findGameByPlayerId(message.author.id);
        if (gameWithPlayer) {
            var player = utils.findPlayerByGameAndPlayerId(gameWithPlayer, message.author.id);
            var role = game.getRole(player.role);
            if (contentLower.indexOf(pre) == 0) {
                fireEvent(role.onPMCommand, {message: message, args: args, game: gameWithPlayer, player: player});
            }
        }
    }

    // receiving command from mafia channel
    var game = _.find(data.games, {mafiaChannelId: message.channel.id});
    if (game && contentLower.indexOf(pre) == 0) {
        // terrible chunk of code to emulate a vig kill
        var player = utils.findPlayerNameByGameAndPlayerId(gameInChannel, message.author.id);
        var actionText = 'mafia kill';
        if (game.state == STATE.NIGHT && player && player.alive) {
            if (args[0].toLowerCase() == 'kill') {
                var target = utils.findClosestPlayerNameInGame(args[1], game);
                if (target && target.alive) {
                    game.nightActions = _.reject(game.nightActions, {action: actionText}); // clear any mafia kill, not just the current player's
                    game.nightActions.push({ 
                        action: actionText,
                        playerId: player.id,
                        targetId: target.id,
                    });
                    game.mafiaDidNightAction = true;
                    // make sure not to ping non-mafia players in the mafia chat
                    bot.reply(message, `**You are killing *${utils.findPlayerNameByGameAndPlayerId(game, target.id)}* tonight!** Type ***${pre}cancel*** to cancel.`);
                } else {
                    bot.reply(message, `*${args[1]}* is not a valid target!`);
                }
            } else if (args[0].toLowerCase() == 'cancel' || args[0].toLowerCase() == 'noaction') {
                var action = _.find(game.nightActions, {action: actionText});
                if (action) {
                    game.mafiaDidNightAction = false;
                    bot.reply(message, `**You have canceled killing *${utils.findPlayerNameByGameAndPlayerId(game, action.targetId)}*.**`);
                }
                game.nightActions = _.reject(game.nightActions, {action: actionText});
                if (args[0].toLowerCase() == 'noaction') {
                    game.mafiaDidNightAction = true;
                    bot.reply(message, `**You are taking no action tonight.**`);
                }
            } else {
                // made a command but it's not a kill, so they are likely trying to use their power role in mafia chat
                bot.reply(message, `**If you have a power role, you must send me a private message separate from this chat to make that action!**`);
            }
        }
    }

    // save data after every message
    utils.saveData(data);
});
//#4 disconnected
bot.on('disconnected', () => {
    throw "Disconnected - rebooting!";
});

// main loop
var t = new Date();

var mainLoop = function() {
    // timing stuff
    var now = new Date();
    var dt = now - t;
    t = now;

    // game-specific loops
    for (var i = 0; i < data.games.length; i++) {
        var currentGame = data.games[i];
        bot.latestChannel = currentGame.channelId; // for error handling purposes

        // make sure permissions are set properly
        currentGame.permissionsTime -= dt;
        if (currentGame.permissionsTime <= 0 || currentGame.previousState != game.state) {
            var gameChannel = findChannelById(currentGame.channelId);
            var everyoneId = findRoleEveryoneInGuild(gameChannel);
			
            if (currentGame.state != STATE.NIGHT) {
                // everyone can talk
				if(!config.silentMode) {
					console.log(`>>DEBUG Permissions overwrite for everyone: ${everyoneId}`);
				}
				
                bot.overwritePermissions(gameChannel, everyoneId, { sendMessages: true, mentionEveryone: false });
            } else {
                // everyone can't talk
				console.log(`>>DEBUG PERMISSIONS for me: ${bot.user}`);
                bot.overwritePermissions(gameChannel, bot.user, { managePermissions: true }, (error) => {
                    if (!error) {
						console.log(`>>DEBUG PERMISSIONS for everyone: ${everyoneId}`);
                        gameChannel.overwritePermissions(everyoneId, { sendMessages: false, managePermissions: false, mentionEveryone: false });
                    }
                });
                // host can talk
                var host = findHostByGame(currentGame);
				bot.overwritePermissions(gameChannel, host, { sendMessages: true }, (error) => {
                    if (!error) {
                        console.log(`>> Can't touch host`);
                    }
                });
            }
			
            if (currentGame.mafiaChannelId) {
                var mafiaChannel = findChannelById(currentGame.mafiaChannelId);
                if (currentGame.state != STATE.GAMEOVER) {
                    // mafia chat blocked to all
                    bot.overwritePermissions(mafiaChannel, bot.user, { managePermissions: true }, (error) => {
                        if (!error) {
                            bot.overwritePermissions(mafiaChannel, everyoneId, { readMessages: false, sendMessages: false, managePermissions: false, mentionEveryone: false });
                        }
                    });
                    // mafia players can chat in mafia chat
                    var mafiaPlayers = _.filter(currentGame.players, {faction: 'mafia'});
                    bot.overwritePermissions(mafiaChannel, bot.user, { managePermissions: true }, (error) => {
                        for (var i = 0; i < mafiaPlayers.length; i++) {
                            var mafiaPlayer = findUserById(mafiaPlayers[i].id);
                            bot.overwritePermissions(mafiaChannel, mafiaPlayer, { readMessages: true, sendMessages: true });
                        }
                    });
                } else {
                    // mafia open to all players
                    for (var i = 0; i < currentGame.players.length; i++) {
                        var player = findUserById(currentGame.players[i].id);
                        bot.overwritePermissions(mafiaChannel, player, { readMessages: true, sendMessages: true });
                    }
                }
            }
            currentGame.permissionsTime = config.permissionsInterval;
        }

        // state-based stuff

        if (currentGame.state == STATE.CONFIRMING) {
            // send confirming action reminders
            currentGame.confirmingReminderTime -= dt;
			console.log(`>>DEBUG State: CONFIRMING ...`);
            if (currentGame.confirmingReminderTime <= 0) {
                printUnconfirmedPlayers(currentGame.channelId);
                currentGame.confirmingReminderTime = config.confirmingReminderInterval;
            }
        }

        if (currentGame.state == STATE.DAY) {
            // count down to no lynch
            currentGame.timeLimit -= dt;
			console.log(`>>DEBUG State: DAY ...`);
            if (currentGame.timeLimit <= 0) {
                printCurrentVotes(currentGame.channelId);
                endDay(currentGame.channelId, 'NO LYNCH');
            } else {
                var prevMinute = Math.floor((currentGame.timeLimit + dt)/(1000*60));
                var currMinute = Math.floor(currentGame.timeLimit/(1000*60));
                if (currentGame.timeLimit <= config.dayTimeLimitWarning && prevMinute != currMinute) {
					bot.channelMessage(currentGame.channelId, `**WARNING:** Only ***${s(currMinute + 1, 'minute')}*** left until an automatic **No Lynch**! Use ***${pre}extend*** to vote for a ${Math.floor(config.dayTimeLimitExtension/(60*1000))}-minute time limit extension.`);
				}
            }
        }

        if (currentGame.state == STATE.NIGHT) {
			console.log(`>>DEBUG State: NIGHT ...`);
            var livePlayers = _.filter(currentGame.players, 'alive');

            // check if all townies and the mafia chat have finished night actions and if so, start the day countdown
            var allNightActionsFinished = _.every(livePlayers, (player) => {
                var result = fireEvent(game.getRole(player.role).isFinished, {game: game, player: player});
                return result === null || result === true;
            });
            allNightActionsFinished = allNightActionsFinished && currentGame.mafiaDidNightAction;
            if (allNightActionsFinished) {
                currentGame.timeToNightActionResolution -= dt;
                console.log('Time to day:', currentGame.timeToNightActionResolution);
            } else {
                currentGame.timeToNightActionResolution = config.nightActionBufferTime * (1 + Math.random()/2);
            }
            
            // count down to forcing night action resolution
            currentGame.timeLimit -= dt;
            if (currentGame.timeLimit <= 0) {
                for (var i = 0; i < livePlayers.length; i++) {
                    var player = livePlayers[i];
                    fireEvent(game.getRole(player.role).onForceNightAction, {game: currentGame, player: player});
                }
                if (!currentGame.mafiaDidNightAction) {
                    bot.channelMessage(currentGame.mafiaChannelId, `**The night action time limit ran out and you were forced to no action!** Hurry up next time...`);
                }
                currentGame.timeToNightActionResolution = 0;
            }

            // resolve night actions and begin day after countdown
            if (currentGame.timeToNightActionResolution <= 0) {
                for (var i = 0; i < livePlayers.length; i++) {
                    var player = livePlayers[i];
                    fireEvent(game.getRole(player.role).preBlockingPhase, {game: currentGame, player: player});
                }
                for (var i = 0; i < livePlayers.length; i++) {
                    var player = livePlayers[i];
                    fireEvent(game.getRole(player.role).onBlockTargetingPhase, {game: currentGame, player: player});
                }
                for (var i = 0; i < livePlayers.length; i++) {
                    var player = livePlayers[i];
                    fireEvent(game.getRole(player.role).onTargetingPhase, {game: currentGame, player: player});
                }
                for (var i = 0; i < livePlayers.length; i++) {
                    var player = livePlayers[i];
                    fireEvent(game.getRole(player.role).onBlockingPhase, {game: currentGame, player: player});
                }
                for (var i = 0; i < livePlayers.length; i++) {
                    var player = livePlayers[i];
                    fireEvent(game.getRole(player.role).onActionPhase, {game: currentGame, player: player});
                }
                // just do the mafia kill action here, why not
                var mafiaAction = _.find(currentGame.nightActions, {action: 'mafia kill'});
                if (mafiaAction) {
                    currentGame.nightKills[mafiaAction.targetId] = (currentGame.nightKills[mafiaAction.targetId] || 0) + bulletKill;
                }
                for (var i = 0; i < livePlayers.length; i++) {
                    var player = livePlayers[i];
                    fireEvent(game.getRole(player.role).onNightResolved, {game: currentGame, player: player});
                }
                // figure out who died
                var deadPlayers = [];
                for (var playerId in currentGame.nightKills) {
                    if (currentGame.nightKills[playerId] > 0) {
                        var deadPlayer = utils.findPlayerNameByGameAndPlayerId(currentGame, playerId),
                            bulletproofBlocked = currentGame.nightKills[playerId] % bulletKill === 0 && game.getRole(deadPlayer.role).bulletproof;
                        if (!bulletproofBlocked) {
                            deadPlayer.alive = false;
                            deadPlayer.deathReason = 'Died N' + currentGame.day;
                            deadPlayers.push(deadPlayer);
                        }
                    }
                }
                // start day
                currentGame.state = STATE.DAY;
                currentGame.day++;
                currentGame.votes.length = 0;
                currentGame.voteLog.push({day: currentGame.day});
                currentGame.nightActions.length = 0;
                currentGame.nightKills = {};
                currentGame.timeLimit = config.dayTimeLimit;
                bot.channelMessage(currentGame.channelId, `**All players have finished night actions!**`);
                bot.channelMessage(currentGame.channelId, `***${s(deadPlayers.length, 'player', 's have', ' has')} died.***`, 1000);
                for (var i = 0; i < deadPlayers.length; i++) {
                    var deadPlayer = deadPlayers[i];
                    bot.channelMessage(game.channelId, `<@${deadPlayer.id}>, the **${game.getFaction(deadPlayer.faction).name} ${game.getRole(deadPlayer.role).name}**, has died!`, 1000);
                }
                if (!checkForGameOver(currentGame.channelId)) {
                    bot.channelMessage(currentGame.channelId, `Day ${currentGame.day} is now starting.`, 2000);
                    printCurrentPlayers(currentGame.channelId);
                    printDayState(currentGame.channelId);
                }
            }

            // send night action reminders
            currentGame.nightActionReminderTime -= dt;
            if (currentGame.nightActionReminderTime <= 0) {
                var remind = (playerName, channelId) => {
                    console.log('Reminding:', playerName);
                    bot.channelMessage(channelId, `**HEY! *LISTEN!!*** You have ${s(Math.floor(currentGame.timeLimit/(60*1000)), 'minute')} to register a night action before night ends! Remember to use the ***${pre}noaction*** command to confirm you are active, even if you have no night power!`);
                }
                for (var i = 0; i < livePlayers.length; i++) {
                    var player = livePlayers[i];
                    var result = fireEvent(game.getRole(player.role).isFinished, {game: currentGame, player: player});
                    if (!(result === null || result === true)) {
                        remind(player.name, player.id);
                    }
                }
                if (!currentGame.mafiaDidNightAction) {
                    remind('mafia', game.mafiaChannelId);
                }
                currentGame.nightActionReminderTime = config.nightActionReminderInterval;
            }
        }

        // for detecting when there is a state change
        currentGame.previousState = currentGame.state;
    }

    // save and wait for next loop
    utils.saveData(data);
    setTimeout(mainLoop, Math.max(config.mainLoopInterval - (new Date() - now), 0));
};

module.exports = bot;