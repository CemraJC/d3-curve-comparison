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

    var curvetypes = initializeCurvetypes(rows.curvetypes)
    var curvetypeState = function() {
        var state = [];
        curvetypes.selectAll('.curvetype--toggle').each( function() { state.push({ name: this.id, active: this.checked }) } )
        return state;
    }

    // curvetypes.on('change.showState', () => console.log(curvetypeState()))
}



/*
 * --- Curvetype Row ---
 *
 * This function has a simple job - render the markup for each type of curve
 * and return a data structure describing the ui, so that we can listen for changes.
 * This function is also responsible for the two convenience 'select [stuff]' buttons.
 *
 * @todo Bake in rendering for each curve's parameters (need sliders first)
 * @param root = The DOM element under which ui controls and curve labels are rendered
 * @return root = A d3 element that contains the relevant UI
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
    curvetype_list.enter()
        .append('label')
            .classed('curvetype', true)
            .attr('for', function (d) { return d.name })
            .append('h4').text(function (d) { return 'd3.curve' + d.name })


    // Add a select all button
    root.datum(DATA.curvetypes)
        .append('button')
            .text('Select All')
            .on('click', function(d) {
                root.selectAll('.curvetype--toggle').property('checked', true)
                root.selectAll('.curvetype').classed('selected', true)
            })

    // Add a select none button
    root.datum(DATA.curvetypes)
        .append('button')
            .text('Select None')
            .on('click', function(d) {
                root.selectAll('.curvetype--toggle').property('checked', false)
                root.selectAll('.curvetype').classed('selected', false)
            })

    // Add an event listener to toggle label styles depending on checkbox values
    root.selectAll('.curvetype--toggle').on('change.updateLabel', function (d, i, n) {
        root.select('.curvetype[for=' + this.id + ']').classed('selected', this.checked)
    })

    return root;
}
