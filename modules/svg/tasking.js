import _throttle from 'lodash-es/throttle';

import { t } from '../util/locale';
import { icon } from '../ui/intro/helper';
import { geoPath as d3_geoPath } from 'd3-geo';
import { select as d3_select } from 'd3-selection';

import { services } from '../services';
import { uiCurtain } from '../ui';
import { svgPath } from './helpers';


var _initialized = false;
var _enabled = false;
var _task;


export function svgTasking(projection, context, dispatch) {
    var throttledRedraw = _throttle(function () { dispatch.call('change'); }, 1000);
    var _showCurtain = false;
    var _curtain = uiCurtain();
    var layer = d3_select(null);
    var _taskingService;


    function init() {
        if (_initialized) return;  // run once

        _task = {};
        _enabled = false;
        _initialized = true;
    }


    function getService() {
        if (services.tasking && !_taskingService) {
            _taskingService = services.tasking;

            _taskingService.event.on('setTask', throttledRedraw);

        } else if (!services.tasking && _taskingService) {
            _taskingService = null;
        }

        return _taskingService;
    }


    function showLayer() {
        layerOn();

        layer
            .style('opacity', 0)
            .transition()
            .duration(250)
            .style('opacity', 1)
            .on('end', function () { dispatch.call('change'); });
    }


    function hideLayer() {
        throttledRedraw.cancel();

        layer
            .transition()
            .duration(250)
            .style('opacity', 0)
            .on('end', layerOff);
    }


    function layerOn() {
        layer.style('display', 'block');
    }


    function layerOff() {
        layer.selectAll('.viewfield-group').remove();
        layer.style('display', 'none');
    }


    function featureKey(d) {
        return d.__featurehash__;
    }


    function isPolygon(d) {
        return d.geometry.type === 'Polygon' || d.geometry.type === 'MultiPolygon';
    }


    function clipPathID(d) {
        return 'data-' + d.__featurehash__ + '-clippath';
    }


    function featureClasses(d) {
        return [
            'data' + d.__featurehash__,
            d.geometry.type,
            isPolygon(d) ? 'area' : '',
            d.__layerID__ || ''
        ].filter(Boolean).join(' ');
    }


    function editOn() {
        var getPath = svgPath(projection).geojson;
        var getAreaPath = svgPath(projection, null, true).geojson;

        var surface = context.surface();
        if (!surface || surface.empty()) return;  // not ready to draw yet, starting up

        if (!drawTasking.hasData()) return; // return if no data

        // Gather data
        var geoData = [];
        var polygonData = [];

        if (Object.keys(_task).length) {
            // geoData = getFeatures(_task);
            geoData = [_task];
            geoData = geoData.filter(getPath);
            polygonData = geoData.filter(isPolygon);
        }


        // Draw clip paths for polygons
        var clipPaths = surface.selectAll('defs').selectAll('.clipPath-data')
           .data(polygonData, featureKey);

        clipPaths.exit()
           .remove();

        var clipPathsEnter = clipPaths.enter()
           .append('clipPath')
           .attr('class', 'clipPath-data')
           .attr('id', clipPathID);

        clipPathsEnter
           .append('path');

        clipPaths.merge(clipPathsEnter)
           .selectAll('path')
           .attr('d', getAreaPath);


        // Draw fill, shadow, stroke layers
        var datagroups = layer
            .selectAll('g.datagroup')
            .data(['fill', 'shadow', 'stroke']);

        datagroups = datagroups.enter()
            .append('g')
            .attr('class', function(d) { return 'datagroup datagroup-' + d; })
            .merge(datagroups);


        // Draw paths
        var pathData = {
            fill: polygonData,
            shadow: geoData,
            stroke: geoData
        };

        var paths = datagroups
            .selectAll('path')
            .data(function(layer) { return pathData[layer]; }, featureKey);

        // exit
        paths.exit()
            .remove();

        // enter/update
        paths = paths.enter()
            .append('path')
            .attr('class', function(d) {
                var datagroup = this.parentNode.__data__;
                return 'pathdata ' + datagroup + ' ' + featureClasses(d);
            })
            .attr('clip-path', function(d) {
                var datagroup = this.parentNode.__data__;
                return datagroup === 'fill' ? ('url(#' + clipPathID(d) + ')') : null;
            })
            .merge(paths)
            .attr('d', function(d) {
                var datagroup = this.parentNode.__data__;
                return datagroup === 'fill' ? getAreaPath(d) : getPath(d);
            });


        // draw curtain around task
        if (geoData && !!geoData.length && drawTasking.enabled()) {
            drawTasking.showCurtain(true);
        } else {
            drawTasking.showCurtain(false);
            _curtain.remove();
        }

        if (drawTasking.showCurtain()) { drawCurtain(); }


        function revealTask(extent, text, options) {
            var left = context.projection(extent[0])[0];
            var top = context.projection(extent[0])[1];
            var right = context.projection(extent[1])[0];
            var bottom = context.projection(extent[1])[1];
            var box = {
                left: left,
                top: top,
                width: right - left,
                height: bottom - top
            };

            _curtain.reveal(box, text, options);
        }

        function drawCurtain() {
            _curtain.remove();
            context.container().select('.layer-data').call(_curtain);

            revealTask(
                _task.extentPanConstraint()
                // TODO: TAH - add tooltip back if needed
                // ,
                // t('tasking.started_task.task_help',
                //     {
                //         taskId: '1',
                //         taskingButton: icon('#iD-icon-tasking', 'pre-text'),
                //         taskingKey: t('tasking.key'),
                //         helpButton: icon('#iD-icon-help', 'pre-text'),
                //         helpKey: t('help.key')
                //     }
                // ),{
                //     tooltipClass: 'intro-points-describe',
                //     duration: 500,
                //     buttonText: t('tasking.started_task.stop_task'),
                //     buttonCallback: function() { finishTasking('value'); }
                // }
                );

            function finishTasking(value) {
                console.log('clicked finish tasking');
            }
        }
    }


    function editOff() {
        _curtain.remove();
    }


    function drawTasking(selection) {
        var hasData = drawTasking.hasData();

        layer = selection.selectAll('.layer-map-tasking')
            .data(_enabled && hasData ? [0] : []);

        layer.exit()
            .remove();

        layer = layer.enter()
            .append('g')
            .attr('class', 'layer-map-tasking')
            .merge(layer);

        if (_enabled) {
            editOn();
        } else {
            editOff();
        }
    }


    drawTasking.enabled = function(val) {
        if (!arguments.length) return _enabled;

        _enabled = val;
        if (_enabled) {
            showLayer();
        } else {
            hideLayer();
        }

        dispatch.call('change');
        return this;
    };


    drawTasking.supported = function() {
        return !!getService();
    };


    drawTasking.hasData = function() {
        _task = getService().currentTask() || {};

        return !!(Object.keys(_task).length);
    };


    drawTasking.fitZoom = function() {
        drawTasking.hasData();

        // set task min zoom
        var map = context.map();
        _task.minZoom(map.trimmedExtentZoom(_task.extent()));
        getService().replaceTask(_task); // update task in cache

        map.centerZoom(_task.center(), _task.minZoom()); // TODO: TAH - better way to zoom out a bit

        // if (!geoPolygonIntersectsPolygon(viewport, coords, true)) {
        //     map.centerZoom(_taskCentroid, map.trimmedExtentZoom(_taskExtent));
        // }

        return this;
    };


    drawTasking.showCurtain = function(val) {
        if (!arguments.length) return _showCurtain;

        _showCurtain = val;
        return this;
    };


    init();
    return drawTasking;
}