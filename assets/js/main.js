document.addEventListener("DOMContentLoaded", main); // Will run the main function when everything is loaded


var DATA = window.__DATA__;
var pi = Math.PI;

function main() {
    // Grab the DOM rows so we can generate interactive elements
    var rows = {
        curvetypes: d3.select('#curvetypes'),
        datasets: d3.select('#datasets'),
        settings: d3.select('#settings')
    }
    var chart_root = d3.select('#chart');

    // Initialize the curvetypes row, so we know which curves to render and how
    var curvetypes = initializeCurvetypes(rows.curvetypes)

    // Initialize the datasets row, along with dataset parameters
    var datasets = initializeDatasets(rows.datasets)

    // Initialize the settings row, so we can change various behaviours of the application
    var settings = initizalizeSettings(rows.settings)

    // Build a default state
    var state = {
        dataset: datasets.default,
        curves: curvetypes.default,
        settings: settings.default
    }

    // Make the Chart and do a default render pass
    var chart = new Chart(chart_root)
    chart.renderState(state)


    // Handle Changes
    var update = function (key, value) {
        state[key] = value
        chart.renderState(state);
    }

    settings.subscribe(function (s) { update('settings', s) })
    curvetypes.subscribe(function(c) { update('curves', c.filter( function(k) { return k.active } )) })
    datasets.subscribe(function (d) { update('dataset', d) })

}


/*
 * --- Render ---
 *
 * This is the main function that does all the serious work. It consumes a dataset object
 * and settings, then will render a scatterplot with the selected curves running through it.
 *
 * If the scatterplot is already initialized, then it will transition the axes and points to
 * fit the new data.
 *
 * @param root = Where to render the scatterplot
 * @param dataset = A standard dataset object
 * @param curves = An object which contains curves which should be rendered
 * @param settings = The global settings object
 */


function Chart(root) {
    var D = { width: 860, height: 300, padding: 20, axis: { left: 40, bottom: 20, right: 30 } }
    var POINT_RADIUS = 3;


    // Making the root svg, and mounting it to the `root` parameter.
    var svg = root.append('svg').attr('width', D.width).attr('height', D.height)

    // `scatterplot` will be the group which contains all the points.
    var scatterplot = svg.append('g').classed('scatterplot--data', true)
        .attr('transform', 'translate(' + D.axis.left + ', 0)')

    // Set up containers for the axes
    svg.append('g').classed('axis--x axis', true)
    svg.append('g').classed('axis--y axis', true)

    this.render = function (dataset, curves, settings) {
        // This object has the parameters to handle animation timing.
        // These are pulled out because animation timing is a big deal, and
        // may change depending on settings.
        var DUR = {
            DELAY: 20,
            POINTS: 800,
            AXES: 700,
            LINE: 600
        }

        // Disable animations by setting durations to 0 (if the user wants)
        if (settings.get("Play animations").value === false) {
            DUR = { POINTS: 0, AXES: 0, LINE: 0, DELAY: 0 }
        }

        // Get data and relevant measurments
        var data = generateData(dataset);
        var extents = getExtentFromPoints(data);

        // Get scales to fit data to graph
        var x = d3.scaleLinear().domain(extents.x).range([0, D.width - D.padding - D.axis.right]);
        var y = d3.scaleLinear().domain(extents.y).range([D.height - D.padding, D.padding])

        // Get axis generators (no labels for x-axis)
        var x_axis = d3.axisBottom().scale(x).tickFormat("").tickSizeInner(4)
        var y_axis = d3.axisLeft().scale(y).ticks(8, "1s")

        // Remove old axes and add the new ones onto the root svg
        svg.select('.axis--x')
            .attr('transform', 'translate(' + D.axis.left + ', ' + y(0) + ')') // Always position at 0 on the y-axis
            .transition()
            .call(x_axis)
        svg.select('.axis--y')
            .attr('transform', 'translate(' + D.axis.left + ', 0)')
            .transition().duration(DUR.AXES)
            .call(y_axis)

        // Drawing the points (can be disabled)
        // ENTER
        var bound = scatterplot.selectAll('circle').data(data)
        if (settings.get("Show data points").value === true) {
            bound.enter()
                .append('circle')
                    .classed('point', true)
                    .attr('r', 0)
                    .attr('cx', function (d) { return x(d3.median(data.map(function(d) { return d.x }))) })
                    .attr('cy', function (d) { return y(0) })
                .merge(bound) // ENTER + UPDATE
                    .transition().duration(DUR.POINTS).delay(function (d, i) { return i * (DUR.POINTS * 1 / data.length) })
                    .attr('cx', function (d) { return x(d.x) })
                    .attr('cy', function (d) { return y(d.y) })
                    .attr('r', POINT_RADIUS)

            bound.exit()
                .transition().duration(DUR.POINTS)
                .attr('r', 0)
                .remove()
        } else {
            // Remove all the points with a nice fade out animation
            scatterplot.selectAll('circle').transition().duration(DUR.POINTS).attr('r', 0).remove();
        }

        // Loop through the curves that were passed an render them all
        scatterplot.selectAll('.line').remove();

        // @todo figure out how to keep them persistent and animate
        // their changes.
        var line;
        for (var i = 0; i < curves.length; i++) {
            line = buildCurve(curves[i]);
            scatterplot.append('path').classed('line', true)
                .attr('stroke', this.colorizeArgs(curves[i].args))
                .attr('d', line(this.arrayMap(data, { x: x, y: y })))
        }
    }

    // Turns an { x, y } data object into something that d3 can work with.
    this.arrayMap = function (data, scales) {
        scales = scales || { x: d3.scaleIdentity(), y: d3.scaleIdentity() }
        var result = [];
        for (var i = 0; i < data.length; i++) {
            result.push([scales.x(data[i].x), scales.y(data[i].y)])
        }
        return result;
    }

    // Based on an arguments array, this will return a color.
    // Used for coloring based on argument.
    this.colorizeArgs = function (args) {
        var hash = 0;
        var rainbowColorScale = d3.scaleLinear().domain([0, 0.25, 0.5, 0.75, 1]).range(["red", "green", "blue", "purple", "orange"])
        var heatColorScale = d3.scaleLinear().domain([0, 0.25, 0.5, 0.75, 1]).range(["#8854A5", "#DB4A35", "#EF9645", "#F45B00", "#FF17EE"])

        if (args.length === 0) {
            return rainbowColorScale(Math.random());
        }

        for (var i = 0; i < args.length; i++) {
            hash += args[i].value
        }
        return heatColorScale(hash) // Always between 0 and 1, because of the args themselves
    }

    // Just calls render from a state object
    this.renderState = function (state) {
        this.render(state.dataset, state.curves, state.settings);
    }
}

