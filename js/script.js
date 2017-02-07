var areaType = 'polygon';
var drawnLayer;
var backdrop, muniLayer;
var nPolygon;
var mPolygon;

var api_url = "https://tools.wprdc.org/property-api/data_within/";

/**************************************
 * MAP STUFF
 *
 **************************************/
var map = new L.Map('map', {
    center: [40.45, -79.9959],
    zoom: 11
});

L.tileLayer('http://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy; <a href="https://carto.com/attributions">CartoDB</a>'
}).addTo(map);

var selectLayer = L.geoJson().addTo(map); //add empty geojson layer for selections

//leaflet draw stuff

var options = {
    position: 'topright',
    draw: {
        polyline: false,
        polygon: {
            allowIntersection: false, // Restricts shapes to simple polygons
            drawError: {
                color: '#e1e100', // Color the shape will turn when intersects
                message: '<strong>Oh snap!<strong> you can\'t draw that!' // Message that will show when intersect
            },
            shapeOptions: {
                color: '#bada55'
            }
        },
        circle: false, // Turns off this drawing tool
        rectangle: {
            shapeOptions: {
                clickable: false
            }
        },
        marker: false
    }
};

var drawControl = new L.Control.Draw(options);
map.addControl(drawControl);
// $('.leaflet-draw-toolbar').hide();

var customPolygon;
map.on('draw:created', function (e) {
    console.log('draw:created');
    //hide the arrow
    $('.infoArrow').hide();

    var type = e.layerType,
        layer = e.layer;

    console.log(e.layer);
    drawnLayer = e.layer;

    var coords = e.layer._latlngs;
    console.log(coords);
    customPolygon = makeSqlPolygon(coords);
    // Do whatever else you need to. (save to db, add to map etc)
    map.addLayer(layer);
    $('.download').removeAttr('disabled');
});

map.on('draw:drawstart', function (e) {
    console.log('draw:start');
    if (drawnLayer) {
        map.removeLayer(drawnLayer);
    }
});

//add cartodb named map
var layerUrl = 'https://wprdc.carto.com/api/v2/viz/24843ea8-f778-11e5-a7c9-0e674067d321/viz.json';

cartodb.createLayer(map, layerUrl)
    .addTo(map)
    .on('done', function (layer) {
        backdrop = layer.getSubLayer(0);
        backdrop.setInteraction(false);
        //TODO: build array of selction layers based off JSON file
        muniLayer = layer.getSubLayer(1);
        hoodLayer = layer.getSubLayer(2);
        //hoodLayer.setInteractivity("cartodb_id, hood");
        muniLayer.hide();  //hide municipality polygons
        hoodLayer.hide();
        muniLayer.on('featureClick', processMuni);
        hoodLayer.on('featureClick', processNeighborhood);
    });

//populate fields list
$.getJSON('data/resources.json', function (resources) {

    $.getJSON('data/fields2.json', function (data) {

        for (var resourceId in data) {
            if (data.hasOwnProperty(resourceId)) {
                var $resourceList = $('<ul>', {id: "r" + resourceId, class: "fieldList"});
                data[resourceId].forEach(function (field) {
                    // Make list item for field
                    var fieldId = field.name + '__' + resources[resourceId].name;

                    var listItem = '<li id="' + fieldId + '" class="list-group-item field-selection-item">'
                        + field.title
                        + '<span class="glyphicon glyphicon-info-sign icon-right" aria-hidden="true"></span></li>';

                    // Add to it's resources list
                    $resourceList.append(listItem);

                    $('#' + fieldId).data("field", field.name)
                        .data("description", field.description)
                        .data("resource", resourceId);
                });
            }

            var $container = $('<div>', {class: "column column-block"});
            var $listContainer = $('<div>', {class: "resource-list-container"});


            if (resources.hasOwnProperty(resourceId)) {
                $container.append('<h4 class="text-center">' + resources[resourceId].title + '</h4>')
            }
            $listContainer.append($resourceList);
            $container.append($listContainer);
            $('#fields-area').append($container);


        }

        // Add data to all to the available fields
        for (var rID in data) {
            if (data.hasOwnProperty(rID)) {
                data[rID].forEach(function (field) {
                    // Make list item for field
                    var fieldId = field.name + '__' + resources[rID].name;

                    $('#' + fieldId).data("field", field.name)
                        .data("field", field.name)
                        .data("description", field.description)
                        .data("resource", rID);
                });
            }
        }

        //listener for hovers
        $('.icon-right').hover(showDescription, hideDescription);

        function showDescription() {
            var $rev = $('#fields-reveal')
            var reveal_y = parseInt($rev.css('top'), 10),
                reveal_x = parseInt($rev.css('margin-left'), 10);

            var o = $(this).offset();

            var data = $(this).parent().data('description');
            $('#infoWindow')
                .html(data)
                .css('top', o.top - reveal_y - 10)
                .css('left', o.left - reveal_x + 30)
                .fadeIn(150);
        }

        function hideDescription() {
            $('#infoWindow')
                .fadeOut(150);
        }


        //custom functionality for checkboxes
        initCheckboxes();
    });
});

