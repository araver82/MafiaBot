const _ = require('lodash');
const templates = require('./templates');
const s = require('../pluralize.js');

var shotCount = 1;
var self = templates.extend(templates.singleTarget, {
    id: 'vigilante',
    name: 'Vigilante',
    description: `You can choose to shoot someone during night, *${s(shotCount, 'time')}* in the whole game, with the ***${pre}kill*** command.`,
    command: 'kill',
    commandGerund: 'killing',
    commandText: 'kill a target',
    actionText: 'vig kill',
    onGameStart: (p) => {
        p.player.roleData.shotCount = shotCount;
    },
    canDoAction: (p) => {
        return p.player.roleData.shotCount > 0 ? true : 'You are out of bullets for the rest of the game.';
    },
    onActionPhase: (p) => {
        var action = _.find(p.game.nightActions, {action: self.actionText, playerId: p.player.id});
        if (action) {
            p.player.roleData.shotCount--;
            p.game.nightKills[action.targetId] = (p.game.nightKills[action.targetId] || 0) + 1;
        }
    },
});
module.exports = self;