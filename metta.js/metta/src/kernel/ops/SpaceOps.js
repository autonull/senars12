import {OperationHelpers} from './OperationHelpers.js';
import {Space} from '../Space.js';
import {match} from '../Reduce.js';
import {exp, sym} from '../Term.js';
import {AlgebraicOps} from './AlgebraicOps.js';
import {generateId} from '@senars/core';

const error = (...args) => exp(sym('Error'), args);
const getSpace = (ctx, spaceId) => ctx?.spaces?.get(spaceId?.name);
const validateContext = ctx => ctx?.spaces ? null : error(sym('NoContext'));
const validateSpace = (ctx, spaceId) => {
    const err = validateContext(ctx);
    if (err) {
        return err;
    }
    const space = getSpace(ctx, spaceId);
    return space ? null : error(spaceId, sym('SpaceNotFound'));
};

export function registerSpaceOps(registry, interpreterContext) {
    registry.register('&add-atom', (s, a) => {
        const selfSpace = interpreterContext?.space;
        if (s?.name === '&self' && selfSpace && typeof selfSpace.add === 'function') {
            selfSpace.add(a);
            return a;
        }
        if (s && typeof s.add === 'function') {
            s.add(a);
            return a;
        }
        return s;
    });
    registry.register('&rm-atom', (s, a) => {
        const space = a.name === '&self' ? interpreterContext?.space : s;
        if (space?.remove) space.remove(a);
        return sym('()');
    });
    registry.register('&get-atoms', s => {
        const space = s.name === '&self' ? interpreterContext?.space : s;
        return OperationHelpers.listify(space?.all?.() ?? []);
    });

    registry.register('new-space', () => {
        const newSpace = new Space();
        const id = generateId('space');
        interpreterContext?.spaces?.set(id, newSpace);
        return sym(id);
    });

    registry.register('add-atom-to', (spaceId, atom) => {
        const err = validateSpace(interpreterContext, spaceId);
        if (err) {
            return err;
        }
        getSpace(interpreterContext, spaceId).add(atom);
        return sym('ok');
    });

    registry.register('match-in', (spaceId, pattern, template) => {
        const err = validateSpace(interpreterContext, spaceId);
        if (err) {
            return err;
        }
        return OperationHelpers.listify(match(getSpace(interpreterContext, spaceId), pattern, template));
    }, {lazy: true});

    registry.register('merge-spaces', (sourceId, targetId) => {
        const err = validateContext(interpreterContext);
        if (err) {
            return err;
        }
        const source = getSpace(interpreterContext, sourceId);
        const target = getSpace(interpreterContext, targetId);
        if (!source || !target) {
            return error(sym('SpaceNotFound'));
        }
        source.all().forEach(atom => target.add(atom));
        return sym('ok');
    });

    registry.register('compose', (s1Id, s2Id) => {
        const s1 = getSpace(interpreterContext, s1Id);
        const s2 = getSpace(interpreterContext, s2Id);
        if (!s1 || !s2) {
            return error(sym('SpaceNotFound'));
        }
        return AlgebraicOps.compose(s1, s2);
    });

    registry.register('project', (sId, pred) => {
        const s = getSpace(interpreterContext, sId);
        if (!s) {
            return error(sym('SpaceNotFound'));
        }
        return AlgebraicOps.project(s, pred);
    });

    registry.register('join', (s1Id, s2Id, key) => {
        const s1 = getSpace(interpreterContext, s1Id);
        const s2 = getSpace(interpreterContext, s2Id);
        if (!s1 || !s2) {
            return error(sym('SpaceNotFound'));
        }
        return AlgebraicOps.join(s1, s2, key);
    });
}
