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

    // Initialize the curvetypes row, so we know which curves to render and how
    var curvetypes = initializeCurvetypes(rows.curvetypes)

    // Initialize the datasets row, along with dataset parameters
    var datasets = initializeDatasets(rows.datasets)

    // Initialize the settings row, so we can change various behaviours of the application
    var settings = initizalizeSettings(rows.settings)

    settings(function(s) { console.log(s) })
    curvetypes(function(s) { console.log(s) })
    datasets(function (a) { console.log(a) })

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
                args_container.append('label').attr('for', unique_id).text(d.args[k].name);
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

        toggles.each(function(d) {
            var obj = {}
            obj.name = d.name
            obj.active = this.checked

            obj.args = [];
            root.select('label[for=' + d.name + ']').select('.curvetype--args input')
                .each(function (d) {
                    obj.args.push({ name: this.id, value: this.value })
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

    return subscribe;
}

/*
 * --- Dataset Row ---
 *
 * This function does a few things. It renders the markup for each dataset, along with
 * a mini preview of the set, generated from a few default parameters. Below each preview
 * is the name of the dataset (or "custome") and the relevant parameters to fiddle around with it.
 *
 * @todo implement the custom dataset renderer
 * @param root = The DOM element under which to render everything
 * @return subscribe = a function that takes a callback to be called when the selection changes
 */
function initializeDatasets(root) {

    var datasets_container = root.selectAll('.dataset').data(DATA.generated);

    datasets = datasets_container.enter()
        .append('div').classed('dataset', true)

    /* Add the miniature visualization of example data points */
    datasets.each(function (d, i, n) {
        minivis(d.example, d3.select(this))
    })


    /* Add the boxes with name and arg controls */
    var infos = datasets.append('div').classed('dataset--info', true)
    infos.append('h4').text(function (d) { return d.name }) // Name
    infos.each(function (d, i, n) { // Arg controls
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
                .attr('min', d.args[i].scale)
                .text(function (d) { return d.args[i].name })
        }
    });


    /* Returns the data object bound to the active curve along with its arguments arguments */
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

    /* Add an event listener to see if changes occur */
    // @todo fix the change listener - it's not firing properly
    // @todo add a button to select - not the entire element
    datasets.on(['click.select', 'change.notifySubscribers'], function (d, i, n) {
        // @todo check to see if the current selection is equal to the last
        for (var i = 0; i < n.length; i++) {
            d3.select(n[i]).classed('selected', false);
        }
        d3.select(this).classed('selected', true);
        callSubs()
    })

    return subscribe;
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

    // Returns a settings object, based on the current state of the UI
    var getSettings = function () {
        var settings = [];
        settings_controls.selectAll('input').each(function (d) { settings.push( { name: d.name, value: getValue(this) } ) })
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

    return subscribe;
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