/*
 * This function builds a curve factory from a standard curves object
 *
 * @param curve = A standard curve object
 * @return curveFactory = A function that generate paths using d3
 */
function buildCurve(curve) {
    var base = d3['curve' + curve.name]; // The base curve without any arguments
    var args = curve.args;
    var built;

    if (args !== false) {
        var x;
        built = base;
        for (var i = 0; i < args.length; i++) {
            x = args[i];
            built = built[x.name](x.value) // Plug in the argument
        }
    } else {
        built = base;
    }
    return d3.line().curve(built);
}

/*
 * This function just puts together the arguments, calls
 * a datasets generation method and returns the results.
 *
 * @param dataset = a standard dataset object
 * @return data = an array of { x, y } objects describing points.
 */
function generateData(dataset) {
    var arg_obj = {};
    var x;
    for (var i = 0; i < dataset.args.length; i++) {
        x = dataset.args[i]; // For brevity
        arg_obj[x.name] = x.scale(x.value);
    }
    return dataset.method(arg_obj);
}


function getExtentFromPoints(data) {
    var x_extent = d3.extent(data.map( function (d) { return d.x } ))
    var y_extent = d3.extent(data.map( function (d) { return d.y } ))
    return { x: x_extent, y: y_extent }
}


/*
 * --- Curvetype Row ---
 *
 * This function has a simple job - render the markup for each type of curve
 * and return a data structure describing the ui, so that we can listen for changes.
 * This function is also responsible for the two convenience 'select [stuff]' buttons.
 *
 * @param root = The DOM element under which ui controls and curve labels are rendered
 * @return subscribe = A function that accepts a callback to be called when
 *                     the selection updates. The callback is passed the relevant information
 */
