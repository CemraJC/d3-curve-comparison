# d3-curve-comparison

To put a long story short, [click here to see the comparison.][1] You need not
read any further.

# It works offline!

Go ahead and download the repository as a zip file, then just open up
`index.html` in your web browser and everything should work perfectly.

For anyone who noticed the unusual `data.js` file, it is structured the way it
is because that allows it to be pulled in by a script tag. Any other way, and it
would only work on a web server - a requirement which breaks the 2nd goal below.

# Why I made this

First up, [d3][2] is awesome. I absolutely love playing around with data
visualization, and have since come a long way with how to do it myself. But,
everyone starts somewhere, right?

For me, this project is one of my humble beginnings where I used my (at the
time) rudimentary knowledge of d3 to put together a webpage that would allow me
to play around with different types of curves that are provided by d3 by
default, and also experiment with custom curves and datasets.

Regardless of actually visualizing curves, I had a few primary goals that
decided how I would do development:

* Make the code as readable as humanly possible
* Keep it as simple as possible: no webpack, gulp, node, jekyll - nothing like that.
* Only one dependency - the [d3 framework][2].

The main driver behind the goals stated above is "make it as easy as possible
for newcomers to the framework". I really wanted to avoid convoluted design
patterns and _any_ assumed knowledge aside from JavaScript, HTML and CSS.

It was a lot of fun making this, and I hope you find it as useful to play with as I
found it enjoyable to make.



[1]: https://cemrajc.github.io/d3-curve-comparison
[2]: https://d3js.org
