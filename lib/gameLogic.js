"use strict";
const fs = require('fs');
const _ = require('lodash');
const config = require('../config.js');
const ext = require('./ext.js');
const roles = require('../roles');
const mods = require('../roles/mods');
const factions = require('../factions');

var game = this;
// Caches
game.roleCache = {};
game.factionCache = {};

//utilities
game.getRole = roleId => {
    if (!game.roleCache[roleId]) {
        // combine role and mods
        var splitRoles = roleId.split('+').reverse(); // mod1+mod2+baserole => [baserole, mod1, mod2] ex: bp+miller+cop
        var rolesAndMods = splitRoles.map((roleOrMod, i) => i == 0 ? _.find(roles, {id: roleOrMod}) : _.find(mods, {id: roleOrMod}).mod);
        var role = ext(...rolesAndMods);
		
        // modify role name
        var splitRolesInOrder = roleId.split('+');
        role.name = splitRolesInOrder.map((roleOrMod, i) => _.find((i == splitRolesInOrder.length - 1 ? roles : mods), {id: roleOrMod}).name).join(' ');
		
        // bind all functions to this specific role combination
        for (var prop in role) {
            if (typeof(role[prop]) === 'function') {
                role[prop] = role[prop].bind(role);
            }
        }
        // cache role
        game.roleCache[roleId] = role;
    }
    return game.roleCache[roleId];
}

game.getFaction = (factionId) => {
    if (!game.factionCache[factionId]) {
        // clone object first so we don't pollute the require cache
        var faction = ext({}, _.find(factions, {id: factionId}));
        // bind all functions to this specific faction combination
        for (var prop in faction) {
            if (typeof(faction[prop]) === 'function') {
                faction[prop] = faction[prop].bind(faction);
            }
        }
        // cache faction
        game.factionCache[factionId] = faction;
    }
    return game.factionCache[factionId];
}

game.getRolesets = () => {
    try { return JSON.parse(fs.readFileSync(config.rolesetJSONPath).toString()); } catch (e) { return []; };
}

game.saveRoleSets = (rolesets) => {
    fs.writeFileSync(config.rolesetJSONPath, JSON.stringify(rolesets, null, '\t'));
}

// printing
game.listFactions = factions => {
    var output = '',
		sortedFactions = _.sortBy(factions, 'id');
		
    for (var i = 0; i < sortedFactions.length; i++) {
        var faction = sortedFactions[i];
        output += `\n***${faction.id}*** | **${faction.name}** | ${faction.description}`;
    }
    return output;
}

game.listRoles = roles => {
    var output = '',
		sortedRoles = _.sortBy(roles, 'id');
    for (var i = 0; i < sortedRoles.length; i++) {
        var role = sortedRoles[i];
        output += `\n***${role.id}*** | **${role.trueName || role.name}** | ${role.description}`;
        if (role.secretDetails) {
            output += ` | *${role.secretDetails}*`;
        }
    }
    return output;
}

game.listMods = mods => {
    var output = '',
		sortedMods = _.sortBy(mods, 'id');
    for (var i = 0; i < sortedMods.length; i++) {
        var mod = sortedMods[i];
        output += `\n***${mod.id}*** | **${mod.name}** | ${mod.description}`;
    }
    return output;
}

game.listRolesets = rolesets => {
    var output = '',
		sortedRolesets = _.sortBy(rolesets, set => set.roles.length);
		
    for (var i = 0; i < sortedRolesets.length; i++) {
        var roleset = sortedRolesets[i],
			formattedRoles = _.map(roleset.roles, role => 
			`\`${game.getFaction(role.faction).name} ${game.getRole(role.role).trueName || game.getRole(role.role).name}\``)
			.join(', ');
        output += `\n***${roleset.name}* (${roleset.roles.length})** | ${formattedRoles}`;
    }
    return output;
}

game.listRolesetNames = rolesets => {
    var output = '',
		rolesetGroups = _.sortBy(_.toArray(_.groupBy(rolesets, set => set.roles.length)), group => group[0].roles.length);
    for (var i = 0; i < rolesetGroups.length; i++) {
        var rolesetGroup = rolesetGroups[i];
        output += `\n**${s(rolesetGroup[0].roles.length, 'player')}:** \`${_.map(rolesetGroup, set => set.name).join(', ')}\``;
    }
    return output;
}

game.majorityOf = listOfPlayers => {
    return Math.ceil(listOfPlayers.length / 2 + 0.1);
}

module.exports = game