function initializeCurvetypes(root) {
    var curvetype_list = root.append('div').classed('labels', true).selectAll('.curvetype').data(DATA.curvetypes)

    // Add checkboxes to control the toggled state of the labels
    curvetype_list.enter()
        .append('input')
            .attr('type', 'checkbox')
            .attr('id', function (d) { return d.name })
            .classed('curvetype--toggle', true)

    // Add nice looking labels for the user to click on
    var labels = curvetype_list.enter()
        .append('label')
            .classed('curvetype', true)
            .attr('for', function (d) { return d.name })

    // If the curvetype has modifyable arguments, then this function adds markup
    // to allow users to fiddle with them
    var generateArgs = function(d, i, n) {
        if (d.args) {
            var args_container = d3.select(this).append('div').classed('curvetype--args', true);
            for (var k = 0; k < d.args.length; k++) { // Using k because I need the i parameter
                var unique_id = d.args[k].name + '-' + i;
                args_container.append('span').text(d.args[k].name);
                args_container.append('input')
                    .attr('id', unique_id)
                    .attr('type', 'number')
                    .attr('step', '0.01')
                    .attr('min', 0)
                    .attr('max', 1)
                    .attr('value', d.args[k].default)
            }
            return args_container;
        }
    }

    labels.append('h4').text(function (d) { return 'd3.curve' + d.name })
    labels.each(generateArgs)

    // Add a select all button
    root.datum(DATA.curvetypes)
        .append('button')
            .text('Select All')
            .on('click', function (d) {
                root.selectAll('.curvetype--toggle').property('checked', true)
                root.selectAll('.curvetype').classed('selected', true)
                callSubs() // Need to do this manually to ensure correct order
            })

    // Add a select none button
    root.datum(DATA.curvetypes)
        .append('button')
            .text('Select None')
            .on('click', function (d) {
                root.selectAll('.curvetype--toggle').property('checked', false)
                root.selectAll('.curvetype').classed('selected', false)
                callSubs() // Need to do this manually to ensure correct order
            })

    // Add an event listener to toggle label styles depending on checkbox values
    root.selectAll('.curvetype--toggle').on('change.updateLabel', function (d, i, n) {
        root.select('.curvetype[for=' + this.id + ']').classed('selected', this.checked)
    })

    // A function to pull the relevant info out of the UI
    var getCurvetypeState = function () {
        var state = [];
        var toggles = root.selectAll('.labels > input[type=checkbox]');
        var beforeHyphen = function (string) {
            return string.match(/[^-]*/)[0] // Matches anything before the first hyphen
        }

        toggles.each(function(d) {
            var obj = {}
            obj.name = d.name
            obj.active = this.checked

            obj.args = [];
            root.select('label[for=' + d.name + ']').select('.curvetype--args input')
                .each(function (d) {
                    // Note that we assume a format of name-1234 and a value which is a number
                    obj.args.push({ name: beforeHyphen(this.id), value: parseFloat(this.value) })
                })

            state.push(obj)
        })

        return state
    }

    var subscribers = [];
    var callSubs = function() {
        for(var i = 0; i < subscribers.length; i++) {
            subscribers[i].call(this, getCurvetypeState())
        }
    }

    root.on('change.notifySubscribers', callSubs)

    var subscribe = function (callback) {
        subscribers.push(callback)
    }

    // Set up the defaults
    var default_curves = [  ]

    return { subscribe: subscribe, default: default_curves };
}

/*
 * --- Dataset Row ---
 *
 * This function does a few things. It renders the markup for each dataset, along with
 * a mini preview of the set, generated from a few default parameters. Below each preview
 * is the name of the dataset and the relevant parameters to fiddle around with it.
 *
 * @param root = The DOM element under which to render everything
 * @return subscribe = a function that takes a callback to be called when the selection changes
 */
function initializeDatasets(root) {

    var datasets_container = root.selectAll('.dataset').data(DATA.generated);

    datasets = datasets_container.enter()
        .append('div').classed('dataset', true)

    // Set up the default datset properly
    datasets.each(function (d) {
        if (d.default === true) {
            d3.select(this).classed('selected', true)
        }
    })

    /* Add the miniature visualization of example data points */
    datasets.each(function (d, i, n) {
        minivis(d.example, d3.select(this))
    })


    /* Add the boxes with name and arg controls */
    var infos = datasets.append('div').classed('dataset--info', true)
    infos.append('h4').text(function (d) { return d.name }) // Name
    // Argument controls
    infos.append('div').classed('dataset--arg-group', true).each(function (d, i, n) {
        var root = d3.select(this);

        /* Append each argument with an input and label */
        for (var i = 0; i < d.args.length; i++) {
            var unique_id = d.args[i].name + '-' + i;

            var group = root.append('div').classed('dataset--arg', true);

            group.append('label')
                .attr('for', unique_id)
                .text(function (d) { return d.args[i].name })

            group.append('input')
                .attr('id', unique_id)
                .attr('type', 'number')
                .attr('value', d.args[i].default)
                .attr('step', calibrateStepSize(d.args[i].default))
                .attr('min', d.args[i].scale.range()[0])
                .attr('max', d.args[i].scale.range()[1])
                .text(function (d) { return d.args[i].name })
        }
    });
    // Button to choose the active dataset
    var selector_buttons = infos.append('button').classed('dataset--select', true).text('Select');


    /* Returns the data object bound to the active curve along with its arguments */
    var getActiveDataset = function () {
        var active = datasets.filter('.selected');
        var active_state = active.data()[0]

        // Fill the returned object with the current value of each argument (from the UI)
        var argname;
        for (var i = 0; i < active_state.args.length; i++) {
            argname = active_state.args[i].name;
            active_state.args[i].value = parseFloat(active.select('#' + argname + '-' + i).property('value')) // Assumption that all are numbers
        }

        return active_state;
    }

    /* See other implementations of this for explanation */
    var subscribers = [];
    var callSubs = function () {
        for (var i = 0; i < subscribers.length; i++) {
            subscribers[i].call(this, getActiveDataset())
        }
    }
    var subscribe = function (callback) {
        subscribers.push(callback);
    }

    // Add a selected class, and call subs
    var selectDataset = function (d, i, n) {
        for (var i = 0; i < n.length; i++) {
            datasets.classed('selected', false);
        }
        // this is bad.
        d3.select(this.parentNode.parentNode).classed('selected', true);
        callSubs()
    }
    /* Add an event listener to see if changes occur */
    selector_buttons.on('mousedown.select', selectDataset)

    return { subscribe: subscribe, default: getActiveDataset() };
}

