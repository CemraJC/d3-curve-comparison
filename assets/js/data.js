var datasets = {};
    datasets.generated = [];
    datasets.curvetypes = [];

var pi = Math.PI

/*
 * This is a factory function that returns objects that can be added
 * to the list of generated datasets. Each object describes exactly how to generate
 * the data and also the allowed values for each argument.
 *
 * Note: The purpose of even having a factory function is to describe the way
 *       each generator object should be structured as a standard.
 *
 * @param name   = the name of the generator
 * @param method = the function that generates the data set, given the parameters
 * @param args = the names and accepted domains for each parameter
 */
function generatedData(name, method, args) {
    return {
        name: name,
        method: method,
        args: args
    }
}

/*
 * A simple function that generates an array of {x, y} objects constrained to a
 * sine curve, according to certain input parameters.
 *
 * @param amplitude = how "tall" the sine curve is
 * @param period    = how "spread out" the cycles are
 * @param cycles    = how many times the sinusoid repeats
 * @param density   = the number of discrete points per cycle. Ideally around 24.
 */
function generateSin(amplitude, period, cycles, density) {
    var point_count = cycles * density;
    var data = d3.range(point_count);

    // I could implement these with mathematics, but d3 is easier to understand
    var x = d3.scaleLinear().domain([0, point_count]).range([0, cycles * period])
    var y = d3.scaleLinear().domain([-1, 1]).range([-amplitude, amplitude])

    var sinTransform = function (index) {
        var input = x(index);
        var output = y(Math.sin(input)); // First, transform the x-value just
                                         // like on a graph, then perform y-axis scaling
                                         // for amplitude corrections
        return { x: input, y: output }
    }

    return data.map(sinTransform)
}

/* Generator definition, for use in main.js */
var sin = generatedData("Sinusoidal Curve", generateSin, [
    {
        name: "amplitude",
        range: d3.scaleLinear().range([0, 100000]).clamp(true)
    },
    {
        name: "period",
        scale: d3.scaleLinear().range([0, 50]).clamp(true)
    },
    {
        name: "cycles",
        scale: d3.scaleLinear().rangeRound([0, 50]).clamp(true)
    },
    {
        name: "density",
        scale: d3.scaleLinear().rangeRound([5, 100]).clamp(true)
    }
])



/*
 * This is a very simple function that will generate a "random" dataset based
 * on a seed. This is useful for testing how a curve handles sharp changes in data.
 *
 * @param seed = an integer that decides how the random data will be generated.
 *               In a sense, the data is pseudorandom, because if the same seed is provided,
 *               then the same distribution will be yeilded. If you want the generated data
 *               to be different every time, then just pass in `Date.now()` or `Math.random()` as the seed.
 * @param amplitude = how "tall" the dataset will be
 * @param points = how many data points to generate
 */
function generateRandom(seed, amplitude, points) {
    var data = d3.range(points)
    var MOD = 1e8
    var seed = Math.round(seed * seed / 3 * 10000); // A bit more entropy to work with

    var x = d3.scaleLinear().domain([0, points]).rangeRound([0, points]); // Not a very useful scale, but it could change
    var y = d3.scaleLinear().domain([0, MOD]).range([0, amplitude]);

    var randomTransform = function (index) {
        var distributeByPrime = function (start) { // A very crude iterative primes distributor (not perfectly random)
            var finish = start;
                finish = (( finish + seed) * 11835984188504168602) % MOD
            return finish
        }
        var input = x(index);
        var output = y(distributeByPrime(index));

        return { x: input, y: output }
    }

    return data.map(randomTransform);
}

var rand = generatedData("Seeded Random Distribution", generateRandom, [
    {
        name: "seed",
        scale: d3.scaleLinear().range([0, 1e7]).clamp(true)
    },
    {
        name: "amplitude",
        scale: d3.scaleLinear().range([0, 10000]).clamp(true)
    },
    {
        name: "points",
        scale: d3.scaleLinear().rangeRound([4, 1000]).clamp(true)
    }
])



/*
 * This function will generate a list of points that circumscribe a ring.
 * The ring can, however, have points sticking out from it. In essence, two
 * rings are generated (one offset from the other) with variable radii.
 *
 * @param radius1 = the radius of the inner ring
 * @param radius2 = the radius of the outer ring
 * @param density = how many points per ring there will be (at least 3).
 */
