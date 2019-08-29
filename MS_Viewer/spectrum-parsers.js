var cache = {};
var callbacks = [];

var textGetter = function () {
    var status = {};
    var cache = {};
    var callbacks = {};

    function getText(url, callback) {

        if (!Object.keys(status).includes(url)){
            status[url] = false;
            callbacks[url] = [callback];
            d3.text(url, function (d) {
                status[url] = true;
                cache[url] = d;

                for (var cb of callbacks[url]){
                    cb(cache[url]);
                }
            })
        }
        else if (status[url] == false){
            callbacks[url].push(callback);
        }else{
            callback(cache[url])
        }
    }

    return {
        getText: getText
    }
}();

function getSpectrum(url, format, scan, callback) {

    if ((format && format.toLowerCase() == "mgf") || /\.mgf$/i.test(url)) {
        textGetter.getText(url, function (data) {
            cache[url] = mgfparser(data);
            callback(cache[url][scan]);
            for (var i = 0, len = callbacks.length; i < len; i++) {
                callbacks[i][1](cache[url][callbacks[i][0]]);
            }
        });
    }

    else if ((format && format.toLowerCase() == "json") || /\.json$/i.test(url)) {
        textGetter.getText(url, function (data) {
            cache[url] = jsonparser(data);

            if (Object.keys(cache[url]).length == 1){
                callback(cache[url][Object.keys(cache[url])[0]]);
            }
            else{
                callback(cache[url][scan]);
            }

            for (var i = 0, len = callbacks.length; i < len; i++) {
                callbacks[i][1](cache[url][callbacks[i][0]]);
            }
        });
    }

}


function getSpectrumOld(url, format, scan, callback) {

    if (url in cache) {
        if (cache[url] === undefined) {
            callbacks.push([scan, callback]);
        } else {
            callback(cache[url][scan]);
        }
    } else {
        cache[url] = undefined;
        if ((format && format.toLowerCase() == "mgf") || /\.mgf$/i.test(url)) {
            d3.text(url, function (data) {
                cache[url] = mgfparser(data);
                callback(cache[url][scan]);
                for (var i = 0, len = callbacks.length; i < len; i++) {
                    callbacks[i][1](cache[url][callbacks[i][0]]);
                }
            });
        } else if ((format && format.toLowerCase() == "json") || /\.json$/i.test(url)) {
            d3.text(url, function (data) {
                cache[url] = jsonparser(data);
                
                if (Object.keys(cache[url]).length == 1){
                    callback(cache[url][Object.keys(cache[url])[0]]);
                }
                else{
                    callback(cache[url][scan]);
                }
                
                for (var i = 0, len = callbacks.length; i < len; i++) {
                    callbacks[i][1](cache[url][callbacks[i][0]]);
                }
            });
        }
    }
}

function jsonparser(data) {
    var obj = JSON.parse(data);
    var spectra = {};
    if (obj.hasOwnProperty('spectra')) {
        obj["spectra"].forEach(function (s) {
            var spec = jsonspectrum(s);
            spectra[spec.scan] = spec;
        });
    } else {
        var spec = jsonspectrum(obj);
        spectra[spec.scan] = spec;
    }
    return spectra;
}

function jsonspectrum(s) {
    var spec = {};
    for (var k in s) {
        spec[k] = s[k];
    }
    return spec;
}

function mgfparser(data) {
    var spectra = {};
    var index = 1;
    var inspectrum = false;
    var lines = data.match(/[^\r\n]+/g);
    for (var i = 0, len = lines.length; i < len; i++) {
        l = lines[i].trim();
        if (inspectrum) {
            if (l == "END IONS") {
                inspectrum = false;
                spec = normalizemgfspec(spec);
                spectra[spec["scan"]] = spec;
            } else if (/^[A-Za-z0-9]+=/.test(l)) {
                var sl = l.split('=');
                spec[sl[0].trim()] = sl[1].trim();
            } else {
                var mzint = l.match(/\S+/g);
                spec["mz"].push(+mzint[0]);
                spec["it"].push(+mzint[1]);
            }
        } else {
            if (l == "BEGIN IONS") {
                inspectrum = true;
                var spec = {};
                spec["mz"] = [];
                spec["it"] = [];
                spec["index"] = index;
                index += 1;
            }
        }
    }
    return spectra;
}

function normalizemgfspec(spec) {
    var pint = null;
    var charge = null;
    if ("CHARGE" in spec) {
        var charge = parseInt(spec["CHARGE"]);
    }
    var pmz = spec["PEPMASS"].match(/\S+/g);
    if (pmz.length > 1) {
        pint = parseFloat(pmz[1]);
    }
    pmz = parseFloat(pmz[0]);
    spec["precursorMz"] = pmz;
    if (charge) {
        spec["precursorCharge"] = charge;
    }
    if (pint) {
        spec["precursorIntensity"] = pint;
    }
    if ("RTINSECONDS" in spec) {
        spec["rentionTime"] = 60 * parseFloat(spec["RTINSECONDS"]);
    }
    spec["msLevel"] = 2;
    var title = spec["TITLE"];
    if (/\.\d+\.\d+\.\d(\.dta)?\s*$/i.test(title)) {
        // ends in a dta-filename-like string...
        var parts = title.split('.');
        startscan = parseInt(parts[parts.length - 3]);
        endscan = parseInt(parts[parts.length - 2]);
        if (startscan == endscan) {
            spec["startscan"] = startscan;
            spec["endscan"] = endscan;
            spec["scan"] = startscan;
        } else {
            spec["startscan"] = startscan;
            spec["endscan"] = endscan;
            spec["scan"] = [startscan, endscan];
        }
    } else if (/^Scan(\s+Number:?)?\s+\d+(-\d+)?\s*$/i.test(title)) {
        var words = title.match(/\S+/g);
        var scans = words[words.length - 1].match(/\d+/g);
        if (scans.length == 2) {
            startscan = parseInt(scans[0]);
            endscan = parseInt(scans[1]);
        } else {
            startscan = parseInt(scans[0]);
            endscan = parseInt(scans[0]);
        }
        if (startscan == endscan) {
            spec["startscan"] = startscan;
            spec["endscan"] = endscan;
            spec["scan"] = startscan;
        } else {
            spec["startscan"] = startscan;
            spec["endscan"] = endscan;
            spec["scan"] = [startscan, endscan];
        }
    }
    return spec
}

function mzmlparser(data) {
    //
}