/*
 * Generates a very simple SVG scatterplot
 * @param data = An array of { x, y } objects
 * @param root = The element that the SVG will be appended to
 * @return svg = A super-simple SVG scatterplot of 'data'
 */
function minivis(data, root) {
    var D = { width: 130, height: 130, padding: 30 }
    var extent_x = d3.extent(data.map( function(p) { return p.x } ))
    var extent_y = d3.extent(data.map( function(p) { return p.y } ))

    var x = d3.scaleLinear().domain(extent_x).range([D.padding, D.width - D.padding])
    var y = d3.scaleLinear().domain(extent_y).range([D.padding, D.height - D.padding])

    var svg = root.append('svg')
                .attr('width', D.width)
                .attr('height', D.height)

    svg.append('g').classed('points', true).selectAll('.point').data(data)
        .enter()
        .append('circle')
            .classed('point', true)
            .attr('cx', function (d) { return x(d.x) })
            .attr('cy', function (d) { return y(d.y) })
            .attr('r', 2)

    return svg;
}

/*
 * --- Settings Row ---
 *
 * This function will grab the predefined settings (from DATA) and render them for
 * configuration to root. If will also return a function that returns the current
 * state of the settings.
 *
 * @param root = As you would expect - this is where to render the settings controls
 * @return subscribe = A function that accepts a callback as a parameter. When the settings
 *                     are changed, this function calls the callback with the new settings
 */
function initizalizeSettings(root) {
    // UTILITY FUNCTIONS
    var getValue = function(node) { // To determine which property of a DOM node gives its relevant value
        return (node.type === 'checkbox' || node.type === 'radio') ? node.checked : node.value
    }

    var wordify = function(phrase) { // This is for defining valid IDs
        return phrase.split(' ').join('-').toLowerCase()
    }

    var inputType = function(datatype) { // So we know what to render for a given input type
        switch (datatype) {
            case "boolean":
                return "checkbox"
            case "number":
                return "number"
            default:
                return "text"
        }
    }

    // Bind to settings from DATA
    var settings = root.selectAll('.settings--control').data(DATA.settings)

    // Each setting is contained in a controls group
    var settings_controls = settings.enter()
        .append('div').classed('settings--control', true)

    // Add the appropriate input type for each setting
    settings_controls.append('input')
            .attr('type', function (d) { return inputType(d.type) })
            .attr('id', function (d) { return wordify(d.name) })
            .attr('checked', function (d) { return d.default })

    // Add labels for each settings
    settings_controls.append('label')
            .text( function (d) { return d.name } )
            .attr('for', function (d) { return wordify(d.name) })

    // A method to get settings - needed for later when they're accessed
    var getSingleSetting = function (name) {
        for (var i = 0; i < this.length; i++) {
            if (this[i].name === name) {
                return this[i]
            }
        }
        return null;
    }
    // Returns a settings object, based on the current state of the UI
    var getSettings = function () {
        var settings = [];
        settings_controls.selectAll('input').each(function (d) { settings.push( { name: d.name, value: getValue(this) } ) })
        settings.get = getSingleSetting
        return settings;
    }

    // This looks complex, but in reality, it's quite simple.
    // 1. Make an array, which will hold functions
    // 2. The subscriber function, when called, will add a function to this array
    // 3. Whenever the settings change, call every function in the array with the new settings
    var subscribers= [];
    var subscribe = function(callback) {
        subscribers.push(callback);
    }
    settings_controls.on('change.notifySubscribers', function() {
        for (var i = 0; i < subscribers.length; i++) {
            subscribers[i].call(this, getSettings())
        }
    })

    return { subscribe: subscribe, default: getSettings() };
}


/*
 * --- UTILITY FUNCTIONS ---
 *
 */


// This is used to infer how large the step for a number input should be
function calibrateStepSize (number) {
    var after_dp = new String(number).match(/\.[0-9]+$/)
    if (after_dp !== null) {
        return 1 / (10 * (after_dp[0].length - 1)) // 0.01 for .xx
    } else {
        return number > 10 ? 2 : 1;
    }
}
