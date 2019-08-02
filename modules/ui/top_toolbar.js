
import {
    select as d3_select
} from 'd3-selection';
import { t } from '../util/locale';
import { modeBrowse } from '../modes/browse';
import _debounce from 'lodash-es/debounce';
import { uiToolAddFavorite, uiToolAddRecent, uiToolNotes, uiToolOperation, uiToolSave, uiToolAddFeature, uiToolUndoRedo } from './tools';
import { uiToolSimpleButton } from './tools/simple_button';
import { uiToolWaySegments } from './tools/way_segments';
import { uiToolRepeatAdd } from './tools/repeat_add';
import { uiToolStructure } from './tools/structure';
import { uiToolCenterZoom } from './tools/center_zoom';

export function uiTopToolbar(context) {

    var addFeature = uiToolAddFeature(context),
        addFavorite = uiToolAddFavorite(context),
        addRecent = uiToolAddRecent(context),
        notes = uiToolNotes(context),
        undoRedo = uiToolUndoRedo(context),
        save = uiToolSave(context),
        waySegments = uiToolWaySegments(context),
        structure = uiToolStructure(context),
        repeatAdd = uiToolRepeatAdd(context),
        centerZoom = uiToolCenterZoom(context),
        deselect = uiToolSimpleButton({
            id: 'deselect',
            label: t('toolbar.deselect.title'),
            iconName: 'iD-icon-close',
            onClick: function() {
                context.enter(modeBrowse(context));
            },
            tooltipKey: 'Esc'
        }),
        cancelDrawing = uiToolSimpleButton({
            id: 'cancel',
            label: t('confirm.cancel'),
            iconName: 'iD-icon-close',
            onClick: function() {
                context.enter(modeBrowse(context));
            },
            tooltipKey: 'Esc',
            barButtonClass: 'wide'
        }),
        finishDrawing = uiToolSimpleButton({
            id: 'finish',
            label: t('toolbar.finish'),
            iconName: 'iD-icon-apply',
            onClick: function() {
                var mode = context.mode();
                if (mode.finish) {
                    mode.finish();
                } else {
                    context.enter(modeBrowse(context));
                }
            },
            tooltipKey:  'Esc',
            barButtonClass: 'wide'
        });

    var supportedOperationIDs = ['circularize', 'continue', 'delete', 'disconnect', 'downgrade', 'extract', 'merge', 'orthogonalize', 'reverse', 'split', 'straighten'];

    var operationToolsByID = {};

    function notesEnabled() {
        var noteLayer = context.layers().layer('notes');
        return noteLayer && noteLayer.enabled();
    }

    function operationTool(operation) {
        if (!operationToolsByID[operation.id]) {
            // cache the tools
            operationToolsByID[operation.id] = uiToolOperation(context);
        }
        var tool = operationToolsByID[operation.id];
        tool.setOperation(operation);
        return tool;
    }

    function toolsToShow() {

        var tools = [];

        var mode = context.mode();
        if (!mode) return tools;

        if (mode.id === 'save') {
            tools.push(cancelDrawing);
            tools.push('spacer');
        } else if (mode.id === 'select' &&
            !mode.newFeature() &&
            mode.selectedIDs().every(function(id) { return context.graph().hasEntity(id); })) {

            tools.push(deselect);
            tools.push('spacer');
            tools.push(centerZoom);
            tools.push('spacer');

            var operationTools = [];
            var operations = mode.operations().filter(function(operation) {
                return supportedOperationIDs.indexOf(operation.id) !== -1;
            });
            var deleteTool;
            for (var i in operations) {
                var operation = operations[i];
                var tool = operationTool(operation);
                if (operation.id !== 'delete' && operation.id !== 'downgrade') {
                    operationTools.push(tool);
                } else {
                    deleteTool = tool;
                }
            }
            tools = tools.concat(operationTools);
            if (deleteTool) {
                // keep the delete button apart from the others
                if (operationTools.length > 0) {
                    tools.push('spacer');
                }
                tools.push(deleteTool);
            }
            tools.push('spacer');

            tools = tools.concat([undoRedo, save]);

        } else if (mode.id === 'add-point' || mode.id === 'add-line' || mode.id === 'add-area' ||
            mode.id === 'draw-line' || mode.id === 'draw-area') {

            tools.push('spacer');

            if (mode.id.indexOf('line') !== -1 && structure.shouldShow()) {
                tools.push(structure);
                tools.push('spacer');
            }

            if (mode.id.indexOf('line') !== -1 || mode.id.indexOf('area') !== -1) {
                tools.push(waySegments);
                tools.push('spacer');
            }

            if (mode.id.indexOf('draw') !== -1) {

                if (!mode.isContinuing) {
                    tools.push(repeatAdd);
                }
                tools.push(undoRedo);

                var way = context.hasEntity(mode.wayID);
                var wayIsDegenerate = way && new Set(way.nodes).size - 1 < (way.isArea() ? 3 : 2);
                if (!wayIsDegenerate) {
                    tools.push(finishDrawing);
                } else {
                    tools.push(cancelDrawing);
                }
            } else {

                tools.push(repeatAdd);

                tools.push(undoRedo);

                if (mode.addedEntityIDs().length > 0) {
                    tools.push(finishDrawing);
                } else {
                    tools.push(cancelDrawing);
                }
            }

        } else {

            tools.push('spacer');

            if (mode.id === 'select-note' || mode.id === 'select-data' || mode.id === 'select-error') {
                tools.push(centerZoom);
                tools.push('spacer');
            }

            tools.push(addFeature);

            if (context.presets().getFavorites().length > 0) {
                tools.push(addFavorite);
            }

            if (addRecent.shouldShow()) {
                tools.push(addRecent);
            }

            tools.push('spacer');

            if (notesEnabled()) {
                tools = tools.concat([notes, 'spacer']);
            }
            tools = tools.concat([undoRedo, save]);
        }

        return tools;
    }

    function topToolbar(bar) {

        var debouncedUpdate = _debounce(update, 250, { leading: true, trailing: true });
        context.history()
            .on('change.topToolbar', debouncedUpdate);
        context.layers()
            .on('change.topToolbar', debouncedUpdate);
        context.map()
            .on('move.topToolbar', debouncedUpdate)
            .on('drawn.topToolbar', debouncedUpdate);

        context.on('enter.topToolbar', update);

        context.presets()
            .on('favoritePreset.topToolbar', update)
            .on('recentsChange.topToolbar', update);


        update();

        function update() {

            var tools = toolsToShow();

            var toolbarItems = bar.selectAll('.toolbar-item')
                .data(tools, function(d) {
                    return d.id || d;
                });

            toolbarItems.exit()
                .each(function(d) {
                    if (d.uninstall) {
                        d.uninstall();
                    }
                })
                .remove();

            var itemsEnter = toolbarItems
                .enter()
                .each(function(d) {
                    if (d.install) {
                        d.install();
                    }
                })
                .append('div')
                .attr('class', function(d) {
                    var classes = 'toolbar-item ' + (d.id || d).replace('_', '-');
                    if (d.itemClass) classes += ' ' + d.itemClass;
                    return classes;
                });

            var actionableItems = itemsEnter.filter(function(d) { return typeof d !== 'string'; });

            actionableItems
                .append('div')
                .attr('class', function(d) {
                    var classes = 'item-content';
                    if (d.contentClass) classes += ' ' + d.contentClass;
                    return classes;
                });

            actionableItems
                .append('div')
                .attr('class', 'item-label')
                .text(function(d) {
                    return d.label;
                });

            toolbarItems.merge(itemsEnter)
                .each(function(d){
                    if (d.render) d3_select(this).select('.item-content').call(d.render, bar);
                });
        }

    }

    return topToolbar;
}
