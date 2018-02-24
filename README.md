# MafiaBot

A Discord bot for hosting a game of Den Mafia(*)!

**still under developement**  

*Den Mafia's home: https://mafiamaniac.net

## Features
* Fully scriptable linear-flow [role system](mafia.js#L1401-L1429) with [mixins](roles/mods) for super flexible yet simple role definitions.
* Add your own role setups using any combination of roles and mixins for any number of players.
* Configurable role setup [variations](roles/variations/index.js) which randomly change setups to get more fun and surprise out of your setups.
* Custom data store system that is IMPERVIOUS to corruption and crashes. Silently [recovers from any error](mafiabot_autorun_and_update.bat) and continues running seamlessly.
* Total control of user speech and group chat permissions to fully enforce no-talking-at-night and secret mafia chat rules.
* Keeps track of many in-game statistics such as a history of all votes made by every player.

## Install

* Node.js 8.0.0 or newer is required (because of current discord.js requirements)

```sh
$ npm install
```
* Add the bot to the Discord server (https://discordapp.com/oauth2/authorize?client_id=CLIENT_ID_HERE&scope=bot)

## Config
* Setup all the admin user ID values in `config.js`  
* Setup the bot's user token in `creds.js` (follow the [Discord developer guide](https://discordapp.com/developers/docs/intro) to get the token)

## Run

```sh
$ npm start
```

## Debug

Install [Node Inspector](https://github.com/node-inspector/node-inspector), then

```sh
$ node-debug --nodejs mafia-debug.js
```

## Credits
Tombolo: *Role setup contributions*  
foolmoron: *First version*  
araver82: *porting to discord 11+, adding Den Mafia style*
