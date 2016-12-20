import _ from 'lodash';
import { t } from '../util/locale';
import { actionDeleteMultiple } from '../actions/index';
import { behaviorOperation } from '../behavior/index';
import { geoSphericalDistance } from '../geo/index';
import { modeBrowse, modeSelect } from '../modes/index';
import { uiCmd } from '../ui/index';


export function operationDelete(selectedIDs, context) {
    var action = actionDeleteMultiple(selectedIDs);

    var operation = function() {
        var annotation,
            nextSelectedID;

        if (selectedIDs.length > 1) {
            annotation = t('operations.delete.annotation.multiple', { n: selectedIDs.length });

        } else {
            var id = selectedIDs[0],
                entity = context.entity(id),
                geometry = context.geometry(id),
                parents = context.graph().parentWays(entity),
                parent = parents[0];

            annotation = t('operations.delete.annotation.' + geometry);

            // Select the next closest node in the way.
            if (geometry === 'vertex' && parent.nodes.length > 2) {
                var nodes = parent.nodes,
                    i = nodes.indexOf(id);

                if (i === 0) {
                    i++;
                } else if (i === nodes.length - 1) {
                    i--;
                } else {
                    var a = geoSphericalDistance(entity.loc, context.entity(nodes[i - 1]).loc),
                        b = geoSphericalDistance(entity.loc, context.entity(nodes[i + 1]).loc);
                    i = a < b ? i - 1 : i + 1;
                }

                nextSelectedID = nodes[i];
            }
        }

        context.perform(action, annotation);

        if (nextSelectedID && context.hasEntity(nextSelectedID)) {
            context.enter(
                modeSelect(context, [nextSelectedID]).follow(true).suppressMenu(true)
            );
        } else {
            context.enter(modeBrowse(context));
        }

    };


    operation.available = function() {
        return true;
    };


    operation.disabled = function() {
        var reason;
        if (_.some(selectedIDs, context.hasHiddenConnections)) {
            reason = 'connected_to_hidden';
        }
        return action.disabled(context.graph()) || reason;
    };


    operation.tooltip = function() {
        var disable = operation.disabled();
        return disable ?
            t('operations.delete.' + disable) :
            t('operations.delete.description');
    };


    operation.id = 'delete';
    operation.keys = [uiCmd('⌘⌫'), uiCmd('⌘⌦'), uiCmd('⌦')];
    operation.title = t('operations.delete.title');
    operation.behavior = behaviorOperation(context).which(operation);

    return operation;
}