//$('#splashModal').modal('show');

//listeners
$('#selectAll').click(function () {
    $(".fieldList li").click();
    listChecked();
});

//radio buttons
$('input[type=radio][name=area]').change(function () {
    //reset all the things
    muniLayer.hide();
    hoodLayer.hide();
    selectLayer.clearLayers();
    $('.leaflet-draw-toolbar').hide();
    if (drawnLayer) {
        map.removeLayer(drawnLayer);
    }

    //turn on certain things
    if (this.value == 'polygon') {
        areaType = 'polygon';
        flush_selections();
        $('.leaflet-draw-toolbar').show();
        $('.download').attr('disabled', 'disabled');

    }
    if (this.value == 'currentView') {
        areaType = 'currentView';
        flush_selections();
    }
    if (this.value == 'municipality') {
        areaType = 'municipality';
        muniLayer.show();
        flush_selections();
        $('.download').attr('disabled', 'disabled');
    }
    if (this.value == 'neighborhood') {
        areaType = 'neighborhood';
        hoodLayer.show();
        flush_selections();
        $('.download').attr('disabled', 'disabled');
    }
});

var flush_selections = function () {
    customPolygon = undefined;
    nPolygon = undefined;
    mPolygon = undefined;
};

//runs when any of the download buttons is clicked
$('.download').click(function () {

    var data = {};

    //get current view, download type, and checked fields
    var bbox = map.getBounds();
    data.intersects = customPolygon;
    data.type = $(this).attr('id');
    var checked = listChecked();
    console.log(areaType);
    //generate comma-separated list of fields
    data.fields = JSON.stringify(checked);

    if (areaType == 'polygon') {
        if (customPolygon == undefined) {
            alert("Don't forget to draw your area on the map!");
            return;
        }
        data.intersects = customPolygon;
    }


    if (areaType == 'municipality') {
        if (mPolygon == undefined) {
            alert("Don't forget to select your municipality from the map!");
            return;
        }

        data.intersects = mPolygon;
    }

    if (areaType == 'neighborhood') {
        if (nPolygon == undefined) {
            alert("Don't forget to select your neighborhood from the map!");
            return;
        }
        data.intersects = nPolygon;
    }

    if (data.type == 'cartodb') {
        data.type = 'geojson';
        data.cartodb = true;
    }

    /********************************************************
     * GET PINS WITHIN SELECTION
     ********************************************************/
        // Generate query for property-api
    var queryTemplate = api_url + "?shape={{{intersects}}}&fields={{{fields}}}&type={{{type}}}";
    var buildquery = Handlebars.compile(queryTemplate);
    var url = buildquery(data);

    //http://oneclick.carto.com/?file={{YOUR FILE URL}}&provider={{PROVIDER NAME}}&logo={{YOUR LOGO URL}}
    if (data.cartodb) {
        url = encodeURIComponent(url);
        url = 'https://oneclick.carto.com/?file=' + url;
        console.log(url);
        window.open(url);
    }
    else {
        console.log(url);
        window.open(url);
    }
});

//functions

//when a polygon is clicked in Neighborhood View, download its geojson, etc
function processMuni(e, latlng, pos, data, layer) {
    console.log('Muni data', data);
    var nid = data.f0_label;
    selectLayer.clearLayers();
    console.log(nid);
    var sql = new cartodb.SQL({user: 'wprdc'});
    sql.execute("SELECT the_geom FROM allegheny_county_municipal_boundaries WHERE f0_label = '{{id}}'",
        {
            id: data.f0_label
        },
        {
            format: 'geoJSON'
        }
    )
        .done(function (data) {
            console.log(data);
            selectLayer.addData(data);
            //setup SQL statement for intersection
            mPolygon = "(SELECT the_geom FROM allegheny_county_municipal_boundaries WHERE f0_label = '" + nid + "')";
        });
    $('.download').removeAttr('disabled');
}