function generateRing(radius1, radius2, density) {
    var data = [];
    var ring1 = d3.range(density);
    var ring2 = d3.range(density);

    // Turn an integer sequence into an angular sequence for a full circle (overlapping ends)
    var theta = d3.scaleLinear().domain([0, density - 1]).range([0, 2 * pi]);

    var ringTransform = function (index, radius, offset_angle) {
        // Polar Co-ordinates
        var angle = theta(index) + offset_angle;
        var magnitude = radius;

        // Cartesian Co-ordinates (converted from polar above)
        var input = magnitude * Math.cos(angle);
        var output = magnitude * Math.sin(angle);
        return { x: input, y: output }
    }

    // Generate the first ring
    data = data.concat(ring1.map(function (member) {
        return ringTransform(member, radius1, 0)
    }));

    // Generate the second ring
    data = data.concat(ring2.map(function (member) {
        var angle_offset = (theta(1) - theta(0)) / 2 // Position the 2nd ring between the points of the first
        return ringTransform(member, radius2, angle_offset)
    }));

    return data;
}

var ring = generatedData("Rings", generateRing, [
    {
        name: "radius1",
        scale: d3.scaleLinear().range([0, 1e7]).clamp(true)
    },
    {
        name: "radius2",
        scale: d3.scaleLinear().range([0, 1e7]).clamp(true)
    },
    {
        name: "density",
        scale: d3.scaleLinear().rangeRound([3, 100]).clamp(true)
    }
])

/*
 * Custom Dataset. Because this is not strictly generated, it is added
 * as an alternative key. Because a custom dataset still has parameters
 * (namely, domain and range) it follows a similar format.
 *
 * The custom dataset has its own specialized rendering methods that include:
 *  * Listening for click/touch events to render new points and cause a redraw
 *  * Rendering a 'clear' button below each axis
 *  * Putting the domain and range sliders next to each axis
 */

datasets.custom = {
    name: "Custom Dataset",
    method: "custom",
    args: [
        {
            name: "domain",
            scale: d3.scaleLinear().domain([0, 10000]).rangeRound([0, 1000])
        },
        {
            name: "range",
            scale: d3.scaleLinear().domain([0, 10000]).rangeRound([0, 1000])
        },
    ],
    note: [
        {
            medium: "desktop",
            message: "Left-click to place a point, Right click to remove it"
        },
        {
            medium: "touch",
            message: "Touch to place a point, Long press to remove it"
        }
    ]
}

/*
 * The types of curves to be tested
 */
datasets.curvetypes = [
    {
        name: "Basis",
        args: false
    },
    {
        name: "BasisClosed",
        args: false
    },
    {
        name: "BasisOpen",
        args: false
    },
    {
        name: "Bundle",
        args: [
            {
                name: "beta",
                scale: d3.scaleLinear().range([0, 1]).clamp(true)
            }
        ]
    },
    {
        name: "Cardinal",
        args: [
            {
                name: "tension",
                scale: d3.scaleLinear().range([0, 1]).clamp(true)
            }
        ]
    },
    {
        name: "CardinalClosed",
        args: [
            {
                name: "tension",
                scale: d3.scaleLinear().range([0, 1]).clamp(true)
            }
        ]
    },
    {
        name: "CardinalOpen",
        args: [
            {
                name: "tension",
                scale: d3.scaleLinear().range([0, 1]).clamp(true)
            }
        ]
    },
    {
        name: "CatmullRom",
        args: [
            {
                name: "alpha",
                scale: d3.scaleLinear().range([0, 1]).clamp(true)
            }
        ]
    },
    {
        name: "CatmullRomClosed",
        args: [
            {
                name: "alpha",
                scale: d3.scaleLinear().range([0, 1]).clamp(true)
            }
        ]
    },
    {
        name: "CatmullRomOpen",
        args: [
            {
                name: "alpha",
                scale: d3.scaleLinear().range([0, 1]).clamp(true)
            }
        ]
    },
    {
        name: "Linear",
        args: false
    },
    {
        name: "LinearClosed",
        args: false
    },
    {
        name: "MonotoneX",
        args: false
    },
    {
        name: "MonotoneY",
        args: false
    },
    {
        name: "Natural",
        args: false
    },
    {
        name: "Step",
        args: false
    },
    {
        name: "StepAfter",
        args: false
    },
    {
        name: "StepBefore",
        args: false
    }
]

/* Add all the dataset generators to the list */
datasets.generated.push(sin)
datasets.generated.push(rand)
datasets.generated.push(ring)

window.__DATA__ = datasets
