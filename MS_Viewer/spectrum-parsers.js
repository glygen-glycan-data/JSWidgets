"use strict";

var spectrum_parser = function () {
    var cache = {};
    var cacheText = {};
    var callbacks = {};


    // return a Promise object anyway
    function getText(url) {

        if (!Object.keys(cacheText).includes(url)){
            var t = d3.text(url);
            cacheText[url] = t;
            return t
        }else{
            return cacheText[url]
        }
    }

    function getSpectrum(url, format, scan, callback) {
        // How to deal with MGF format spectra

        /*
        if ((format && format.toLowerCase() == "mgf") || /\.mgf$/i.test(url)) {
            getText(url).then( function (data) {
                cache[url] = mgfparser(data);
                callback(cache[url][scan]);
                for (var i = 0, len = callbacks.length; i < len; i++) {
                    callbacks[i][1](cache[url][callbacks[i][0]]);
                }
            });
        }
        else if ((format && format.toLowerCase() == "json") || /\.json$/i.test(url)) {
            getText(url).then(function (data) {
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

         */

    }

    function getSpectrumJSON(url, scan) {
        return new Promise(resolve => {
            getText(url).then(function (data) {
                resolve(JSON.parse(data));
            });
        })

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

        var l;
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

        var startscan, endscan;
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

    function getFragmentAnnotation(url) {
        return new Promise(resolve => {
            getText(url).then(function (d) {
                resolve(JSON.parse(d));
            });
        });

    }

    return {
        getText: getText,
        getSpectrum: getSpectrum,
        getFragmentAnnotation: getFragmentAnnotation,
        getSpectrumJSON: getSpectrumJSON
    }
}();