function processNeighborhood(e, latlng, pos, data, layer) {
    console.log('Hood data', data);
    var nid = data.hood;
    selectLayer.clearLayers();
    console.log(nid);
    var sql = new cartodb.SQL({user: 'wprdc'});
    sql.execute("SELECT the_geom FROM pittsburgh_neighborhoods WHERE hood = '{{id}}'",
        {
            id: data.hood
        },
        {
            format: 'geoJSON'
        }
    )
        .done(function (data) {
            console.log(data);
            selectLayer.addData(data);
            //setup SQL statement for intersection
            nPolygon = "(SELECT the_geom FROM pittsburgh_neighborhoods WHERE hood = '" + nid + "')";
        })
    $('.download').removeAttr('disabled');
}

//turns an array of latLngs into an ST_POLYGONFROMTEXT
function makeSqlPolygon(coords) {
    var s = "ST_SETSRID(ST_PolygonFromText(\'POLYGON((";
    var firstCoord;
    coords.forEach(function (coord, i) {
        console.log(coord);
        s += coord.lng + " " + coord.lat + ",";

        //remember the first coord
        if (i == 0) {
            firstCoord = coord;
        }

        if (i == coords.length - 1) {
            s += firstCoord.lng + " " + firstCoord.lat;
        }
    });
    s += "))\'),4326)";
    console.log(s);
    return s;
}

function initCheckboxes() {
    //sweet checkbox list from http://bootsnipp.com/snippets/featured/checked-list-group
    $('.field-selection-item').each(function () {

        // Settings
        var $widget = $(this),
            $checkbox = $('<input type="checkbox" class="hidden" />'),
            color = ($widget.data('color') ? $widget.data('color') : "primary"),
            style = ($widget.data('style') == "button" ? "btn-" : "list-group-item-"),
            settings = {
                on: {
                    icon: 'glyphicon glyphicon-check'
                },
                off: {
                    icon: 'glyphicon glyphicon-unchecked'
                }
            };

        $widget.css('cursor', 'pointer')
        $widget.append($checkbox);

        // Event Handlers
        $widget.on('click', function () {
            $checkbox.prop('checked', !$checkbox.is(':checked'));
            $checkbox.triggerHandler('change');
            updateDisplay();
        });
        $checkbox.on('change', function () {
            updateDisplay();
        });


        // Actions
        function updateDisplay() {
            var isChecked = $checkbox.is(':checked');


            // Set the button's state
            $widget.data('state', (isChecked) ? "on" : "off");

            // Set the button's icon
            $widget.find('.state-icon')
                .removeClass()
                .addClass('state-icon ' + settings[$widget.data('state')].icon);

            // Update the button's color
            if (isChecked) {
                $widget.addClass(style + color + ' active');
            } else {
                $widget.removeClass(style + color + ' active');
            }
        }

        // Initialization
        function init() {

            if ($widget.data('checked') == true) {
                $checkbox.prop('checked', !$checkbox.is(':checked'));
            }

            updateDisplay();

            // Inject the icon if applicable
            if ($widget.find('.state-icon').length == 0) {
                $widget.prepend('<span class="state-icon ' + settings[$widget.data('state')].icon + '"></span>');
            }
        }

        init();
    });
}

function listChecked() {
    var checkedItems = [];
    $(".fieldList li.active").each(function (idx, li) {
        checkedItems.push({
            'f': $(li).data('field'),
            'r': $(li).data('resource')
        });
        console.log(checkedItems);
    });
    return checkedItems;
}


$(document).ready(function () {
    $('.js-about').click(function () {

        $('#modal').fadeIn();
    });

    $('#modal').click(function () {
        $(this).fadeOut();
    });

    $('.modal-inner').click(function (event) {
        event.stopPropagation();
    });

    $(document).on('keyup', function (evt) {
        if (evt.keyCode == 27) {
            if ($('#modal').css('display') == 'block') {
                $('#modal').fadeOut();
            }
        }
    });
});

function switchDownloadButtons(value) {
    if (value){

    }
}