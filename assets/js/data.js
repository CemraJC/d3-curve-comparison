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
function generateSin(p) { // p is for params
    var point_count = p.cycles * p.density;
    var data = d3.range(point_count);

    // I could implement these with mathematics, but d3 is easier to understand
    var x = d3.scaleLinear().domain([0, point_count]).range([0, p.cycles * p.period])
    var y = d3.scaleLinear().domain([-1, 1]).range([-p.amplitude, p.amplitude])

    var sinTransform = function (index) {
        var input = x(index);
        var output = y(Math.sin(input * (2 * pi) / p.period)); // First, transform the x-value just
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
        default: 1,
        scale: d3.scaleLinear().domain([0, 100000]).range([0, 100000]).clamp(true)
    },
    {
        name: "period",
        default: 1,
        scale: d3.scaleLinear().domain([0, 50]).range([0, 50]).clamp(true)
    },
    {
        name: "cycles",
        default: 1,
        scale: d3.scaleLinear().domain([0, 20]).rangeRound([0, 20]).clamp(true)
    },
    {
        name: "density",
        default: 16,
        scale: d3.scaleLinear().domain([5, 100]).rangeRound([5, 100]).clamp(true)
    }
])

sin.default = true;



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
function generateRandom(p) { // p is for params
    var data = d3.range(p.points)
    var MOD = 1e8
    var seed = Math.round(p.seed * p.seed / 3 * 10000); // A bit more entropy to work with

    var x = d3.scaleLinear().domain([0, p.points]).rangeRound([0, p.points]); // Not a very useful scale, but it could change
    var y = d3.scaleLinear().domain([0, MOD]).range([0, p.amplitude]);

    var randomTransform = function (index) {
        var distributeByPrime = function (start) { // Crude PRNG - don't use this seriously
            var finish = start;
            for (var i = 0; i < 10; i++) {
                var angle = (finish * start * i * seed + 1) % 10000 / 1000
                finish = Math.sin(angle);
            }
            return finish;
        }
        var input = x(index);
        var output = y(distributeByPrime(index));

        return { x: input, y: Math.abs(output) }
    }

    return data.map(randomTransform);
}

var rand = generatedData("Random", generateRandom, [
    {
        name: "seed",
        default: 9,
        scale: d3.scaleLinear().domain([0, 1e7]).range([0, 1e7]).clamp(true)
    },
    {
        name: "amplitude",
        default: 1,
        scale: d3.scaleLinear().domain([0, 10000]).range([0, 10000]).clamp(true)
    },
    {
        name: "points",
        default: 13,
        scale: d3.scaleLinear().domain([4, 1000]).rangeRound([4, 1000]).clamp(true)
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
function generateRing(p) { // p is for params
    var data = [];
    var ring1 = d3.range(p.density);
    var ring2 = d3.range(p.density);

    // Turn an integer sequence into an angular sequence for a full circle (overlapping ends)
    var theta = d3.scaleLinear().domain([0, p.density - 1]).range([0, 2 * pi]);

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

    ring1 = ring1.map(function (member) {
        return ringTransform(member, p.radius1, 0)
    });

    // Generate the second ring
    ring2 = ring2.map(function (member) {
        var angle_offset = (theta(1) - theta(0)) / 2 // Position the 2nd ring between the points of the first
        return ringTransform(member, p.radius2, angle_offset)
    });

    // Interleave the rings, so lines zig-zag between points
    // This weird for-loop runs until both arrays are out of elements
    for (var i = 0; ring1[i] !== undefined || ring2[i] !== undefined; i++) {
        if (ring1[i] !== undefined) data.push(ring1[i]) // If there's something, push it on!
        if (ring2[i] !== undefined) data.push(ring2[i]) //                 "
    }

    return data;
}

var ring = generatedData("Rings", generateRing, [
    {
        name: "radius1",
        default: 0.9,
        scale: d3.scaleLinear().domain([0, 100]).range([0, 100]).clamp(true)
    },
    {
        name: "radius2",
        default: 1.1,
        scale: d3.scaleLinear().domain([0, 100]).range([0, 100]).clamp(true)
    },
    {
        name: "density",
        default: 12,
        scale: d3.scaleLinear().domain([4, 100]).rangeRound([4, 100]).clamp(true)
    }
])

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
                default: 0.85,
                scale: d3.scaleLinear().range([0, 1]).clamp(true)
            }
        ]
    },
    {
        name: "Cardinal",
        args: [
            {
                name: "tension",
                default: 0,
                scale: d3.scaleLinear().range([0, 1]).clamp(true)
            }
        ]
    },
    {
        name: "CardinalClosed",
        args: [
            {
                name: "tension",
                default: 0,
                scale: d3.scaleLinear().range([0, 1]).clamp(true)
            }
        ]
    },
    {
        name: "CardinalOpen",
        args: [
            {
                name: "tension",
                default: 0,
                scale: d3.scaleLinear().range([0, 1]).clamp(true)
            }
        ]
    },
    {
        name: "CatmullRom",
        args: [
            {
                name: "alpha",
                default: 0.5,
                scale: d3.scaleLinear().range([0, 1]).clamp(true)
            }
        ]
    },
    {
        name: "CatmullRomClosed",
        args: [
            {
                name: "alpha",
                default: 0.5,
                scale: d3.scaleLinear().range([0, 1]).clamp(true)
            }
        ]
    },
    {
        name: "CatmullRomOpen",
        args: [
            {
                name: "alpha",
                default: 0.5,
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

/* Generate an example dataset (for visualization) */
var generators = [sin, rand, ring], defaults;
var getDefaults = function(args) {
    var obj = {};
    for (var i = 0; i < args.length; i++) {
        obj[args[i].name] = args[i].default
    }
    return obj;
}

for (var i = 0; i < generators.length; i++) {
    defaults = getDefaults(generators[i].args)
    generators[i].example = generators[i].method(defaults);

    /* Add all the dataset generators to the list */
    datasets.generated.push(generators[i])
}


datasets.settings = [
    {
        name: "Play animations", // Some people may find it annoying or slow, so allow them to turn it off
        type: "boolean",
        default: true
    },
    {
        name: "Show data points", // Maybe they just want a pretty curve?
        type: "boolean",
        default: true
    }
]

window.__DATA__ = datasets
