# MafiaBot

A Discord bot for hosting a game of Den Mafia!

* Check out [Den Mafia's home](http://mafiamaniac.net/index.php?showforum=3) for guides and information!

## Features

* Compatible with Discord 11+ API.
* Only plays Scum Mafia games. **Roadmap: implement Den Mafia roster voting and rules - see [here](http://mafiamaniac.net/index.php?showtopic=685)**
* Fully scriptable linear-flow role system with [mixins](roles/mods) for super flexible yet simple role definitions.
* Add your own role setups using any combination of roles and mixins for any number of players.
* Configurable role setup variations which randomly change setups to get more fun and surprise out of your setups.
* Custom data store system that is IMPERVIOUS to corruption and crashes.
* Total control of user speech and group chat permissions to fully enforce no-talking-at-night and secret mafia chat rules.
* Keeps track of many in-game statistics such as a history of all votes made by every player.

## Install

* Node.js 8.0.0 or newer is required (because of current discord.js requirements)

```sh
$ npm install
```

* Add the bot to the Discord server (using https://discordapp.com/oauth2/authorize?client_id=CLIENT_ID_HERE&scope=bot with the `CLIENT_ID_HERE` replaced by the actual token)
* Give the bot a role that allows him to overwrite permissions and create/delete channels (won't work on Admin role obviously).

## Config

* Setup all the admin user ID values in `config.js`  
* Setup the bot's user token in `creds.js` (follow the [Discord developer guide](https://discordapp.com/developers/docs/intro) to get the token)
* Change settings in `config.js` to have a mainChannel assigned to receive debug messages
* `defaultChannelId` id to use for debugging purposes
* `defaultChannelName` use this name as fallback to the id above
* `silentMode` set to false to enable debug messages to be sent to the mainChannel

## Run

```sh
$ npm start
```

## Debug

Install [Node Inspector](https://github.com/node-inspector/node-inspector), then:
```sh
$ node-debug --nodejs mafia-debug.js
```

## Credits
Tombolo: *Role setup contributions*  
foolmoron: *First version*  
araver82: *porting to discord 11+, adding Den Mafia style*

## Command list

### General commands 
* `--commands/help/wut` - Show list of commands
* `--feedback/bug/bugreport` - Send feedback and comments and suggestions about MafiaBot to the admin
* `--credits` - Show credits for MafiaBot
* `--admin/admins` - Show list of admins for MafiaBot

### Admin commands
* `--reboot` - Reboots MafiaBot on the server
* `--activatemafia` - Activate MafiaBot on this channel
* `--deactivatemafia` - Deactivate MafiaBot on this channel

### Signup / Pre-Game commands - *Activated Channel Only*
* `--signal/letsplay` - Let people know that you want to play some mafia. Pings everyone players who joined the signal group with `--joinsignal`.
* `--joinsignal` - Join the signal group so you are pinged to play anytime someone uses the `--signal` command.
* `--leavesignal` - Leave the signal group so you don't get pinged to play anymore.
* `--roles` - Show all available roles
* `--rolesets` - Show all available rolesets names for you to choose with `--startgame`
* `--creategame` - Create a game in this channel and become the host
* `--startgame` - Host can start game with current list of players, optionally specifying the name of a roleset to use.
* `--host/hosts` - Show host of current game in channel
* `--join/in` - Join the game in this channel as a player
* `--unjoin/out/leave` - Leave the game in this channel, if you were joined

* **broken** `--addroleset` - Add a roleset to the random rotation - Activated Channel Only
* **broken** `--deleteroleset` - Delete a roleset - Admin Only - Activated Channel Only

### In-Game commands - *Activated Channel Only*
* `--confirm` - Confirm your role and your participation in the game

* `--vote/lynch` - Vote to lynch a player
* `--nl/nolynch/abstain` - Vote for no lynch today
* `--unvote/unlynch/un` - Remove your vote to lynch a player
* `--extend` - Vote to extend the day time limit by 5 minutes

* `--player/players/playerlist` - Show current list of players of game in channel
* `--myrole` - Sends you a PM of your role info again
* `--day/info` - Show current day information
* `--votes/votals` - Show current list of votes for the game in channel
* `--votelog` - Show a detailed log of every vote made for the game in channel
* `--votehistory/votalhistory` - Show list of votals at the end of each previous day for the game in channel
* `--endgame` - Current host, admin, or majority of players can end the game in this channel
