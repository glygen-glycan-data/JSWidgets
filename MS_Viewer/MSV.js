"use strict";

var msv = function () {

    // Basic support functions
    function spcls(container, tag) {
        return (container + '-' + tag);
    }

    function tipcls(type, container, tag) {
        return type + " tip-" + spcls(container, tag);
    }

    var superScript = "⁰¹²³⁴⁵⁶⁷⁸⁹";
    var subscripts = "₀₁₂₃₄₅₆₇₈₉";

    function getSuperscript(num) {
        num += "";
        var newSuperScript = "";

        for (var i = 0; i < num.length; i++) {
            newSuperScript += superScript[parseInt(num[i])];
        }

        return newSuperScript;
    }

    function getSubscript(num) {
        num += "";
        var newSubScripts = "";

        for (var i = 0; i < num.length; i++) {
            newSubScripts += subscripts[parseInt(num[i])];
        }
        return newSubScripts;
    }

    function getLabel(d) {
        if (d.label != undefined) {
            if (d.z > 1) {
                if (d.subscript != undefined) {
                    return (d.label + getSubscript(d.subscript) + getSuperscript(d.z) + '\u207A');
                } else {
                    return (d.label + getSuperscript(d.z) + '\u207A');
                }
            } else {
                if (d.subscript != undefined) {
                    return (d.label + getSubscript(d.subscript));
                } else {
                    return d.label;
                }
            }
        } else {
            return d.simplelabel;
        }
    }

    function toolTip(d, bp) {
        var tt = roundWidthZeros(d.mz);
        tt = tt + ", " + Math.floor(100 * d.int / bp) + "%";
        if (d.delta == undefined) {
            // peak, not fragment
            return tt;
        }

        if (d.delta >= 0) {
            tt += (" (+" + roundWidthZeros(Math.abs(d.delta)) + ")");
        } else {
            tt += (" (-" + roundWidthZeros(Math.abs(d.delta)) + ")");
        }

        return tt;
    }

    function roundWidthZeros(num) {
        num = Math.round(num * 100) / 100;
        if (num == 0) {
            return "0.00";
        }
        if ((num + "").split(".")[1].length <= 1) num += "0"; // adds a zero if the length of the str after the . is less than 2

        return num;
    }

    // Global Variables in this scoop
    var cTags = {};
    var cDims = {};
    var cMaxMZ = {};
    var cCallbacks = {};
    
    // Get info
    var centralControl = function () {

        var panels = [];

        var initializationStatus = {};
        var initializationFunction = {};

        var resizeFunction = {};

        var showBools = {};

        var zoomingGroup = {};
        var zoomongGroupStatus = {};
        var zoomongGroupStatusExample = {
            "start": 0,
            "end": 200,
            "max": 205
        };

        var drawingStatus = {};


        function addInit(id, initBool, initFunc, zgid) {
            panels.push(id);
            initializationStatus[id] = initBool;
            initializationFunction[id] = initFunc;

            if (initBool){
                initFunc();
            }else{
                hide(id);
            }
            zoomingGroup[id] = zgid;

            showBools[id] = initBool;
        }

        function addResizeFunc(id, resizeFunc) {
            resizeFunction[id] = resizeFunc;
        }

        function resizeAll(id, a, b) {
            resize(id, a, b);
            if (!Object.keys(zoomingGroup).includes(id)){
                return undefined
            }

            var thisZoomingGroupID = zoomingGroup[id];
            zoomongGroupStatus[thisZoomingGroupID] = {
                "start": a,
                "end": b
            };

            for (var otherid of Object.keys(zoomingGroup)){
                if (zoomingGroup[otherid] == thisZoomingGroupID && otherid != id ){
                    if (showBools[otherid]){
                        resize(otherid, a,b);
                    }
                }
            }
        }

        function resize(id, a,b) {
            resizeFunction[id](a, b);
        }

        function titleClickEvent(id) {

            if (!initializationStatus[id]){
                initializationFunction[id]();
                initializationStatus[id]= true;

                var container = id2location(id)["container"];
                var tag = id2location(id)["tag"];

                d3.select("svg."+spcls(container, tag))
                    .style("display", "inline");
                showBools[id] = true;
            }
            else{
                showAndHide(id);
            }

        }

        function showAndHide(id) {

            if (showBools[id]){
                hide(id);
            }
            else{
                show(id);
            }

        }

        function buildID(container, tag) {
            return container + "/" + tag
        }

        function id2location(id) {
            var temp = id.split("/");
            return {
                "container": temp[0],
                "tag": temp[1]
            }
        }

        var doneBool = false;
        function done() {
            doneBool = true;
            tryResetAll();
        }
        function drawingFinished(id) {
            drawingStatus[id] = true;
            tryResetAll();
        }
        function tryResetAll() {
            if (!doneBool){
                return
            }

            var t1 = [];
            for (var t2 of Object.keys(initializationStatus)){
                if(initializationStatus[t2]){
                    t1.push(t2);
                }
            }
            if (t1.length != Object.keys(drawingStatus).length){
                return
            }

            resetAllFirst();

        }

        function show(id) {
            var container = id2location(id)["container"];
            var tag = id2location(id)["tag"];

            d3.select("svg."+spcls(container, tag))
                .style("display", "inline");
            showBools[id] = true;

            zoomToCurrent(id);
        }

        function hide(id) {
            var container = id2location(id)["container"];
            var tag = id2location(id)["tag"];

            d3.select("svg#"+spcls(container, tag))
                .style("display", "none");
            showBools[id] = false;
        }

        function zoomToCurrent(id) {
            var zoomingGroupID = zoomingGroup[id];
            if (zoomingGroupID){
                if (zoomongGroupStatus[zoomingGroupID]) {
                    resize(id, zoomongGroupStatus[zoomingGroupID]["start"], zoomongGroupStatus[zoomingGroupID]["end"])
                }else{
                    reset(id);
                    resetAll(id);
                }
            }
        }

        function reset(id) {
            var maxMZ = 0;

            var zoomingGroupID = zoomingGroup[id];
            if (zoomingGroupID){
                for (var idt of Object.keys(zoomingGroup)){
                    if (zoomingGroup[idt] == zoomingGroupID){
                        var container = id2location(idt)["container"];
                        var tag = id2location(idt)["tag"];
                        var thismz = cMaxMZ[container][tag];
                        if (thismz > maxMZ){
                            maxMZ = thismz;
                        }
                    }
                }
                resize(id, 0, maxMZ);
            }
            else{
                var container = id2location(id)["container"];
                var tag = id2location(id)["tag"];
                var thismz = cMaxMZ[container][tag];
                resize(id, 0, thismz);
            }
        }

        function resetGroup(id) {
            var maxMZ = 0;

            var zoomingGroupID = zoomingGroup[id];
            if (zoomingGroupID){
                for (var idt of Object.keys(zoomingGroup)){
                    if (zoomingGroup[idt] == zoomingGroupID){
                        var container = id2location(idt)["container"];
                        var tag = id2location(idt)["tag"];
                        var thismz = cMaxMZ[container][tag];
                        if (thismz > maxMZ){
                            maxMZ = thismz;
                        }
                    }
                }
                resizeAll(id, 0, maxMZ);
            }
        }

        function resetAllFirst() {
            for (var id of Object.keys(drawingStatus)){
                reset(id);
            }
        }

        function resetAll() {
            for (var id of Object.keys(initializationStatus)){
                if (initializationStatus[id]){
                    reset(id);
                }
            }
        }


        return {
            addInit: addInit,
            addResizeFunc: addResizeFunc,
            titleClickEvent: titleClickEvent,
            showAndHide: showAndHide,
            buildID: buildID,
            drawingFinished: drawingFinished,
            show: show,
            hide: hide,
            resize: resize,
            resizeAll: resizeAll,
            zoomToCurrent: zoomToCurrent,
            reset: reset,
            resetGroup: resetGroup,
            resetAll: resetAll,
            done: done
        }
    }();

    var colorTheme = {
        b: "steelBlue", y: "tomato",
        c: "steelBlue", z: "tomato",
        B: "steelBlue", Y: "tomato",
        M: "black",
        other: "grey",
        auc: "lightgrey"
    };


    // Computing functions
    function peakClusterRecognition(peaks){
        var peakCluster = {};

        var peakscopy = JSON.parse(JSON.stringify(peaks)).sort(function(a, b){
            return a.mz - b.mz
        });


        for (var potentialChargeStatus of [1,2,3,4,5,6]) {
            // console.log(potentialChargeStatus);
            peakCluster[potentialChargeStatus] = [];
            for (var peak1 of peakscopy){

                var perCluster = {0:[peak1]};

                for (var peak2 of peakscopy){
                    if (peak1.mz >= peak2.mz){
                        continue
                    }
                    if (peak2.mz - peak1.mz - 0.1 > (1/potentialChargeStatus)*(Math.round(potentialChargeStatus * peak1.mz / 1000) + 3)){
                        continue
                    }

                    var potentialNthPeakInsideCluster = (peak2.mz - peak1.mz) * potentialChargeStatus;
                    if (Math.abs(potentialNthPeakInsideCluster - Math.round(potentialNthPeakInsideCluster)) < 0.04 * potentialChargeStatus){
                        potentialNthPeakInsideCluster = Math.round(potentialNthPeakInsideCluster);
                    }
                    else{
                        continue
                    }

                    if (!(potentialNthPeakInsideCluster in perCluster)){
                        perCluster[potentialNthPeakInsideCluster] = []
                    }
                    perCluster[potentialNthPeakInsideCluster].push(peak2);

                }

                // Check the legitimacy of the potential cluster
                // Only keep the perfect cluster
                var clusterVerfied = true;
                if (Object.keys(perCluster).length == 1){
                    continue
                }
                if (parseInt(Object.keys(perCluster)[Object.keys(perCluster).length-1]) != Object.keys(perCluster).length-1){
                    continue
                }
                for (var peakIndexInsideCluster in perCluster){
                    if (perCluster[peakIndexInsideCluster].length > 1 ){
                        perCluster[peakIndexInsideCluster].sort(function (a, b) {
                            return b.int - a.int
                        });
                        perCluster[peakIndexInsideCluster] = [perCluster[peakIndexInsideCluster][0]]
                    }
                }

                if (clusterVerfied){
                    // console.log(perCluster);
                    peakCluster[potentialChargeStatus].push(perCluster)
                }
            }
        }

        return peakCluster
    }

    function reduceRedundantPeaks(peaks) {
        peaks = JSON.parse(JSON.stringify(peaks));

        peaks.sort(function(a, b){
            return a.mz - b.mz
        });
        var peak0 = [{"mz": peaks[0].mz,"int": 0}];
        var peaklast = {"mz": peaks[peaks.length-1].mz,"int": 0};
        peaks = peak0.concat(peaks);
        peaks.push(peaklast);

        var peakTemp = [];
        var intZeroPeakIndexes = [];
        for (var peaki in peaks){
            if (peaks[peaki].int == 0){
                intZeroPeakIndexes.push(peaki);
            }else{
                peakTemp.push(peaks[peaki])
            }
        }

        for (var i in intZeroPeakIndexes){
            var peak = peaks[intZeroPeakIndexes[i]];
            if (i>0 && i<intZeroPeakIndexes.length-1){
                i = parseInt(i);
                var lastx = parseInt(intZeroPeakIndexes[i-1]);
                var nextx = parseInt(intZeroPeakIndexes[i+1]);
                var thisx = parseInt(intZeroPeakIndexes[i]);
                if (thisx-1 == lastx && thisx+1 == nextx){
                    continue
                }else if(thisx+1 == nextx){
                    // Start point
                    peakTemp.push(peak)
                }else if(thisx-1 == lastx){
                    // End point
                    peakTemp.push(peak)
                }

            }
            else{
                peakTemp.push(peak)
            }
        }
        peakTemp.sort(function(a, b){
            return a.mz - b.mz
        });
        return peakTemp;
    }

    function appendFragments(fragment, newFragments, peaks, usedPeak, peakClusters, colorThePeak, tolerance, maxPeaksInt, baseHeightPercent){

        var hasFoundPeak = false;
        var bestPeak = {"int": 0, "mz": 0};

        for (var i = 0; i < peaks.length; i++) {
            var peak = peaks[i];

            if (Math.abs(fragment.mz - peak.mz) <= tolerance) {
                if (peak.int >= bestPeak.int) {
                    bestPeak = peak;
                }
                hasFoundPeak = true;
            }
        }

        function isAboveThreshHold(height) {
            return maxPeaksInt * baseHeightPercent <= height;
        }

        if (hasFoundPeak && isAboveThreshHold(bestPeak.int) && !usedPeak[bestPeak.mz.toString()]) {

            usedPeak[bestPeak.mz] = true;

            fragment.delta = (bestPeak.mz - fragment.mz);
            // for positioning...
            fragment.mz = bestPeak.mz;
            fragment.int = bestPeak.int;

            if (colorTheme.hasOwnProperty(fragment.type)) {
                fragment.color = colorTheme[fragment.type];
            }



            var hasFoundCluster = false;
            var correspondingCluster;
            var maxIntForLabel = 0;
            for (var cluster of peakClusters[fragment.z]){
                if (cluster[0][0].mz == bestPeak.mz){
                    correspondingCluster = cluster;
                    hasFoundCluster = true;
                    break;
                }

            }

            if (hasFoundCluster){
                for (var p in correspondingCluster){
                    var pp = correspondingCluster[p][0];
                    usedPeak[pp.mz] = true;

                    pp = JSON.parse(JSON.stringify(pp));
                    pp.color = fragment.color;
                    if (pp.int > maxIntForLabel){
                        maxIntForLabel = pp.int;
                    }
                    if ( p != 0 ) {
                        colorThePeak.push(pp);
                    }
                }

            }

            fragment.labelInt = Math.max(fragment.int, maxIntForLabel);
            newFragments.push(fragment);
        }
    }


    // Control functions
    function appendSpectrum(container, tag, width, height) {
        if (container in cDims) {
            // Force additional spectra in a container to match width and height;
            width = cDims[container][0];
            height = cDims[container][1];
        }
        d3.select("#" + container)
            .append("div")
            .attr("id", spcls(container, tag)+"_title");
        d3.select("#" + container)
            .append("svg")
            .attr("class", spcls(container, tag))
            .attr("id", spcls(container, tag))
            .attr("width", width)
            .attr("height", height);
        if (!(container in cTags)) {
            // first reference to a specific container
            cTags[container] = [];
            cTags[container].push(tag);
            cDims[container] = ([width, height]);
            cMaxMZ[container] = {'_max_': 0.0};
            cCallbacks[container] = {}
        } else {
            cTags[container].push(tag);
        }
    }

    function clearSpectrum(container, tag) {
        d3.selectAll("#" + spcls(container, tag)).selectAll("#group").remove();
        d3.selectAll("#tip-" + spcls(container, tag)).remove();
    }

    function deleteSpectrum(container, tag) {
        d3.selectAll("#" + spcls(container, tag)).remove();
        d3.selectAll("#tip-" + spcls(container, tag)).remove();
        for (var i = cTags[container]; i--;) {
            if (cTags[container][i] == tag) {
                cTags[container].splice(i, 1);
            }
        }
        cMaxMZ[container]['_max_'] = 0.0;
        cTags[container].forEach(function (item, index, array) {
            if (cMaxMZ[container]['_max_'] < cMaxMZ[container][item]) {
                cMaxMZ[container]['_max_'] = cMaxMZ[container][item];
            }
        });
    }

    function parameterCheck(params) {
        params["width"] = params["width"] || 1000;
        params["height"] = params["height"] || 300;

        if (params["format"] == "json" && !/\.json$/i.test(params["spectra"])) {
            params["spectra"] = params["spectra"] + "/" + params["scan"] + ".json";
        }

        params["intensity_threshold"] = params["intensity_threshold"] || 0.05;
        params["tolerance"] = params["tolerance"] || 0.1;
        if (params["fragment_colors"]){
            colorTheme = params["fragment_colors"];
        }

        if ("show" in params){
            params["show"] = params["show"]
        }
        else {
            params["show"] = true;
        }

        // let the "zoom by its own" be undefined or generating a random number for it?
        params["zoomgroup"] = params["zoomgroup"];
        params["graphtype"] = params["graphtype"]|| "ms2" ;

        if ([true, false].includes(params["zoomHeight"])){

        }
        else{
            params["zoomHeight"] = params["graphtype"] == "chromatogram";
        }

        params["title"] = params["title"] || "Unnamed Spectrum";
        params["titleTag"] = params["titleTag"] || "h2";


        return params
    }

    function addTitle(container, tag, titleContent, titleTag) {
        // Manipulate with title
        d3.select("#"+spcls(container, tag)+"_title")
            .append(titleTag)
            .html(titleContent)
            .attr("data-id", centralControl.buildID(container, tag))
            .on("click", function (d) {
                var x = d3.select(this).attr("data-id");
                centralControl.titleClickEvent(x);
            });
    }

    // Exposed API function
    function addLabelledSpectrum(container, tag, params) {

        params = parameterCheck(params);
        if (!(container in cTags) || cTags[container].indexOf(tag) < 0) {
            var width = params["width"];
            var height = params["height"];
            appendSpectrum(container, tag, width, height);
        }
        clearSpectrum(container, tag);

        addTitle(container, tag, params["title"], params["titleTag"]);

        function drawWrapper() {
            showLabelledSpectrum(container, tag, params);
        }

        centralControl.addInit(centralControl.buildID(container, tag), params["show"], drawWrapper, params["zoomgroup"]);
    }

    // Getting data
    async function showLabelledSpectrum(container, tag, params) {


        var spectra = params["spectra"];
        var format = params["format"];
        var scan = params["scan"];

        var annotation_data = undefined;
        if (params.hasOwnProperty("annotations")) {
            annotation_data = await spectrum_parser.getFragmentAnnotation(params["annotations"]);
        }
        var spectra_data = await spectrum_parser.getSpectrumJSON(spectra);

        showLabelledSpectrumPart2(container, tag, spectra_data, annotation_data, params)

    }

    // Raw data is ready, process data and draw
    function showLabelledSpectrumPart2(container, tag, spectrum, annotation_data, params) {

        var baseHeightPercent = params["intensity_threshold"];
        var tolerance = params["tolerance"];

        var displayFlag = params["show"];
        var graphType = params["graphtype"];
        var zoomHeight = params["zoomHeight"];

        var eachLineTmp = {"dots": [], "max": 0, sortValue: 1000};

        var peaks = [];
        var chromatogram_peaks = [];
        if (graphType == "chromatogram") {
            var eachLine = JSON.parse(JSON.stringify(eachLineTmp));
            for (var i in spectrum.peaks) {
                i = parseInt(i);
                peaks.push({mz: spectrum.peaks[i].rt, int: spectrum.peaks[i].int});
                eachLine.dots.push({mz: spectrum.peaks[i].rt, int: spectrum.peaks[i].int});
                //if (spectrum.peaks[i].int > eachLine.max){
                //    eachLine.max = spectrum.peaks[i].int;
                //}
            }
            chromatogram_peaks.push(eachLine);
            // peaks = spectrum.peaks;
        } else if (graphType == "multi-chromatogram") {
            for (var sp of spectrum.series) {
                var eachLine = JSON.parse(JSON.stringify(eachLineTmp));
                eachLine.sortValue = sp.obs_relint;
                for (var p of sp.pairs) {
                    peaks.push({mz: p[0], int: p[1]});
                    eachLine.dots.push({mz: p[0], int: p[1]});
                    //if (p[1] > eachLine.max){
                    //    eachLine.max = p[1];
                    //}
                }
                chromatogram_peaks.push(eachLine);
            }
        } else if(spectrum.hasOwnProperty('peaks')){
            peaks = spectrum.peaks;
        }else{
            peaks = [];
            for (var i = 0, len = spectrum.mz.length; i < len; i++) {
                peaks.push({mz: spectrum.mz[i], int: spectrum.int[i]});
            }
        }

        var fragments = [];
        if (annotation_data != null) {
            var fragMode = spectrum["fragmentationMode"] || "CID";
            var fragTypes = annotation_data["fragmode2fragtype"][fragMode];
            for (var i = 0; i < fragTypes.length; i++) {
                var frags = annotation_data["byfragtype"][fragTypes.charAt(i)];
                fragments = fragments.concat(frags);
            }
        }

        var newFragments = [];
        var colorThePeak = [];
        var newLinesForEachMatedCluster = [];
        var usedPeak = {};

        var peakClusters = {};
        if(annotation_data){
            peakClusters = peakClusterRecognition(peaks);
        }

        var maxPeaksInt = d3.max(peaks, function (d) {
            return d.int;
        });
        var maxPeaksMZ = d3.max(peaks, function (d) {
            return d.mz;
        });

        cMaxMZ[container][tag] = maxPeaksMZ;
        cMaxMZ[container]['_max_'] = 0.0;
        cTags[container].forEach(function (item, index, array) {
            if (cMaxMZ[container]['_max_'] < cMaxMZ[container][item]) {
                cMaxMZ[container]['_max_'] = cMaxMZ[container][item];
            }
        });

        // Get rid off continuous peak with 0 intensity
        if (graphType == "chromatogram"){
            //peaks = reduceRedundantPeaks(peaks);
        }

        if (graphType.includes("chromatogram")){
            var tmp_c = [];
            var i = 0;
            for (var line of chromatogram_peaks.sort(function (a,b) {
                return b.sortValue - a.sortValue
            })){
                i+=1;
                if (i > 20){
                    break
                }
                line.dots = reduceRedundantPeaks(line.dots)
                line.colorKey = i/Math.min(10, chromatogram_peaks.length)*100; // change 10 to length of chromatogram_peaks
                line.shadingOP = 0;
                tmp_c.push(line)
            }
            chromatogram_peaks = tmp_c;
            chromatogram_peaks[chromatogram_peaks.length-1].lineColor = "grey";

            if (chromatogram_peaks.length == 1){
                chromatogram_peaks[0].lineColor = "black";
                chromatogram_peaks[0].shadingOP = 0.7;
            }
        }


        // Order of priority: mass, fragment type,
        var fragmentTypePriority = "YBMybcz";
        fragments.sort(function(a, b){

            if (Math.abs(a.mz - b.mz) > tolerance * 2){
                return a.mz - b.mz
            }

            if (a.type !== b.type){
                var i = fragmentTypePriority.indexOf(a.type);
                var j = fragmentTypePriority.indexOf(b.type);
                if (i == -1){
                    i = 1000
                }
                if (j = -1){
                    j = 1000
                }
                return i - j
            }

            if (a.z !== b.z){
                return a.z-b.z
            }

            return a.mz - b.mz

        });

        function appendFramentsWrapper(fragment){
            appendFragments(fragment, newFragments, peaks, usedPeak, peakClusters, colorThePeak, tolerance, maxPeaksInt, baseHeightPercent);
        }
        fragments.forEach(appendFramentsWrapper);

        drawStuff(container, tag, maxPeaksMZ, maxPeaksInt, peaks, chromatogram_peaks, colorThePeak, newFragments, graphType, zoomHeight, !displayFlag);
    }



    function drawStuff(container, tag, maxPeaksMZ, maxPeaksInt, peaks, chromatogram_peaks, colorThePeak, newFragments, graphType, zoomHeight, delayLoading){

        var margin = {top: 10, bottom: 20, left: 80, right: 40};

        var canvas = d3.select("svg." + spcls(container, tag));

        var canvasWidth = canvas.attr("width");
        var canvasHeight = canvas.attr("height");

        var containerWidth = canvasWidth - (margin.left + margin.right);
        var containerHeight = canvasHeight - (margin.top + margin.bottom);

        // 500 and 300 in old script
        var transitionDuration = 500;
        var transitionDelay = 300;
        var transitionType = d3.easeBounce;

        var drawingStatus = {
            "peakElements": false,
            "fragmentElements": false,
            "fragmentElementsIntheSameCluster": false,
            "fragmentLabels": false,
            "chromatographLineElements": false
        };
        function drawingFinshed(item){
            drawingStatus[item] = true;

            if (!Object.values(drawingStatus).includes(false)){
                if (delayLoading){
                    centralControl.zoomToCurrent(centralControl.buildID(container, tag))
                }else{
                    centralControl.drawingFinished(centralControl.buildID(container, tag));
                }
            }
        }

        var chromatogramPeaks = [];
        if (graphType.includes("chromatogram")) {
            chromatogramPeaks = JSON.parse(JSON.stringify(chromatogram_peaks));
            peaks = [];
        }


        var group = canvas.append("g")
            .attr("class", "group");

        var selectGroup = group.append("g")
            .attr("class", "select")
            .attr("transform", "translate(" + [margin.left, margin.top] + ")");

        var chartGroup = group.append("g")
            .attr("class", "chartGroup")
            .attr("transform", "translate(" + [margin.left, margin.top] + ")");

        var xAxisGroup = chartGroup.append("g")
            .attr("class", "x axis")
            .attr("transform", "translate(" + [0, containerHeight] + ")");

        var yAxisGroup = chartGroup.append("g")
            .attr("class", "y axis");

        var containerGroup = chartGroup.append("g")
            .attr("class", "container");

        var elementGroup = containerGroup.append("g")
            .attr("class", "elements");

        var peakGroup = elementGroup.append("g")
            .attr("class", "peaks");

        var fragmentGroup = elementGroup.append("g")
            .attr("class", "fragments");

        var fragmentOtherPeakGroup = fragmentGroup.append("g")
            .attr("class", "otherPeakGroup");

        var fragmentLabelGroup = fragmentGroup.append("g")
            .attr("class", "labelGroup");

        // fragmentLineGroup
        var chromatographLine = fragmentGroup.append("g")
            .attr("class", "lineGroup");

        var fragmentSelectedGroup = fragmentGroup.append("g")
            .attr("class", "fragementSelectedGroup");

        var resizeGroup = selectGroup.append("g")
            .attr("class", "resize");


        var domain = {min: 0, max: containerWidth};
        var newDomain = {min: 0, max: containerWidth};
        var scale = 1;

        var widthScale = d3.scaleLinear()
            .domain([0, maxPeaksMZ])
            .range([0, containerWidth]);

        var heightScale = d3.scaleLinear()
            .domain([0, maxPeaksInt + 20 * maxPeaksInt / containerHeight])
            .range([0, containerHeight]);

        var xAxisScale = d3.scaleLinear()
            .domain([0, maxPeaksMZ])
            .range([0, containerWidth]);

        var yAxisScale = d3.scaleLinear()
            .domain([maxPeaksInt + 20 * maxPeaksInt / containerHeight, 0])
            .range([0, containerHeight]);

        var clickScale = d3.scaleLinear()
            .domain([0, containerWidth])
            .range([0, maxPeaksMZ]);

        var colorScale = d3.scaleLinear()
            .domain([0, containerWidth])
            .range(["skyBlue", "steelblue"]);


        var MCColorScale = d3.scaleOrdinal()
            .domain([0, 100])
            .range(d3.schemeSet2);

        var drag = d3.drag()
            .on("start", dragStarted)
            .on("drag", dragged)
            .on("end", dragEnded);

        var peakTip = d3.tip()
            .attr('class', 'd3-tip ' + tipcls("peak-tip", container, tag))
            .offset([-40, 0])
            .html(function (d) {
                return "<span style='color: #3f3f3f' > " + toolTip(d, maxPeaksInt) + " </span>";
            });

        var dePeakRenderOmatic = yAxisGroup.append("rect")
            .attr("x", -margin.left)
            .attr("width", margin.left)
            .attr("height", containerHeight)
            .attr("fill", canvas.style("background-color"));

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

        var lineFunction = d3.line()
            .x(function (d) {
                return widthScale(d.mz);
            })
            .y(function (d) {
                return (containerHeight - heightScale(d.int));
            });

        var peakElements = peakGroup.selectAll("rect")
            .data(peaks)
            .enter()
            .append("g")
            .attr("class", function (d, i) {
                return "peak " + i;
            })
            .append("rect")
            .attr("x", function (d) {
                return widthScale(d.mz);
            })
            .attr("y", containerHeight)
            .attr("width", 2)
            .attr("height", 0)
            .attr("fill", "white")
            .attr("opacity", "1")
            .on("mouseover", function (d) {
                peakTip.offset([-10, 0]);
                showToolTip("peak-tip", container, tag);
                peakTip.show(d, this);
                hideToolTip("peak-tip", container, tag);
            });


        var fragmentElements = fragmentGroup.selectAll("rect")
            .data(newFragments)
            .enter()
            .append("g")
            .attr("class", function (d, i) {
                return "fragment " + i;
            })
            .append("rect")
            .attr("x", function (d) {
                return widthScale(d.mz);
            })
            .attr("y", containerHeight)
            .attr("width", 2)
            .attr("height", 0)
            .attr("fill", function (d) {
                return d.color;
            })
            .on("mouseover", function (d) {
                peakTip.offset([-23, 0]);
                showToolTip("peak-tip", container, tag);
                peakTip.show(d, this);
                hideToolTip("peak-tip", container, tag);
            });


        var fragmentElementsIntheSameCluster = fragmentOtherPeakGroup.selectAll("rect")
            .data(colorThePeak)
            .enter()
            .append("g")
            .attr("class", function (d, i) {
                return "fragment " + i;
            })
            .append("rect")
            .attr("x", function (d) {
                return widthScale(d.mz);
            })
            .attr("y", containerHeight)
            .attr("width", 2)
            .attr("height", 0)
            .attr("fill", function (d) {
                return d.color;
            });


        var fragmentLabels = fragmentLabelGroup.selectAll("text")
            .data(newFragments)
            .enter()
            .append("g")
            .attr("class", "label")
            .attr("transform", function (d) {
                return "translate(" + [widthScale(d.mz), containerHeight - heightScale(d.labelInt)] + ")";
            })
            .append("text")
            .attr("y", function (d) {
                return heightScale(d.int);
            })
            .attr("text-anchor", "middle")
            .text(function (d) {
                return getLabel(d);
            })
            .style("font-size", "17px")
            .style("opacity", "0");

        peakElements.transition()
            .duration(transitionDuration)
            //.delay(transitionDelay)
            .ease(transitionType)
            .attr("y", function (d) {
                return (containerHeight - heightScale(d.int));
            })
            .attr("height", function (d) {
                return heightScale(d.int);
            })
            .attr("fill", colorTheme.other)
            .attr("opacity", ".5")
            .on("end", function (d) {
                drawingFinshed("peakElements");
            });

        fragmentElements.transition()
            .duration(transitionDuration)
            //.delay(transitionDelay)
            .ease(transitionType)
            .attr("y", function (d) {
                return containerHeight - heightScale(d.int);
            })
            .attr("height", function (d) {
                return heightScale(d.int);
            })
            .attr("fill", function (d) {
                return d.color;
            })
            .on("end", function (d) {
                drawingFinshed("fragmentElements");
            });

        fragmentElementsIntheSameCluster.transition()
            .duration(transitionDuration)
            //.delay(transitionDelay)
            .ease(transitionType)
            .attr("y", function (d) {
                return containerHeight - heightScale(d.int);
            })
            .attr("height", function (d) {
                return heightScale(d.int);
            })
            .attr("fill", function (d) {
                return d.color;
            })
            .on("end", function (d) {
                drawingFinshed("fragmentElementsIntheSameCluster");
            });

        fragmentLabels.transition()
            .duration(transitionDuration)
            //.delay(transitionDelay)
            .ease(transitionType)
            .attr("y", -5)
            .style("opacity", "1")
            .on("end", function (d) {
                drawingFinshed("fragmentLabels");
            });


        var newLine = d3.line()
            .x(function (d) {
                return widthScale(d.mz)
            })
            .y(function (d) {
                return containerHeight - heightScale(d.int)
            });

        var chromatographLineElements = chromatographLine.selectAll("path")
            .data(chromatogramPeaks)
            .enter()
            .append("g")
            .append("path")
            .attr('d', function (d) {
                return newLine(d.dots)
            })
            .attr("stroke", function (d) {
                if (d.lineColor != undefined){
                    return d.lineColor
                }
                return MCColorScale(d.colorKey)
            })
            .attr("fill", colorTheme.auc)
            .attr("fill-opacity", function (d) {
                return d.shadingOP
            })
            .attr("shape-rendering", "geometricPrecision")
            .attr("vector-effect", "non-scaling-stroke")
            .attr("stroke-width", 1)
            .style("z-index","-1999");

        chromatographLineElements.transition()
            .duration(transitionDuration)
            //.delay(transitionDelay)
            .ease(transitionType)
            .style("opacity", "1")
            .on("end", function (d) {
                drawingStatus = {};
                drawingFinshed("chromatographLineElements");
            });

        var xAxis = d3.axisBottom(xAxisScale)
            .ticks(12)
            .tickSize(3);

        var yAxisLabelMax = 0;
        var yAxis = d3.axisLeft(yAxisScale)
            .ticks(Math.max(2, Math.min(6, Math.round(12 * containerHeight / 500))), "s")
            .tickFormat(function (d) {

                if (d>yAxisLabelMax){
                    yAxisLabelMax = d;
                }
                if (d == 0){
                    return ""
                }
                if (yAxisLabelMax > 1000000){
                    var temp = d.toExponential();
                    return d.toExponential();
                }
                else{
                    return d
                }
            })
            .tickSize(3);


        containerGroup.call(peakTip);
        selectGroup.call(drag);
        selectGroup.on("click", function () {
            centralControl.resetGroup(centralControl.buildID(container, tag));
            centralControl.reset(centralControl.buildID(container, tag));
        });
        xAxisGroup
            .transition()
            .duration(transitionDelay)
            .call(xAxis)
            .on("end", function () {
                this.parentElement.appendChild(this);
            });
        yAxisGroup
            .transition()
            .duration(transitionDelay)
            .call(yAxis)
            .on("end", function () {
                this.parentElement.appendChild(this);
            });

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

        function resetDomain() {
            var domainmax = Math.ceil((cMaxMZ[container]['_max_'] + 0) / 100.0) * 100.0;
            setDomain(0, domainmax);
        }

        function setDomain(minmz, maxmz) {
            newDomain.min = widthScale(minmz);
            newDomain.max = widthScale(maxmz);

            tooltipTransition("*", container, tag, 0, 500, 0);
        }

        function dragStarted() {
            originalX = d3.mouse(this)[0];
            originalY = d3.mouse(this)[1];

            isLeftClick = d3.event.sourceEvent.which == 1;
            isMiddleClick = d3.event.sourceEvent.which == 2;
            isRightClick = d3.event.sourceEvent.which == 3;

            if (isLeftClick) {
                resizeStarted()
            }
            else if (isMiddleClick || isRightClick) {
                resetDomain();
            }
        }

        function dragged() {
            lastMouseX = d3.mouse(this)[0];
            lastMouseY = d3.mouse(this)[1];

            if (isLeftClick) resized();
        }

        function dragEnded() {
            resizeEnded(true);
        }

        function resizeStarted() {
            // resetDomain();

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

        function resized() {
            resizeWidth = lastMouseX - originalX;
            resizeHeight = lastMouseY - originalY;

            resizeGroup.selectAll("rect")
                .attr("width", Math.abs(resizeWidth));
            //  .attr("height", Math.abs(resizeHeight));

            if (resizeWidth < 0) {
                resizeGroup.selectAll("rect")
                    .attr("x", lastMouseX);
                newDomain.min = (lastMouseX / scale) + domain.min;
                newDomain.max = (originalX / scale) + domain.min;
            } else if (resizeWidth > 0){
                newDomain.min = (originalX / scale) + domain.min;
                newDomain.max = (lastMouseX / scale) + domain.min;
            }

            //if(resizeHeight < 0){
            // 	resizeGroup.selectAll("rect")
            // 		.attr("y", lastMouseY);
            //}
        }

        function resizeEnded(zoomAll) {


            xAxisScale.domain([clickScale(newDomain.min), clickScale(newDomain.max)]);
            xAxisGroup.transition().duration(zoomDuration).call(xAxis);

            scale = (maxPeaksMZ) / (clickScale(newDomain.max) - clickScale(newDomain.min));

            var minMZinViewField = clickScale(newDomain.min);
            var maxMZinViewField = clickScale(newDomain.max);

            if (zoomAll){
                centralControl.resizeAll(centralControl.buildID(container, tag), minMZinViewField, maxMZinViewField)
            }

            var maxIntinViewField = 1;


            var alldotstmp = JSON.parse(JSON.stringify(peaks));
            for (var line of chromatogramPeaks){
                alldotstmp = alldotstmp.concat(line.dots);
            }
            for (var dot of alldotstmp){
                if (dot.mz >= minMZinViewField && dot.mz <= maxMZinViewField ){
                    if (dot.int > maxIntinViewField){
                        maxIntinViewField = dot.int;
                    }
                }
            }

            var scale2 = 1;
            var translateoffsetforheight = 0;
            if (zoomHeight){
                scale2 = maxPeaksInt / maxIntinViewField;
                translateoffsetforheight = -containerHeight * (scale2-1);
            }

            yAxisScale.domain([(maxPeaksInt + 20 * maxPeaksInt / containerHeight) / scale2, 0]).range([0, containerHeight]);
            yAxisGroup.transition().duration(zoomDuration).call(yAxis);


            domain.min = newDomain.min;
            domain.max = newDomain.max;

            var tempToolTipTransition = false;
            elementGroup.transition()
                .duration(zoomDuration)
                .attr("transform", "translate(" + [-domain.min * scale, 0] + ")scale(" + [scale, 1] + ")")
                .selectAll("rect")
                .attr("width", 2 / scale)
                .on("end", function () {
                    if (! tempToolTipTransition){
                        //tooltipTransition("*", container, tag, 0, 500, 0);
                        tempToolTipTransition = true;
                    }
                    //tooltipTransition("*", container, tag, 0, 500, 0);
                });


            elementGroup.transition()
                .duration(zoomDuration)
                .attr("transform", "translate(" + [-domain.min * scale, translateoffsetforheight] + ")scale(" + [scale, scale2] + ")")
                .selectAll("path")
                .on("end", function () {
                    tooltipTransition("*", container, tag, 0, 500, 0);
                });

            fragmentLabelGroup.selectAll("text").attr("transform", "scale(" + [1 / scale, 1/scale2] + ")");


            resizeGroup.selectAll("rect")
                .transition()
                .duration(zoomDuration)
                .attr("x", 0)
                .attr("width", containerWidth)
                .attr("opacity", 0)
                .remove();

            tooltipTransition("*", container, tag, 0, 500, 0);
        }

        var resizeFunc = function (a, b) {
            setDomain(a, b);
            resizeEnded(false);
        };
        centralControl.addResizeFunc(centralControl.buildID(container, tag), resizeFunc);

    }


    // Tooltip related functions
    function showToolTip(type, container, tag) {
        selectToolTip(type, container, tag).transition()
            .delay(0)
            .duration(0)
            .style("opacity", 1)
            .style('pointer-events', 'all')
    }

    function hideToolTip(type, container, tag) {
        selectToolTip(type, container, tag)
            .on("mouseover", function () {
                selectToolTip(type, container, tag).transition()
                    .delay(0);

            })
            .on("mouseout", function () {
                tooltipTransition(type, container, tag, 0, 500, 0);
            });

        tooltipTransition(type, container, tag, 1500, 500, 0);
    }

    function tooltipTransition(type, container, tag, delay, duration, opacity) {
        selectToolTip(type, container, tag).transition()
            .delay(delay)
            .duration(duration)
            .style("opacity", opacity)
            .style('pointer-events', 'none');
    }

    function selectToolTip(type, container, tag) {
        //selectAll tool tip feature, out of lazyness :p
        if (type == "*") return d3.selectAll(".d3-tip");

        //Selections only work with a periode in the middle
        return d3.selectAll("." + type + ".tip-" + spcls(container, tag));
    }

    return {
        addLabelledSpectrum: addLabelledSpectrum,
        done: centralControl.done
    }

};