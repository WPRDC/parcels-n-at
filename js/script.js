var areaType = 'polygon';
var drawnLayer;
var backdrop, muniLayer;
var nPolygon;
var mPolygon;
var selectedFields = [];
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

var customPolygon;
map.on('draw:created', function (e) {
    //console.log('draw:created');
    //hide the arrow
    $('.infoArrow').hide();

    var type = e.layerType,
        layer = e.layer;

    //console.log(e.layer);
    drawnLayer = e.layer;

    var coords = e.layer._latlngs;
    //console.log(coords);
    customPolygon = makeSqlPolygon(coords);
    // Do whatever else you need to. (save to db, add to map etc)
    map.addLayer(layer);
    $('.download').removeAttr('disabled');
});

map.on('draw:drawstart', function (e) {
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
        muniLayer = layer.getSubLayer(1);
        hoodLayer = layer.getSubLayer(2);
        muniLayer.hide();  //hide municipality polygons
        hoodLayer.hide();
        muniLayer.on('featureClick', processMuni);
        hoodLayer.on('featureClick', processNeighborhood);
    });

//populate fields list
$.getJSON('data/resources.json', function (resources) {

    $.getJSON('data/fields2.json', function (fieldsData) {

        for (var resourceId in fieldsData) {
            if (fieldsData.hasOwnProperty(resourceId)) {
                var $resourceList = $('<ul>', {id: "r" + resourceId, class: "fieldList"});
                fieldsData[resourceId].forEach(function (field) {
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
                if (resources[resourceId].notes) {
                    var $title = $('<h4 class="text-center"><span>' + resources[resourceId].title + '</span>' +
                        '<span class="glyphicon glyphicon-info-sign icon-right resource-help" aria-hidden="true"></span></h4>');
                    $title.data('description', resources[resourceId].notes);
                    $container.append($title)
                }
                else {
                    $container.append('<h4 class="text-center">' + resources[resourceId].title + '</h4>');
                }
            }
            $listContainer.append($resourceList);
            $container.append($listContainer);
            $container.append('<p class="select-all text-center"><a class="button tiny secondary">Toggle All</a></p>')
            $('#fields-area').append($container);
        }

        // Add data to all to the available fields
        for (var rID in fieldsData) {
            if (fieldsData.hasOwnProperty(rID)) {
                fieldsData[rID].forEach(function (field) {
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
            var o = $(this).offset();

            var data = $(this).parent().data('description');
            $('#infoWindow')
                .html(data)
                .css('top', o.top - 10)
                .css('left', o.left + 35)
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


//listeners
$('#fields-reveal').on('click', '.select-all', function () {
    $(this).parent().find('li').click();
    listChecked();
});

$('#fields-reveal').on('click', '#select-done', function () {
    $(this).parent().find('li').click();
    var items = listChecked();
    $('#selection-msg').text(items.length + " fields selected.")
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

    var qry_data = {};

    //get current view, download type, and checked fields
    var bbox = map.getBounds();
    qry_data.intersects = customPolygon;
    qry_data.type = $(this).attr('id');
    var checked = listChecked();

    //generate comma-separated list of fields
    qry_data.fields = JSON.stringify(checked);

    if (areaType == 'polygon') {
        if (customPolygon == undefined) {
            alert("Don't forget to draw your area on the map!");
            return;
        }
        qry_data.intersects = customPolygon;
    }


    if (areaType == 'municipality') {
        if (mPolygon == undefined) {
            alert("Don't forget to select your municipality from the map!");
            return;
        }

        qry_data.intersects = mPolygon;
    }

    if (areaType == 'neighborhood') {
        if (nPolygon == undefined) {
            alert("Don't forget to select your neighborhood from the map!");
            return;
        }
        qry_data.intersects = nPolygon;
    }

    if (qry_data.type == 'cartodb') {
        qry_data.type = 'geojson';
        qry_data.cartodb = true;
    }

    /********************************************************
     * GET PINS WITHIN SELECTION
     ********************************************************/
        // Generate query for property-api
    var queryTemplate = api_url + "?shape={{{intersects}}}&fields={{{fields}}}&type={{{type}}}";
    var buildquery = Handlebars.compile(queryTemplate);
    var url = buildquery(qry_data);

    // Start collection job
    $.get(url)
        .done(function (data) {
            // poll for progress
            var job_id = data.job_id;
            var task = 'Starting';
            var prog = 0;

            // Pop up progress modal
            $progModal = $("#prog-modal");
            setStatusDisplay('reset');
            $progModal.foundation('open');

            var progress_poll = setInterval(function () {
                $.ajax({
                    url: "http://tools.wprdc.org/property-api/progress/",
                    data: {job: job_id},
                }).done(function (data) {
                    prog = data.percent;
                    task = data.task;

                    // Update progress Modal
                    if (prog < 100) {
                        $('#prog-text').html(task);
                    }
                    else {
                        clearInterval(progress_poll);
                        dl_url = "http://tools.wprdc.org/property-api/get_collected_data/?job=" + job_id + "&type=" + qry_data.type;
                        console.log("DATA:", data);
                        if (qry_data.cartodb) {
                            url = encodeURIComponent(dl_url);
                            url = 'https://oneclick.carto.com/?file=' + url;
                            window.open(url);
                            setStatusDisplay('reset');
                        } else {
                            url = dl_url
                        }

                        $('#dl-text').html("<a href='" + url + "'>Click Here to Download</a>");
                        setStatusDisplay('downloaded');
                    }

                }).fail(function () {
                    clearInterval(progress_poll);
                });
            }, 500)
        })
        .fail(function (data) {
            console.log('failure')
        })
        .always(function (data) {
            //console.log(data)
        });
});

//functions

//when a polygon is clicked in Neighborhood View, download its geojson, etc
function processMuni(e, latlng, pos, data, layer) {
    var nid = data.f0_label;
    selectLayer.clearLayers();
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
            selectLayer.addData(data);
            //setup SQL statement for intersection
            mPolygon = "(SELECT geom FROM allegheny_county_municipal_boundaries WHERE label = '" + nid + "')";
        });
    $('.download').removeAttr('disabled');
}


function processNeighborhood(e, latlng, pos, data, layer) {
    var nid = data.hood;
    selectLayer.clearLayers();
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
            selectLayer.addData(data);
            //setup SQL statement for intersection
            nPolygon = "(SELECT geom FROM pittsburgh_neighborhoods WHERE hood = '" + nid + "')";
        })
    $('.download').removeAttr('disabled');
}

//turns an array of latLngs into an ST_POLYGONFROMTEXT
function makeSqlPolygon(coords) {
    var s = "ST_SETSRID(ST_PolygonFromText(\'POLYGON((";
    var firstCoord;
    coords.forEach(function (coord, i) {
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

            $notes = $('#fields-notes');

            // Update the button's color
            if (isChecked) {
                $widget.addClass(style + color + ' active');
                selectedFields.push($widget.text());
            } else {
                $widget.removeClass(style + color + ' active');
                selectedFields = removeA(selectedFields, $widget.text());
            }
            if (selectedFields.length) {
                $notes.html("<li>" + selectedFields.join("</li><li>") + "</li>")
            } else {
                $notes.html("<i>nothing selected</i>")
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
        //console.log(checkedItems);
    });
    return checkedItems;
}


function setStatusDisplay(status) {
    var $header = $('#prog-header');
    var $text = $('#prog-text');
    var $dl = $('#dl-text');
    var $img = $('#prog-img');
    if (status == 'reset') {
        $header.text("Your Data is On It's Way!");
        $text.text("Sending Request to Server...").show();
        $dl.hide();
        $img.show();
    }
    else if (status == 'downloaded') {
        $header.text("It's Here!");
        $text.hide();
        $dl.show();
        $img.hide();
    }
}

$('#dl-text').on('click', function () {
    $("#prog-modal").foundation('close');
});

function removeA(arr) {
    var what, a = arguments, L = a.length, ax;
    while (L > 1 && arr.length) {
        what = a[--L];
        while ((ax = arr.indexOf(what)) !== -1) {
            arr.splice(ax, 1);
        }
    }
    return arr;
}