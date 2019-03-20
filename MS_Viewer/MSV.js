"use strict";

var msmsv = function () {


    function spcls(container, tag){
        return (container + '-' + tag);
    }

    function tipcls(type, container, tag){
        return type + " tip-" + spcls(container,tag);
    }

    var cTags = {};
    var cDims = {};
    var cMaxMZ = {};
    var cCallbacks = {};

    function appendSpectrum(container, tag, width, height){
        if (container in cDims) {
            // Force additional spectra in a container to match width and height;
            width, height = cDims[container];
        }
        d3.select("."+container)
            .append("svg")
            .attr("class", spcls(container,tag))
            .attr("width", width)
            .attr("height", height);
        if (!(container in cTags)) {
            // first reference to a specific container
            cTags[container] = [];
            cTags[container].push(tag);
            cDims[container] = (width,height);
            cMaxMZ[container] = {'_max_': 0.0};
            cCallbacks[container] = {}
        } else {
            cTags[container].push(tag);
        }
    }

    function showUnlabelledSpectrum(container, tag, params) {

        if (!(container in cTags) || cTags[container].indexOf(tag) < 0) {
            // console.log("append spectrum "+container+" "+tag);
            var width = params["width"] || 1000;
            var height = params["height"] || 300;
            appendSpectrum(container, tag, width, height);
        }
        clearSpectrum(container, tag);

        var margin = {top: 10, bottom: 20, left: 80, right: 40};

        var canvas =  d3.select("svg."+spcls(container,tag));

        var canvasWidth = canvas.attr("width");
        var canvasHeight = canvas.attr("height");

        var containerWidth = canvasWidth - (margin.left + margin.right);
        var containerHeight = canvasHeight - (margin.top + margin.bottom);

        var transitionDuration = 500;
        var transitionDelay = 300;
        var transitionType = "bounce";

        var group = canvas.append("g")
            .attr("class", "group");

        var selectGroup = group.append("g")
            .attr("class", "select")
            .attr("transform", "translate(" + [margin.left, margin.top] + ")");

        var chartGroup = group.append("g")
            .attr("class", "chartGroup")
            .attr("transform", "translate(" + [margin.left, margin.top] + ")");

        var containerGroup = chartGroup.append("g")
            .attr("class", "container");

        var elementGroup = containerGroup.append("g")
            .attr("class", "elements");

        var peakGroup = elementGroup.append("g")
            .attr("class", "peaks");

        var fragmentGroup = elementGroup.append("g")
            .attr("class", "fragments");

        var fragmentLabelGroup = fragmentGroup.append("g")
            .attr("class", "labelGroup");

        var fragmentSelectedGroup = fragmentGroup.append("g")
            .attr("class", "fragementSelectedGroup");

        var xAxisGroup = chartGroup.append("g")
            .attr("class", "x axis")
            .attr("transform", "translate(" + [0, containerHeight] + ")");

        var yAxisGroup = chartGroup.append("g")
            .attr("class", "y axis");

        var resizeGroup = selectGroup.append("g")
            .attr("class", "resize");

        var annotations = params["annotations"]
        var annotation_data;

        if (annotations) {
            d3.json(annotations, function(data) {
                annotation_data = data;
            })
        }

        var spectra = params["spectra"]
        var format = params["format"]
        var scan = params["scan"]

        getSpectrum(spectra, format, scan, function(spectrum) {

            var peaks = [];
            for (var i = 0, len = spectrum.mz.length; i < len; i++) {
                peaks.push({mz: spectrum.mz[i], int: spectrum.it[i]});
            }

            var maxPeaksInt = d3.max(peaks, function (d){ return d.int; });
            var maxPeaksMZ = d3.max(peaks, function (d){ return d.mz; });
            cMaxMZ[container][tag] = maxPeaksMZ;
            cMaxMZ[container]['_max_'] = 0.0;
            cTags[container].forEach(function (item,index,array) {
                if (cMaxMZ[container]['_max_'] < cMaxMZ[container][item]) {
                    cMaxMZ[container]['_max_'] = cMaxMZ[container][item];
                }
            });

            var domain = {min: 0, max: containerWidth};
            var newDomain = {min: 0, max: containerWidth};
            var scale = 1;

            var widthScale = d3.scale.linear()
                .domain([0, maxPeaksMZ])
                .range([0, containerWidth]);

            var heightScale = d3.scale.linear()
                .domain([0, maxPeaksInt + 20*maxPeaksInt/containerHeight])
                .range([0, containerHeight]);

            var xAxisScale = d3.scale.linear()
                .domain([0, maxPeaksMZ])
                .range([0, containerWidth]);

            var yAxisScale = d3.scale.linear()
                .domain([maxPeaksInt + 20*maxPeaksInt/containerHeight, 0])
                .range([0, containerHeight]);

            var clickScale = d3.scale.linear()
                .domain([0, containerWidth])
                .range([0, maxPeaksMZ]);

            var colorScale = d3.scale.linear()
                .domain([0, containerWidth])
                .range(["skyBlue", "steelblue"]);

            var drag = d3.behavior.drag()
                .on("dragstart", dragStarted)
                .on("drag", dragged)
                .on("dragend", dragEnded);

            var xAxis = d3.svg.axis()
                .scale(xAxisScale)
                .orient("bottom")
                .ticks(12)
                .tickSize(3);

            var yAxis = d3.svg.axis()
                .scale(yAxisScale)
                .orient("left")
                .ticks(Math.max(2,Math.min(6,Math.round(12*containerHeight/500))))
                .tickSize(3);

            var peakTip = d3.tip()
                .attr('class', 'd3-tip ' + tipcls("peak-tip", container, tag))
                .offset([-40, 0])
                .html(function(d) {
                    return "<span style='color: #3f3f3f' > " + toolTip(d,maxPeaksInt) + " </span>";
                });

            // Renders a white rect under the yaxis to cover the peaks, it is really dumb, I know
            var dePeakRenderOmatic = yAxisGroup.append("rect")
                .attr("x", -margin.left)
                .attr("width", margin.left)
                .attr("height", containerHeight)
                .attr("fill",canvas.style("background-color"));

            var selectArea = selectGroup.append("rect")
                .attr("x", 0)
                .attr("y", 0)
                .attr("width", canvasWidth)
                .attr("height", canvasHeight)
                .attr("fill", "none")
                .style("pointer-events", "all")
                .on("contextmenu", function (d, i) {
                    d3.event.preventDefault();
                });

            var lineFunction = d3.svg.line()
                .x(function(d) { return widthScale(d.mz); })
                .y(function(d) { return (containerHeight - heightScale(d.int)); })
                .interpolate("linear");

            /*
            var peakElements = peakGroup
                    .append("path")
                    .attr("d", lineFunction(peaks))
                    .attr("stroke-width", 2)
                    .attr("stroke", "black")
                    .attr("fill", "none")
                    .attr("opacity", "1")
                    .attr("vector-effect", "non-scaling-stroke");
            */


            var peakElements = peakGroup.selectAll("line")
                .data(peaks)
                .enter()
                .append("g")
                .attr("class", function (d, i){ return "peak " + i; })
                .append("line")
                .attr("x1", function (d){ return widthScale(d.mz); })
                .attr("y1", containerHeight)
                .attr("x2", function (d){ return widthScale(d.mz); })
                .attr("y2", function (d){ return (containerHeight - heightScale(d.int)); })
                .attr("stroke-width", 3)
                .attr("stroke", "black")
                .attr("opacity", "1")
                .attr("vector-effect", "non-scaling-stroke")
                .on("mouseover", function (d){
                    peakTip.offset([-10, 0]);
                    showToolTip("peak-tip");
                    peakTip.show(d);
                    hideToolTip("peak-tip");
                });

            containerGroup.call(peakTip);
            selectGroup.call(drag);
            xAxisGroup.transition().duration(transitionDelay).call(xAxis);
            yAxisGroup.transition().duration(transitionDelay).call(yAxis);

            setTimeout(function(){resetDomain();resizeEnded(true,true);},transitionDuration+transitionDelay);

            var originalX;
            var originalY;
            var lastMouseX;
            var lastMouseY;
            var resizeWidth;
            var resizeHeight;
            var selectWidth;
            var selectHeight;

            var isLeftClick;
            var isMiddleClick;
            var isRightClick;

            var zoomDuration = 1000;

            function resetDomain(){
                var domainmax = Math.ceil((cMaxMZ[container]['_max_']+0)/100.0)*100.0;
                setDomain(0,domainmax);
            }

            function setDomain(minmz,maxmz) {
                newDomain.min = widthScale(minmz);
                newDomain.max = widthScale(maxmz);

                tooltipTransition("*", 0, 500, 0);
            }

            function dragStarted(){
                originalX = d3.mouse(this)[0];
                originalY = d3.mouse(this)[1];

                isLeftClick = d3.event.sourceEvent.which == 1;
                isMiddleClick = d3.event.sourceEvent.which == 2;
                isRightClick = d3.event.sourceEvent.which == 3;

                if(isLeftClick) resizeStarted();
                else if(isMiddleClick || isRightClick) resetDomain();
            }

            function dragged(){
                lastMouseX = d3.mouse(this)[0];
                lastMouseY = d3.mouse(this)[1];

                if(isLeftClick) resized();
            }

            function dragEnded(){
                resizeEnded();
            }

            function resizeStarted(){
                resetDomain();

                resizeGroup.append("rect")
                    .attr("x", originalX)
                    .attr("y", originalY)
                    .attr("rx", 5)
                    .attr("ry", 5)
                    .attr("width", 0)
                    .attr("height", 2)
                    .attr("stroke", "steelblue")
                    .attr("stroke-width", 2)
                    .attr("fill", "none")
                    .attr("opacity", 1);
                // .attr("stroke-dasharray", [10, 5])
            }

            function resized(){
                resizeWidth = lastMouseX - originalX;
                resizeHeight = lastMouseY - originalY;

                resizeGroup.selectAll("rect")
                    .attr("width", Math.abs(resizeWidth));
                // .attr("height", Math.abs(resizeHeight));

                if(resizeWidth < 0){
                    resizeGroup.selectAll("rect")
                        .attr("x", lastMouseX);
                    newDomain.min = (lastMouseX / scale) + domain.min;
                    newDomain.max = (originalX / scale) + domain.min;
                }else{
                    newDomain.min = (originalX / scale) + domain.min;
                    newDomain.max = (lastMouseX / scale) + domain.min;
                }

                //if(resizeHeight < 0){
                // 	resizeGroup.selectAll("rect")
                // 		.attr("y", lastMouseY);
                //}
            }

            function resizeEnded(cascade,metoo){
                if (cascade == undefined) { cascade = true; }
                if (metoo == undefined) { metoo = false; }

                // console.log(d3.select("svg").select(".group").select(".chartGroup").select(".x"));

                xAxisScale.domain([clickScale(newDomain.min), clickScale(newDomain.max)]);
                xAxisGroup.transition().duration(zoomDuration).call(xAxis);

                scale = (maxPeaksMZ) / (clickScale(newDomain.max) - clickScale(newDomain.min));

                domain.min = newDomain.min;
                domain.max = newDomain.max;

                elementGroup.transition()
                    .duration(zoomDuration)
                    .attr("transform", "translate(" + [-domain.min * scale, 0] + ")scale(" + [scale, 1] + ")")
                    .selectAll("line")
                    .each("end", function(){ tooltipTransition("*", 0, 500, 0); });

                // 				.attr("stroke-width", 2.1/scale)


                fragmentLabelGroup.selectAll("text").attr("transform", "scale(" + [1 / scale, 1] + ")");

                if (cascade) {
                    cTags[container].forEach(function (item,index,array) {
                        if (item != tag || metoo) {
                            cCallbacks[container][item](clickScale(newDomain.min),clickScale(newDomain.max));
                        }
                    });
                }

                resizeGroup.selectAll("rect")
                    .transition()
                    .duration(zoomDuration)
                    .attr("x", 0)
                    .attr("width", containerWidth)
                    .attr("opacity", 0)
                    .remove();

                // resizeGroup.selectAll("rect")
                // 	.remove();

                tooltipTransition("*", 0, 500, 0);
            }

            cCallbacks[container][tag] = (function (a,b) {setDomain(a,b); resizeEnded(false,false);});

            function showToolTip(type){
                selectToolTip(type).transition()
                    .delay(0)
                    .duration(0)
                    .style("opacity", 1)
                    .style('pointer-events', 'all')
            }

            function hideToolTip(type){
                selectToolTip(type)
                    .on("mouseover", function (){
                        selectToolTip(type).transition()
                            .delay(0);

                    })
                    .on("mouseout", function (){
                        tooltipTransition(type, 0, 500, 0);
                    });

                tooltipTransition(type, 1500, 500, 0);
            }

            function tooltipTransition(type, delay, duration, opacity){
                selectToolTip(type).transition()
                    .delay(delay)
                    .duration(duration)
                    .style("opacity", opacity)
                    .style('pointer-events', 'none');
            }

            function selectToolTip(type){
                //selectAll tool tip feature, out of lazyness :p
                if(type == "*") return d3.selectAll(".d3-tip");

                //Selections only work with a periode in the middle
                return d3.selectAll("." + type + ".tip-" + spcls(container, tag));
            }


        });

    }

    function showSpectrum(container, tag, path, tolerance, width=1000, height=300){

        if (!(container in cTags) || cTags[container].indexOf(tag) < 0) {
            console.log("append spectrum "+container+" "+tag);
            appendSpectrum(container, tag, width, height);
        }
        clearSpectrum(container, tag);

        var margin = {top: 10, bottom: 20, left: 80, right: 40};

        var canvas =  d3.select("svg."+spcls(container,tag));

        var canvasWidth = canvas.attr("width");
        var canvasHeight = canvas.attr("height");

        var containerWidth = canvasWidth - (margin.left + margin.right);
        var containerHeight = canvasHeight - (margin.top + margin.bottom);

        var peptideSpace = 40; 			 <!-- dev options
        var peptidePadding = 40;
        var peptidePixelSize = 40;

        var transitionDuration = 500;
        var transitionDelay = 300;
        var transitionType = "bounce";



        var baseHeightPercent = .05;
        var colorTheme = {b: "steelBlue", y: "tomato", other: "grey"};

        var group = canvas.append("g")
            .attr("class", "group");

        var selectGroup = group.append("g")
            .attr("class", "select")
            .attr("transform", "translate(" + [margin.left, margin.top] + ")");

        var chartGroup = group.append("g")
            .attr("class", "chartGroup")
            .attr("transform", "translate(" + [margin.left, margin.top] + ")");

        var containerGroup = chartGroup.append("g")
            .attr("class", "container");

        var peptideGroup = containerGroup.append("g")
            .attr("class", "peptide");

        var elementGroup = containerGroup.append("g")
            .attr("class", "elements");

        var peakGroup = elementGroup.append("g")
            .attr("class", "peaks");

        var fragmentGroup = elementGroup.append("g")
            .attr("class", "fragments");

        var fragmentLabelGroup = fragmentGroup.append("g")
            .attr("class", "labelGroup");

        var fragmentSelectedGroup = fragmentGroup.append("g")
            .attr("class", "fragementSelectedGroup");

        var xAxisGroup = chartGroup.append("g")
            .attr("class", "x axis")
            .attr("transform", "translate(" + [0, containerHeight] + ")");

        var yAxisGroup = chartGroup.append("g")
            .attr("class", "y axis");

        var resizeGroup = selectGroup.append("g")
            .attr("class", "resize");

        var menuGroup = group.append("g")
            .attr("class", "menu");

        d3.json(path, function (data){

            var spectra = data.spectra;
            var peaks = spectra[0].peaks;
            var peptide = spectra[0].annotations[0].peptide;
            var modifications = spectra[0].annotations[0].modifications;
            var fragments = spectra[0].annotations[0].fragments;
            var newFragments = [];
            var usedPeak = {}

            var maxPeaksInt = d3.max(peaks, function (d){ return d.int; });
            var maxPeaksMZ = d3.max(peaks, function (d){ return d.mz; });
            cMaxMZ[container][tag] = maxPeaksMZ;
            cMaxMZ[container]['_max_'] = 0.0;
            cTags[container].forEach(function (item,index,array) {
                if (cMaxMZ[container]['_max_'] < cMaxMZ[container][item]) {
                    cMaxMZ[container]['_max_'] = cMaxMZ[container][item];
                }
            });

            var controls = [];

            var exit = {
                name: "exit",
                path: "res/CloseCanvasIcon.png",
                exec: function (){
                    deleteSpectrum(container, tag);
                }
            }

            var example = {
                name: "example",
                path: "res/Example.png",
                exec: function (){
                    setDomain(-1000, 1000);
                    //resizeStarted();
                    resizeEnded();
                }
            }

            // controls.push(exit);
            // controls.push(example);



            fragments.forEach(appendFragments);
            newFragments.forEach(drawSymbole);

            var domain = {min: 0, max: containerWidth};
            var newDomain = {min: 0, max: containerWidth};
            var scale = 1;

            var widthScale = d3.scale.linear()
                .domain([0, maxPeaksMZ])
                .range([0, containerWidth]);

            var heightScale = d3.scale.linear()
                .domain([0, maxPeaksInt + 100*maxPeaksInt/containerHeight])
                .range([0, containerHeight]);

            var xAxisScale = d3.scale.linear()
                .domain([0, maxPeaksMZ])
                .range([0, containerWidth]);

            var yAxisScale = d3.scale.linear()
                .domain([maxPeaksInt + 100*maxPeaksInt/containerHeight, 0])
                .range([0, containerHeight]);

            var clickScale = d3.scale.linear()
                .domain([0, containerWidth])
                .range([0, maxPeaksMZ]);

            var colorScale = d3.scale.linear()
                .domain([0, containerWidth])
                .range(["skyBlue", "steelblue"]);

            var drag = d3.behavior.drag()
                .on("dragstart", dragStarted)
                .on("drag", dragged)
                .on("dragend", dragEnded);

            var xAxis = d3.svg.axis()
                .scale(xAxisScale)
                .orient("bottom")
                .ticks(12)
                .tickSize(3);

            var yAxis = d3.svg.axis()
                .scale(yAxisScale)
                .orient("left")
                .ticks(12)
                .tickSize(3);

            var peakTip = d3.tip()
                .attr('class', 'd3-tip ' + tipcls("peak-tip", container, tag))
                .offset([-40, 0])
                .html(function(d) {
                    return "<span style='color: #3f3f3f' > " + toolTip(d,maxPeaksInt) + " </span>";
                });

            var peptideTip = d3.tip()
                .attr('class', 'd3-tip ' + tipcls('peptide-tip', container, tag))
                .offset([-40, 0])
                .html(function (d){
                    return "<span style='color: #f3f3f3'>" + d + "</span>";
                });



            var dePeakRenderOmatic = yAxisGroup.append("rect") // Renders a white rect under the yaxis to cover the peaks, it is really dumb, I know
                .attr("x", -margin.left)
                .attr("width", margin.left)
                .attr("height", containerHeight)
                .attr("fill",canvas.style("background-color"));

            var selectArea = selectGroup.append("rect")
                .attr("x", 0)
                .attr("y", 0)
                .attr("width", canvasWidth)
                .attr("height", canvasHeight)
                .attr("fill", "none")
                .style("pointer-events", "all")
                .on("contextmenu", function (d, i) {
                    d3.event.preventDefault();
                });



            // var menuArea = menuGroup.append("rect")
            // 	.attr("x", canvasWidth - controls.length * 80)
            // 	.attr("width", controls.length * 80)
            // 	.attr("height", 80)
            // 	.attr("rx", 10)
            // 	.attr("ry", 10)
            // 	.attr("fill", "steelblue")
            // 	.attr("opacity", 0)
            // 	.style("pointer-events", "all")
            // 	.on("mouseover", showMenu)
            // 	.on("mouseout", hideMenu);

            var menuItems = menuGroup.selectAll("image")		//all of the individual control items.
                .data(controls)
                .enter()
                .append("svg:image")
                .attr("xlink:href", function (d){ return d.path; })
                .attr("x", function (d, i){ return canvasWidth - (i + 1) * 60; })
                .attr("y", 0)
                .attr("width", 60)
                .attr("height", 60)
                .attr("opacity", .1)
                .style("pointer-events", "all")
                .on("mouseover", showMenu)
                .on("mouseout", hideMenu)
                .on("click", function (d){ d.exec(); });



            var peptides = peptideGroup.selectAll("text")
                .data(peptide)
                .enter()
                .append("text")
                .attr("x", function (d, i){ return i * peptideSpace + peptidePadding; })
                .attr("y", peptidePadding)
                .attr("font-size", peptidePixelSize)
                .text(function (d){ return d + ""})
                .each(function (d, i){
                    var mod = modifications[i];
                    if(mod != ""){		//If there is a modification to a peptide it adds a mouse event that will call a peptide-tip
                        var aa = peptide[i]
                        d3.select(this).attr("fill", colorTheme.b)
                            .on("mouseover", function (d, i){
                                peptideTip.offset([peptidePixelSize, 0]);
                                showToolTip("peptide-tip");
                                peptideTip.show(mod+aa);
                                hideToolTip("peptide-tip");
                            });
                    }
                });



            var peakElements = peakGroup.selectAll("rect")
                .data(peaks)
                .enter()
                .append("g")
                .attr("class", function (d, i){ return "peak " + i; })
                .append("rect")
                .attr("x", function (d){ return widthScale(d.mz); })
                .attr("y", containerHeight)
                .attr("width", 2)
                .attr("height", 0)
                .attr("fill", "white")
                .attr("opacity", "1")
                .on("mouseover", function (d){
                    peakTip.offset([-10, 0]);
                    showToolTip("peak-tip");
                    peakTip.show(d);
                    hideToolTip("peak-tip");
                });

            var fragmentElements = fragmentGroup.selectAll("rect")
                .data(newFragments)
                .enter()
                .append("g")
                .attr("class", function (d, i){ return "fragment " + i; })
                .append("rect")
                .attr("x", function (d){ return widthScale(d.mz); })
                .attr("y", containerHeight)
                .attr("width", 2)
                .attr("height", 0)
                .attr("fill", function (d){ return d.color; })
                .on("mouseover", function (d){
                    peakTip.offset([-23, 0]);
                    showToolTip("peak-tip");
                    peakTip.show(d);
                    hideToolTip("peak-tip");
                });

            var fragmentLabels = fragmentLabelGroup.selectAll("text")
                .data(newFragments)
                .enter()
                .append("g")
                .attr("class", "label")
                .attr("transform", function (d){
                    return "translate(" + [widthScale(d.mz), containerHeight - heightScale(d.int)] + ")";
                })
                .append("text")
                .attr("y", function (d){ return heightScale(d.int); })
                .attr("text-anchor", "middle")
                .text(function (d){ return getLabel(d);})
                .style("font-size", "17px")
                .style("opacity", "0");



            peakElements.transition()
                .duration(transitionDuration)
                .delay(transitionDelay)
                .ease(transitionType)
                .attr("y", function (d){ return (containerHeight - heightScale(d.int)); })
                .attr("height", function (d){ return heightScale(d.int); })
                .attr("fill", colorTheme.other)
                .attr("opacity", ".5");

            fragmentElements.transition()
                .duration(transitionDuration)
                .delay(transitionDelay)
                .ease(transitionType)
                .attr("y", function (d){ return containerHeight - heightScale(d.int); })
                .attr("height", function (d){ return heightScale(d.int); })
                .attr("fill", function (d){ return d.color; });

            fragmentLabels.transition()
                .duration(transitionDuration)
                .delay(transitionDelay)
                .ease(transitionType)
                .attr("y", -5)
                .style("opacity", "1");



            containerGroup.call(peakTip);
            containerGroup.call(peptideTip);
            selectGroup.call(drag);
            xAxisGroup.transition().duration(transitionDelay).call(xAxis);
            yAxisGroup.transition().duration(transitionDelay).call(yAxis);

            setTimeout(function(){resetDomain();resizeEnded(true,true);},transitionDuration+transitionDelay);

            var originalX;
            var originalY;
            var lastMouseX;
            var lastMouseY;
            var resizeWidth;
            var resizeHeight;
            var selectWidth;
            var selectHeight;

            var isLeftClick;
            var isMiddleClick;
            var isRightClick;

            var zoomDuration = 1000;

            function resetDomain(){
                var domainmax = Math.ceil((cMaxMZ[container]['_max_']+0)/100.0)*100.0;
                setDomain(0,domainmax);
            }

            function setDomain(minmz,maxmz) {
                newDomain.min = widthScale(minmz);
                newDomain.max = widthScale(maxmz);

                tooltipTransition("*", 0, 500, 0);
            }

            function dragStarted(){
                originalX = d3.mouse(this)[0];
                originalY = d3.mouse(this)[1];

                isLeftClick = d3.event.sourceEvent.which == 1;
                isMiddleClick = d3.event.sourceEvent.which == 2;
                isRightClick = d3.event.sourceEvent.which == 3;

                if(isLeftClick) resizeStarted();
                else if(isMiddleClick || isRightClick) resetDomain();
            }

            function dragged(){
                lastMouseX = d3.mouse(this)[0];
                lastMouseY = d3.mouse(this)[1];

                if(isLeftClick) resized();
            }

            function dragEnded(){
                resizeEnded();
            }

            function resizeStarted(){
                resetDomain();

                resizeGroup.append("rect")
                    .attr("x", originalX)
                    .attr("y", originalY)
                    .attr("rx", 5)
                    .attr("ry", 5)
                    .attr("width", 0)
                    .attr("height", 2)
                    .attr("stroke", "steelblue")
                    .attr("stroke-width", 3)
                    .attr("fill", "none")
                    .attr("opacity", 1);
                // .attr("stroke-dasharray", [10, 5])
            }

            function resized(){
                resizeWidth = lastMouseX - originalX;
                resizeHeight = lastMouseY - originalY;

                resizeGroup.selectAll("rect")
                    .attr("width", Math.abs(resizeWidth));
                // .attr("height", Math.abs(resizeHeight));

                if(resizeWidth < 0){
                    resizeGroup.selectAll("rect")
                        .attr("x", lastMouseX);
                    newDomain.min = (lastMouseX / scale) + domain.min;
                    newDomain.max = (originalX / scale) + domain.min;
                }else{
                    newDomain.min = (originalX / scale) + domain.min;
                    newDomain.max = (lastMouseX / scale) + domain.min;
                }

                //if(resizeHeight < 0){
                // 	resizeGroup.selectAll("rect")
                // 		.attr("y", lastMouseY);
                //}
            }

            function resizeEnded(cascade,metoo){
                if (cascade == undefined) { cascade = true; }
                if (metoo == undefined) { metoo = false; }

                // console.log(d3.select("svg").select(".group").select(".chartGroup").select(".x"));

                xAxisScale.domain([clickScale(newDomain.min), clickScale(newDomain.max)]);
                xAxisGroup.transition().duration(zoomDuration).call(xAxis);

                scale = (maxPeaksMZ) / (clickScale(newDomain.max) - clickScale(newDomain.min));

                domain.min = newDomain.min;
                domain.max = newDomain.max;

                elementGroup.transition()
                    .duration(zoomDuration)
                    .attr("transform", "translate(" + [-domain.min * scale, 0] + ")scale(" + [scale, 1] + ")")
                    .selectAll("rect")
                    .attr("width", 2 / scale)
                    .each("end", function(){ tooltipTransition("*", 0, 500, 0); });

                fragmentLabelGroup.selectAll("text").attr("transform", "scale(" + [1 / scale, 1] + ")");

                if (cascade) {
                    cTags[container].forEach(function (item,index,array) {
                        if (item != tag || metoo) {
                            cCallbacks[container][item](clickScale(newDomain.min),clickScale(newDomain.max));
                        }
                    });
                }

                resizeGroup.selectAll("rect")
                    .transition()
                    .duration(zoomDuration)
                    .attr("x", 0)
                    .attr("width", containerWidth)
                    .attr("opacity", 0)
                    .remove();

                // resizeGroup.selectAll("rect")
                // 	.remove();

                tooltipTransition("*", 0, 500, 0);
            }

            function showMenu(){
                menuItems
                    .transition()
                    .duration(500)
                    .attr("opacity", 1);

            }

            function hideMenu(){
                menuItems
                    .transition()
                    .duration(500)
                    .attr("opacity", 0);
            }

            cCallbacks[container][tag] = (function (a,b) {setDomain(a,b); resizeEnded(false,false);});

        <!-- peptide symbol rendering

            function drawSymbole(fragment, i){	<!-- TODO REDO

                if(fragment.type == "b-ion"){
                    var startX = peptideSpace * (fragment.subscript - 1) + peptidePadding;
                    var startY = peptidePadding + 3;

                    peptideGroup.append("rect")
                        .attr("x", startX + 1)
                        .attr("y", startY)
                        .attr("width", peptidePixelSize / 2 + 2)
                        .attr("height", 4)
                        .attr("fill", fragment.color);

                    peptideGroup.append("line")
                        .attr("x1", startX + peptidePixelSize / 2)
                        .attr("y1", startY + 3)
                        .attr("x2", startX + (peptidePixelSize / 4) + (peptideSpace / 2))//
                        .attr("y2", startY - (peptidePixelSize / 4) - 3)
                        .attr("stroke", fragment.color)
                        .attr("stroke-width", 5);
                }
                else if(fragment.type == "y-ion"){

                    var startX = peptideSpace * (peptide.length - fragment.subscript) + peptidePadding;
                    var startY = peptidePadding - (peptidePixelSize) + 9;

                    peptideGroup.append("rect")
                        .attr("x", startX - 1)
                        .attr("y", startY + 1)
                        .attr("width", peptidePixelSize / 2 + 2)
                        .attr("height", 4)
                        .attr("fill", fragment.color);

                    peptideGroup.append("line")
                        .attr("x1", startX)
                        .attr("y1", startY + 3)
                        .attr("x2", startX - (peptideSpace / 4))//
                        .attr("y2", startY + (peptidePixelSize / 2) + 1)
                        .attr("stroke", fragment.color)
                        .attr("stroke-width", 5);
                }
            }



            function appendFragments(fragment, i){

                var hasFoundPeak = false;
                var bestPeak = {"int": 0, "mz": 0};

                for(var i = 0; i < peaks.length; i++){
                    var peak = peaks[i];

                    if(Math.abs(fragment.mz - peak.mz) <= tolerance){
                        if(peak.int >= bestPeak.int){
                            bestPeak = peak;
                        }
                        hasFoundPeak = true;
                    }
                }

                if (hasFoundPeak && isAboveThreshHold(bestPeak.int) && !usedPeak[bestPeak.mz]){

                    usedPeak[bestPeak.mz] = true;

                    fragment.delta = (bestPeak.mz - fragment.mz)
                    // for positioning...
                    fragment.mz = bestPeak.mz;
                    fragment.int = bestPeak.int;

                    if(fragment.type == "b-ion"){
                        fragment.color = colorTheme.b;
                    }
                    else if(fragment.type == "y-ion"){
                        fragment.color = colorTheme.y;
                    }

                    newFragments.push(fragment);

                }
            }

            function isAboveThreshHold(height){
                return maxPeaksInt * baseHeightPercent <= height;
            }


            function showToolTip(type){
                selectToolTip(type).transition()
                    .delay(0)
                    .duration(0)
                    .style("opacity", 1)
                    .style('pointer-events', 'all')
            }

            function hideToolTip(type){
                selectToolTip(type)
                    .on("mouseover", function (){
                        selectToolTip(type).transition()
                            .delay(0);

                    })
                    .on("mouseout", function (){
                        tooltipTransition(type, 0, 500, 0);
                    });

                tooltipTransition(type, 1500, 500, 0);
            }

            function tooltipTransition(type, delay, duration, opacity){
                selectToolTip(type).transition()
                    .delay(delay)
                    .duration(duration)
                    .style("opacity", opacity)
                    .style('pointer-events', 'none');
            }

            function selectToolTip(type){
                if(type == "*") return d3.selectAll(".d3-tip");	//selectAll tool tip feature, out of lazyness :p

                return d3.selectAll("." + type + ".tip-" + spcls(container, tag));	//Selections only work with a periode in the middle
            }

        });

    }

    var superScript = "⁰¹²³⁴⁵⁶⁷⁸⁹";
    var subscripts = "₀₁₂₃₄₅₆₇₈₉";

    function getSuperscript(num){
        num += "";
        var newSuperScript = "";

        for(var i = 0; i < num.length; i++){
            newSuperScript += superScript[parseInt(num[i])];
        }

        return newSuperScript;
    }

    function getSubscript(num){
        num += "";
        var newSubScripts = "";

        for(var i = 0; i < num.length; i++){
            newSubScripts += subscripts[parseInt(num[i])];
        }
        return newSubScripts;
    }

    function getLabel(d) {
        if ((d.type == 'y-ion') || (d.type == 'b-ion')) {
            if (d.z == 1) {
                return (d.label + getSubscript(d.subscript));
            } else {
                return (d.label + getSubscript(d.subscript) + getSuperscript(d.z) + '\u207A');
                // return d.simplelabel;
            }
        } else {
            return d.simplelabel;
        }
    }

    function toolTip(d,bp) {
        var tt = roundWidthZeros(d.mz);
        tt = tt + ", " + Math.floor(100*d.int/bp)+"%"
        if (d.delta == undefined) {
            // peak, not fragment
            return tt;
        }

        if( d.delta >= 0) {
            tt += (" (+" + roundWidthZeros(Math.abs(d.delta)) + ")");
        } else {
            tt += (" (-" + roundWidthZeros(Math.abs(d.delta)) + ")");
        }

        return tt;
    }

    function roundWidthZeros(num){
        num = Math.round(num * 100) / 100;
        if (num == 0) {
            return "0.00";
        }
        if((num + "").split(".")[1].length <= 1) num += "0"; // adds a zero if the length of the str after the . is less than 2

        return num;
    }

    function clearSpectrum(container,tag){
        d3.selectAll("." + spcls(container,tag)).selectAll(".group").remove();
        d3.selectAll(".tip-" + spcls(container, tag)).remove();
    }

    function deleteSpectrum(container,tag){
        d3.selectAll("." + spcls(container,tag)).remove();
        d3.selectAll(".tip-" + spcls(container,tag)).remove();
        for (var i=cTags[container];i--;) {
            if (cTags[container][i] == tag) {
                cTags[container].splice(i,1);
            }
        }
        cMaxMZ[container]['_max_'] = 0.0;
        cTags[container].forEach(function (item,index,array) {
            if (cMaxMZ[container]['_max_'] < cMaxMZ[container][item]) {
                cMaxMZ[container]['_max_'] = cMaxMZ[container][item];
            }
        });
    }

    function addTitles(container, titles, collapseAfter){
        var containerEle = document.getElementsByClassName(container)[0];

        for (var i in containerEle.childNodes){

            if (containerEle.childNodes[2*i].tagName != "svg") {
                continue
            }
            if (!(i in titles)){
                continue
            }

            i = parseInt(i);

            var titleEle = document.createElement("h2");
            titleEle.innerHTML = titles[i];

            titleEle.setAttribute("data-index",i);
            titleEle.addEventListener("click", function () {
                var index = this.getAttribute("data-index");
                index = parseInt(index);
                var displayBool = this.getAttribute("data-display");

                if (displayBool == "true"){
                    containerEle.childNodes[index*2+1].setAttribute("style","display: none");
                    this.setAttribute("data-display","false");
                }
                else {
                    containerEle.childNodes[index*2+1].setAttribute("style","display: inline");
                    this.setAttribute("data-display","true");
                }
            });

            if (collapseAfter != undefined){
                if (i >= collapseAfter){
                    titleEle.setAttribute("data-display","false");
                    containerEle.childNodes[2*i].setAttribute("style","display: none")
                }
                else{
                    titleEle.setAttribute("data-display","true");
                    containerEle.childNodes[2*i].setAttribute("style","display: inline")
                }
            }

            containerEle.insertBefore(titleEle, containerEle.childNodes[2*i]);
        }


    }

    return {
        spcls: spcls,

        tipcls: tipcls,

        appendSpectrum: appendSpectrum,

        showUnlabelledSpectrum: showUnlabelledSpectrum,

        showSpectrum: showSpectrum,

        getSuperscript: getSuperscript,

        getSubscript: getSubscript,

        getLabel: getLabel,

        toolTip: toolTip,

        roundWidthZeros: roundWidthZeros,

        clearSpectrum: clearSpectrum,

        deleteSpectrum: deleteSpectrum,

        addTitles: addTitles

    }

}();