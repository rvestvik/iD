import { t } from '../util/locale';
import { actionReflect } from '../actions/index';
import { behaviorOperation } from '../behavior/index';


export function operationReflectShort(selectedIDs, context) {
    return operationReflect(selectedIDs, context, 'short');
}


export function operationReflectLong(selectedIDs, context) {
    return operationReflect(selectedIDs, context, 'long');
}


export function operationReflect(selectedIDs, context, axis) {
    axis = axis || 'long';
    var entityId = selectedIDs[0];
    var entity = context.entity(entityId);
    var extent = entity.extent(context.graph());
    var action = actionReflect(entityId, context.projection)
        .useLongAxis(Boolean(axis === 'long'));


    var operation = function() {
        context.perform(action, t('operations.reflect.annotation.' + axis));
    };


    operation.available = function() {
        return selectedIDs.length === 1 && context.geometry(entityId) === 'area';
    };


    operation.disabled = function() {
        if (extent.percentContainedIn(context.extent()) < 0.8) {
            return 'too_large';
        } else if (context.hasHiddenConnections(entityId)) {
            return 'connected_to_hidden';
        } else {
            return false;
        }
    };


    operation.tooltip = function() {
        var disable = operation.disabled();
        return disable ?
            t('operations.reflect.' + disable) :
            t('operations.reflect.description.' + axis);
    };


    operation.id = 'reflect-' + axis;
    operation.keys = [t('operations.reflect.key.' + axis)];
    operation.title = t('operations.reflect.title');
    operation.behavior = behaviorOperation(context).which(operation);

    return operation;
}
