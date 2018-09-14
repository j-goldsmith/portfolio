/*global
d3
_
moment
*/

var transientTector = {};

transientTector.timeParse = d3.timeParse("%Y-%m-%d %H:%M:%S");
transientTector.timeFormat = d3.timeFormat("%Y-%m-%d %H:%M");
transientTector.colors = {
    blue: [
        '#7dd0e7', '#60c2df', '#41b4d7', '#19a5cf', '#0a96be', '#0787ac', '#057899', '#036b88', '#025c76', '#024f65'
    ],
    red: [
        '#FF9D8E',
        '#FF6A53',
        '#FF3C1D',
        '#C31B01',
        '#811200'
    ],
    purple: [
        '#E8D6EC',
        '#B894BF',
        '#885692',
        '#632C6E',
        '#3F1049'
    ],
    orange: [
        '#FFC279',
        '#FFA73F',
        '#F38400',
        '#B16000',
        '#6E3C00'
    ],
    green: [
        '#DDF58B',
        '#AECB49',
        '#86A322',
        '#597203',
        '#263100'
    ],
    grey: [
        '#E1E1E1',
        '#919394',
        '#6A6C6E',
        '#46484B',
        '#16181A'
    ]
};
transientTector.dashboardStateDescription = function (directorEvents) {
    var container;
    var data;
    var dimensions = {};
    var selectedTimestamps = [];

    function draw() {
        if (!data.pca) {
            return;
        }

        var dataCount = data.pca.length;
        var minDate = data.pca[0].timestamp;
        var maxDate = data.pca[dataCount - 1].timestamp;
        var dayDiff = moment(maxDate).diff(moment(minDate), "days");

        var transientCount = data.mergedLabels ? data.mergedLabels.length : 0;
        var selectedCount = selectedTimestamps.length;

        container.select("#data-count")
            .html(dataCount + " data point" + (dataCount != 1 ? "s" : "") + " across " + dayDiff + " day" + (dayDiff != 1 ? "s" : ""));

        container.select("#transient-count")
            .html(transientCount + " labeled transient" + (transientCount != 1 ? "s" : ""));

        container.select("#selected-count")
            .html(selectedCount + " data point" + (selectedCount != 1 ? "s" : "") + " selected");

        if (selectedCount) {
            container.select(".selected-color")
                .attr("data-toggle", "modal")
                .attr("data-target", "#annotation")
                .html("<i class='fas fa-square fa-stack-2x'></i><i class='fas fa-edit fa-fw fa-stack-1x'></i>");

        }
        else {
            container.select(".selected-color")
                .attr("data-toggle", null)
                .attr("data-target", null)
                .html("<i class='fas fa-square fa-stack-2x' />");
        }

        container.select("#annotation").select(".save")
            .on("click", directorEvents.addNote)
    }

    function constructor(selection) {
        selection.each(function (d) {
            container = d3.select(this);
            data = d;
            draw();
        });
    }

    constructor.selectTimestamps = function (value) {
        if (!arguments.length) {
            return selectedTimestamps;
        }
        selectedTimestamps = value;
        draw();
        return constructor;
    };
    constructor.selectedLabelTypes = function (types) {
        if (!arguments.length) {
            return selectedLabelTypes;
        }
        selectedLabelTypes = types;
        return constructor;
    };
    constructor.dimensions = function (value) {
        if (!arguments.length) {
            return dimensions;
        }
        dimensions.width = value.width;
        dimensions.height = value.height;
        dimensions.parentWidth = value.width;
        dimensions.parentHeight = value.height;
        return constructor;
    };
    constructor.updateMergedLabels = function (value) {
        data.mergedLabels = value;
        draw();
    };
    return constructor;
};
transientTector.annotationDownload = function (directorEvents) {
    var notes = [];
    var container;
    var data;

    /* https://halistechnology.com/2015/05/28/use-javascript-to-export-your-data-as-csv/ */
    function convertArrayOfObjectsToCSV(args) {
        var result, ctr, keys, columnDelimiter, lineDelimiter, data;

        data = args.data || null;
        if (data == null || !data.length) {
            return null;
        }

        columnDelimiter = args.columnDelimiter || ',';
        lineDelimiter = args.lineDelimiter || '\n';

        keys = Object.keys(data[0]);

        result = '';
        result += keys.join(columnDelimiter);
        result += lineDelimiter;

        data.forEach(function (item) {
            ctr = 0;
            keys.forEach(function (key) {
                if (ctr > 0) result += columnDelimiter;

                result += item[key];
                ctr++;
            });
            result += lineDelimiter;
        });

        return result;
    }

    function downloadCsv() {
        var flattened_notes = _.flatten(_.map(notes, function (d) {
            return _.map(d.timestamps, function (t) {
                return {
                    psn: d.psn,
                    timestamp: transientTector.timeFormat(t),
                    label: d.label,
                    note: d.note
                };
            })
        }));

        var csv = convertArrayOfObjectsToCSV({
            data: flattened_notes
        });
        if (csv == null) return;

        var filename = 'export.csv';

        if (!csv.match(/^data:text\/csv/i)) {
            csv = 'data:text/csv;charset=utf-8,' + csv;
        }
        var encoded_data = encodeURI(csv);

        var link = document.createElement('a');
        link.setAttribute('href', encoded_data);
        link.setAttribute('download', filename);
        link.click();
    }

    function clearNotes() {
        notes = [];
        draw();
    }

    function draw() {
        var save = container.select("#save");
        var clear = container.select("#clear");

        save.on("click", downloadCsv);
        clear.on("click", clearNotes);

        var count = _.reduce(_.map(notes, function (d) {
            return d.timestamps.length;
        }), function (a, b) {
            return a + b;
        }) || 0;
        container.select("#note-stats")
            .html(count + " data points verified");
    }

    function constructor(selection) {
        selection.each(function (d) {
            container = d3.select(this);
            data = d;
            draw();
        });
    }

    constructor.dimensions = function (value) {
        return constructor;
    };
    constructor.addNote = function (value) {
        if (!arguments.length) {
            return notes;
        }
        notes.push(value);
        draw();
        return constructor;
    };
    return constructor;
};
transientTector.timePlot = function (directorEvents, dataKey) {
    "use strict";
    var dimensions = {width: 0, height: 0, parentWidth: 0, parentHeight: 0};
    var container;
    var data;
    var zoom;
    var scales = {
        xDisplayed: d3.scaleTime(),
        y: d3.scaleLinear()
    };
    var axes = {
        y: d3.axisLeft(scales.y).ticks(3)
    };
    var plotLine = d3.line()
        .x(function (d) {
            return scales.xDisplayed(d.timestamp);
        })
        .y(function (d) {
            return scales.y(d[dataKey]);
        })
        .defined(function (d) {
            return d;
        });
    var selectedTimespans = [];

    function hover(hoveredCoordinate, closestPoint) {
        container.select("line.hover")
            .attr("x1", hoveredCoordinate)
            .attr("y1", 0)
            .attr("x2", hoveredCoordinate)
            .attr("y2", dimensions.height * 0.8);

        if (closestPoint) {
            container.select("circle.hover")
                .attr("cx", scales.xDisplayed(closestPoint.timestamp))
                .attr("cy", scales.y(closestPoint[dataKey]))
                .attr("r", 2);
        }


    }

    function zoomed() {
        container.select("svg").select("path.plot-line")
            .data([data.raw])
            .attr("d", plotLine);

        var labels = container
            .select("g.transient-labels")
            .selectAll("rect.transient-label")
            .data(data.labelStreaks);

        labels.enter()
            .append("rect")
            .attr("class", "transient-label")
            .merge(labels)
            .attr("x", function (d) {
                return scales.xDisplayed(moment(d[0]).subtract(5, 'minutes'));
            })
            .attr("y", dimensions.highlightHeight)
            .attr("width", function (d) {
                var width = Math.abs(scales.xDisplayed(moment(d[1]).add(5, 'minutes')) -
                    scales.xDisplayed(moment(d[0]).subtract(5, 'minutes')));
                return width > 1 ? width : 1;
            })
            .attr("height", dimensions.yHeight);

        labels.exit().remove();

        var selectedRanges = container
            .select("g.selected-timespans")
            .selectAll("rect.timespan")
            .data(selectedTimespans);

        selectedRanges.enter()
            .append("rect")
            .attr("class", "timespan")
            .merge(selectedRanges)
            .attr("x", function (d) {
                return scales.xDisplayed(moment(d[0]).subtract(5, 'minutes'));
            })
            .attr("y", 0)
            .attr("width", function (d) {
                var width = Math.abs(scales.xDisplayed(moment(d[1]).add(5, 'minutes')) -
                    scales.xDisplayed(moment(d[0]).subtract(5, 'minutes')));
                return width > 1 ? width : 1;
            })
            .attr("height", dimensions.plotHeight);

        selectedRanges.exit().remove();
    }

    function drawLabels() {
        var labels = container
            .select("g.transient-labels")
            .selectAll("rect.transient-label")
            .data(data.labelStreaks);

        labels.enter()
            .append("rect")
            .attr("class", "transient-label")
            .merge(labels)
            .attr("x", function (d) {
                return scales.xDisplayed(moment(d[0]).subtract(5, 'minutes'));
            })
            .attr("y", dimensions.highlightHeight)
            .attr("width", function (d) {
                var width = Math.abs(scales.xDisplayed(moment(d[1]).add(5, 'minutes')) -
                    scales.xDisplayed(moment(d[0]).subtract(5, 'minutes')));
                return width > 1 ? width : 1;
            })
            .attr("height", dimensions.yHeight);

        labels.exit().remove();
    }

    function draw() {
        if (!data) {
            return;
        }
        var yExtent = d3.extent(data.raw, function (d) {
            return d[dataKey];
        });
        scales.y.range([dimensions.plotHeight - dimensions.highlightHeight, dimensions.highlightHeight])
            .domain(yExtent);

        container.select("svg").select('rect.timeline-hover')
            .attr('width', dimensions.width)
            .attr('height', dimensions.plotHeight);
        //.call(zoom);

        container.select("svg")
            .attr("width", dimensions.width)
            .attr("height", dimensions.plotHeight);

        container.select("h5")
            .text(dataKey);

        container.select("svg").select("path.plot-line")
            .data([data.raw])
            .attr("d", simplify(plotLine, .5));

        var now = moment();
        var pointWidth = scales.xDisplayed(now) - scales.xDisplayed(now.subtract(10, 'minutes'));
        pointWidth = pointWidth > 1 ? pointWidth : 1;

        drawLabels();

        var selectedRanges = container
            .select("g.selected-timespans")
            .selectAll("rect.timespan")
            .data(selectedTimespans);

        selectedRanges.enter()
            .append("rect")
            .attr("class", "timespan")
            .merge(selectedRanges)
            .attr("x", function (d) {
                return scales.xDisplayed(moment(d[0]).subtract(5, 'minutes'));
            })
            .attr("y", 0)
            .attr("width", function (d) {
                var width = Math.abs(scales.xDisplayed(moment(d[1]).add(5, 'minutes')) -
                    scales.xDisplayed(moment(d[0]).subtract(5, 'minutes')));
                return width > 1 ? width : 1;
            })
            .attr("height", dimensions.plotHeight);

        selectedRanges.exit().remove();

        container.select("g.yaxis")
            .attr("transform", "translate(" + (dimensions.width * 0.05) + ",0)")
            .call(axes.y);

    }

    function constructor(selection) {
        selection.each(function (d) {
            container = d3.select(this);
            data = d;

            container.selectAll("svg").remove();
            container.selectAll("div").remove();

            container.append("div")
                .attr("class", "plot-title")
                .append("h5");

            var svg = container.append("svg");
            svg.append("defs").append("svg:clipPath")
                .attr("id", "clip")
                .append("svg:rect")
                .attr("width", dimensions.width)
                .attr("height", dimensions.plotHeight)
                .attr("x", 0)
                .attr("y", 0);

            svg.append('g')
                .attr("class", "selected-timespans");
            svg.append("g")
                .attr("class", "transient-labels");

            svg.append('g')
                .attr("class", "yaxis")
                .attr("fill", "none");

            var focused = svg.append('g')
                .attr("class", "focus")
                .attr("clip-path", "url(#clip)");

            focused.append("path")
                .attr("class", "plot-line")
                .attr("fill", "none");

            svg.append("line").attr("class", "hover");
            svg.append("circle").attr("class", "hover");

            svg.append('rect')
                .attr("class", "timeline-hover")
                .attr('fill-opacity', 0)
                .attr('stroke-opacity', 0);

            draw();
        });
    }

    constructor.dimensions = function (value) {
        if (!arguments.length) {
            return dimensions;
        }
        dimensions.width = value.width;
        dimensions.height = value.height / 5;

        dimensions.titleHeight = dimensions.height * 0.2;
        dimensions.plotHeight = dimensions.height - dimensions.titleHeight;
        dimensions.yHeight = dimensions.plotHeight * 0.9;
        dimensions.highlightHeight = (dimensions.plotHeight - dimensions.yHeight) / 2;

        dimensions.parentWidth = value.width;
        dimensions.parentHeight = value.height;
        return constructor;
    };
    constructor.xScale = function (value) {
        if (!arguments.length) {
            return scales.xDisplayed;
        }
        scales.xDisplayed = value;
        // axes.x = d3.axisBottom(scales.xDisplayed);
        return constructor;
    };
    constructor.hover = function (coord, closestPoint) {
        hover(coord, closestPoint);
        return constructor;
    };
    constructor.zoom = function (value) {
        if (!arguments.length) {
            return zoom;
        }
        zoom = value;
        // axes.x = d3.axisBottom(scales.xDisplayed);
        return constructor;
    };
    constructor.zoomed = function () {
        zoomed();
        return constructor;
    };
    constructor.selectTimespans = function (value) {
        if (!arguments.length) {
            return selectedTimespans;
        }
        selectedTimespans = value;
        draw();

        return constructor;
    };
    constructor.updateLabels = function (value) {
        data.labelStreaks = value;
        drawLabels();
        return constructor;
    };
    return constructor;
};
transientTector.timeSeries = function (directorEvents) {
    "use strict";
    var dimensions = {width: 0, height: 0, parentWidth: 0, parentHeight: 0};
    var container;
    var data;
    var fieldOptions = [];
    var events = {};
    var rawPlots = {
        "perf_pow": transientTector.timePlot(events, "perf_pow"),
        "t5_5": transientTector.timePlot(events, "t5_5")
    };
    var eigenPlots = {
        "pca_eig0": transientTector.timePlot(events, "pca_eig0")
    };
    var scales = {
        xDisplayed: d3.scaleTime(),
        xFull: d3.scaleTime(),
        eig: d3.scaleLinear()
    };
    var selectedTimestamps = [];
    var selectedStreaks = [];
    var selectedLabelTypes = [];
    var selectedEigY;
    var selectedEigX;
    var sortBy = 'eigX';
    var sortDir = 1;

    function toggleSort(d) {
        if (sortBy === d.key) {
            sortDir *= -1;
        }
        else {
            sortBy = d.key;
        }
        drawModal();
    }

    function selectTimestamp() {
        var coord = d3.event.offsetX-5;
        var hoveredDate = scales.xDisplayed.invert(coord);

        var rawPoint = _.first(_.sortBy(data.raw, function (d) {
            return Math.abs(hoveredDate - d.timestamp);
        }));

        if (!rawPoint) {
            return;
        }
        var idx = _.map(selectedTimestamps,function(t){return t.getTime();}).indexOf(rawPoint.timestamp.getTime());
        if(idx > -1){
            selectedTimestamps.splice(idx,1)
        }else{
            selectedTimestamps.push(rawPoint.timestamp);
        }

        directorEvents.selectTimestamps(selectedTimestamps);
    }

    function rawFeatureSelect(d) {
        if (rawPlots[d.field.toLowerCase()]) {
            d3.select(this).attr("class", "dropdown-item");
            delete rawPlots[d.field.toLowerCase()]
        } else {
            d3.select(this).attr("class", "dropdown-item active");
            rawPlots[d.field.toLowerCase()] = transientTector.timePlot(events, d.field.toLowerCase());
        }
        draw();
    }

    function eigenvectorSelect(d) {
        if (eigenPlots[d.field]) {
            d3.select(this).attr("class", "dropdown-item");
            delete eigenPlots[d.field]
        } else {
            d3.select(this).attr("class", "dropdown-item active");
            eigenPlots[d.field] = transientTector.timePlot(events, d.field);
        }
        draw();
    }

    function hover(d, i) {
        var coord = d3.event.offsetX-5;
        var hoveredDate = scales.xDisplayed.invert(coord);

        var rawPoint = _.first(_.sortBy(data.raw, function (d) {
            return Math.abs(hoveredDate - d.timestamp);
        }));
        var eigenPoint = _.first(_.sortBy(data.pca, function (d) {
            return Math.abs(hoveredDate - d.timestamp);
        }));
        var labelPoint = _.find(data.mergedLabels, function (d) {
            return d.timestamp.getTime() === eigenPoint.timestamp.getTime();
        });

        for (var key in rawPlots) {
            rawPlots[key].hover(coord, rawPoint);
        }
        for (var key in eigenPlots) {
            eigenPlots[key].hover(coord, eigenPoint);
        }

        var labelDescription = "None";
        if (labelPoint) {
            labelDescription = "";
            labelDescription += labelPoint.ensemble ? "Ensemble<br />" : "";
            labelDescription += labelPoint.kink ? "Kink Finder<br />" : "";
            labelDescription += labelPoint.powerStep ? "Power Jump<br />" : "";
            labelDescription += labelPoint.stepSize ? "Step Size<br />" : "";
            labelDescription += labelPoint.hdbscan ? "HDBScan<br />" : "";
        }

        var html = "<div class='popover-header'>" + transientTector.timeFormat(rawPoint.timestamp) + "</div>";
        html += "<table class='table table-sm'><tbody>";
        for (var plot in eigenPlots) {
            html += "<tr><td>" + plot + "</td><td>" + eigenPoint[plot] + "</td>";
        }
        for (var plot in rawPlots) {
            html += "<tr><td>" + plot + "</td><td>" + rawPoint[plot] + "</td>";
        }
        html += "</tbody></table>";
        html += "<div>" + labelDescription + "</div>";
        d3.select("#timeseries-hover")
            .html(html)
            .attr("style", "display:block;left:" + (d3.event.pageX + 30) + "px;top:" + (d3.event.pageY + 100) + "px;");

    }

    function zoom() {
        if (d3.event.sourceEvent && d3.event.sourceEvent.type === "brush") return; // ignore zoom-by-brush
        var t = d3.event.transform;
        scales.xDisplayed.domain(t.rescaleX(scales.xFull).domain());

        for (var key in rawPlots) {
            rawPlots[key].xScale(scales.xDisplayed).zoomed();
        }
        for (var key in eigenPlots) {
            eigenPlots[key].xScale(scales.xDisplayed).zoomed();
        }

        container.select("g.xaxis")
            .call(d3.axisBottom(scales.xDisplayed))
            .selectAll("text")
            .style("text-anchor", "end")
            .attr("dx", "-.8em")
            .attr("dy", ".15em")
            .attr("transform", "rotate(-65)");
    }

    function drawModal() {
        var eigExtent = [
            +_.min(_.min(data.eigenvalues, function (d) {
                delete d['eigenvector'];
                return _.min(d);
            })),
            +_.max(_.max(data.eigenvalues, function (d) {
                delete d['eigenvector'];
                return _.max(d);
            }))
        ];
        scales.eig.domain(eigExtent);
        scales.eig.range([0, (dimensions.width * 0.85) / 7]);

        var fields = _.map(data.fields, function (d) {
            var eigenvaluesX = data.eigenvalues[+selectedEigX.field.slice(-1)];
            var eigenvalueX = +eigenvaluesX[d.field.toLowerCase()];

            var eigenvaluesY = data.eigenvalues[+selectedEigY.field.slice(-1)];
            var eigenvalueY = +eigenvaluesY[d.field.toLowerCase()];
            var field = "<td>" + d.field + "</td>",
                subsystem = "<td>" + d.subsystem + "</td>",
                measurementType = "<td>" + d.measurement_type + "</td>",
                eigA = "<td><div class='eig-value' style='width:" + (scales.eig(eigenvalueX) || 0) + "px;'></div></td>",
                eigB = "<td><div class='eig-value' style='width:" + (scales.eig(eigenvalueY) || 0) + "px;'></div></td>",
                description = "<td>" + d.description + "</td>"
            d.eigX = eigenvalueX;
            d.eigY = eigenvalueY;
            d.rowHtml = field + subsystem + measurementType + eigA + eigB + description;
            return d;
        });

        var eigenHtml = fields.sort(function (a, b) {
            if (["eigX", "eigY"].indexOf(sortBy) > -1) {
                //float comparison
                var bVal = b[sortBy] || -999;
                var aVal = a[sortBy] || -999;
                return sortDir > 0 ? bVal - aVal : aVal - bVal;
            }
            else {
                //string comparison
                return sortDir > 0 ? a[sortBy].localeCompare(b[sortBy]) : b[sortBy].localeCompare(a[sortBy]);
            }
        });

        var rows = container.select("#raw-feature-modal")
            .select("#tag-table")
            .select("tbody")
            .selectAll("tr")
            .data(eigenHtml);

        rows.enter().append("tr")
            .merge(rows)
            .attr("class", function (d) {
                return rawPlots[d.field.toLowerCase()] ? "machine-tag table-active" : "machine-tag";
            })
            .html(function (d) {
                return d.rowHtml;
            })
            .on("click", rawFeatureSelect);

        rows.exit().remove();

        var headerRows = container.select("#raw-feature-modal")
            .select("#tag-table")
            .select("thead")
            .select("tr")
            .selectAll("td")
            .data([
                {
                    display: "Tag",
                    key: "field"
                },
                {
                    display: "Subsystem",
                    key: "subsystem"
                },
                {
                    display: "Measurement Type",
                    key: "measurement_type"
                },
                {
                    display: selectedEigX.name + " Influenece",
                    key: "eigX"
                },
                {
                    display: selectedEigY.name + " Influenece",
                    key: "eigY"
                },
                {
                    display: "Description",
                    key: "description"
                }
            ]);

        headerRows.enter().append("td")
            .merge(headerRows)
            .html(function (d) {
                return d.display;
            })
            .on("click", toggleSort);

        headerRows.exit().remove();

        container.select("#raw-feature-modal").select(".plot")
            .on("click", function (d) {
                $("#raw-feature-modal").modal("hide");
            });
    }

    function draw() {
        if (!data.raw && !data.pca) {
            return;
        }

        var xExtent = d3.extent(data.raw, function (d) {
            return d.timestamp;
        });


        scales.xDisplayed.range([(dimensions.width * 0.05), dimensions.width]);
        scales.xFull.range([(dimensions.width * 0.05), dimensions.width]);
        scales.xDisplayed.domain(xExtent);
        scales.xFull.domain(xExtent);

        var raw = container.select("#timeseries-plots-raw")
            .selectAll("div.raw-plot")
            .data(Object.keys(rawPlots));
        raw.enter()
            .append("div")
            .merge(raw)
            .attr("class", function (d) {
                return "text-center raw-plot " + d;
            });
        raw.exit().remove();

        var eigen = container.select("#timeseries-plots-eigen")
            .selectAll("div.eigen-plot")
            .data(Object.keys(eigenPlots));
        eigen.enter()
            .append("div")
            .merge(eigen)
            .attr("class", function (d) {
                return "text-center eigen-plot " + d;
            });
        eigen.exit().remove();

        var zoomer = d3.zoom()
            .scaleExtent([1, Infinity])
            .translateExtent([[0, 0], [dimensions.width, dimensions.height * 0.8]])
            .extent([[0, 0], [dimensions.width, dimensions.height * 0.8]])
            .on("zoom", zoom);

        container.select("#timeseries-overlay")
            .attr("style", "width:" + (dimensions.width - 30) + "px;height:" + dimensions.height + "px;")
            .on("mousemove", hover)
            .on("click", selectTimestamp)
            .on("mouseout", function () {
                d3.select("#timeseries-hover").attr("style", "display:none;");
            })
            .call(zoomer);
        container.select("#xaxis").attr("height", dimensions.height * .15);
        container.select("g.xaxis")
            .call(d3.axisBottom(scales.xDisplayed)
                .tickFormat(d3.timeFormat("%Y-%m-%d")))
            .selectAll("text")
            .style("text-anchor", "end")
            .attr("dx", "-.8em")
            .attr("dy", ".15em")
            .attr("transform", "rotate(-65)");

        drawModal();

        var menuOptions = container.select(".eigenvector-selector")
            .select(".dropdown-menu")
            .selectAll(".dropdown-item")
            .data(data.compositeFields);

        menuOptions.enter()
            .append("a")
            .attr("class", function (d) {
                return eigenPlots[d.field] ? "dropdown-item active" : "dropdown-item";
            })
            .attr("href", "#")
            .on("click", eigenvectorSelect)
            .merge(menuOptions)
            .text(function (d) {
                return d.name + " - " + d.variance_explained + "%";
            });

        menuOptions.exit().remove();

        var mergedStreaks = getStreaks(_.pluck(data.mergedLabels, "timestamp").sort());
        for (var key in eigenPlots) {
            container.selectAll("div.eigen-plot." + key)
                .datum({
                    raw: data.pca,
                    labels: data.mergedLabels,
                    labelStreaks: mergedStreaks
                })
                .call(eigenPlots[key].xScale(scales.xDisplayed).dimensions(dimensions));

            eigenPlots[key].selectTimespans(selectedStreaks);
        }
        for (var key in rawPlots) {
            container.selectAll("div.raw-plot." + key)
                .datum({
                    raw: data.raw,
                    labels: data.mergedLabels,
                    labelStreaks: mergedStreaks
                })
                .call(rawPlots[key].xScale(scales.xDisplayed).dimensions(dimensions));

            rawPlots[key].selectTimespans(selectedStreaks);
        }

    }

    function getStreaks(timestamps) {
        if (timestamps.length == 0) {
            return [];
        }
        var streaks = [];
        var currentStreak = [timestamps[0]];
        for (var i = 1; i < timestamps.length; i++) {
            if (timestamps[i] - timestamps[i - 1] === 600000) {
                currentStreak.push(timestamps[i]);
            }
            else {
                streaks.push([_.min(currentStreak), _.max(currentStreak)]);
                currentStreak = [timestamps[i]];
            }
        }
        streaks.push([_.min(currentStreak), _.max(currentStreak)]);

        return streaks;
    }

    function constructor(selection) {
        selection.each(function (d) {
            container = d3.select(this);
            data = d;

            draw();
        });
    }

    constructor.dimensions = function (value) {
        if (!arguments.length) {
            return dimensions;
        }
        dimensions.width = (value.width / 2) - 30;
        dimensions.height = value.height * 0.64;
        dimensions.parentWidth = value.width;
        dimensions.parentHeight = value.height;
        return constructor;
    };
    constructor.selectTimestamps = function (value) {
        if (!arguments.length) {
            return selectedTimestamps;
        }
        selectedTimestamps = value.sort();
        selectedStreaks = getStreaks(selectedTimestamps);

        for (var key in eigenPlots) {
            eigenPlots[key].selectTimespans(selectedStreaks);
        }
        for (var key in rawPlots) {
            rawPlots[key].selectTimespans(selectedStreaks);
        }

        return constructor;
    };
    constructor.selectedLabelTypes = function (types) {
        if (!arguments.length) {
            return selectedLabelTypes;
        }
        selectedLabelTypes = types;
        return constructor;
    };
    constructor.updateMergedLabels = function (value) {
        data.mergedLabels = value;
        var streaks = getStreaks(_.pluck(data.mergedLabels, "timestamp").sort());
        for (var key in eigenPlots) {
            eigenPlots[key].updateLabels(streaks);
        }
        for (var key in rawPlots) {
            rawPlots[key].updateLabels(streaks);
        }
    };
    constructor.selectedEigX = function (value) {
        if (!arguments.length) {
            return selectedEigX;
        }
        selectedEigX = value;
        return constructor;
    };
    constructor.selectedEigY = function (value) {
        if (!arguments.length) {
            return selectedEigY;
        }
        selectedEigY = value;
        return constructor;
    };
    return constructor;
};
transientTector.reducedSpace = function (directorEvents) {
    "use strict";
    var dimensions = {width: 0, height: 0, parentWidth: 0, parentHeight: 0};
    var container;
    var data;
    var selectedPsn = null;
    var scales = {
        xScale: d3.scaleLinear(),
        yScale: d3.scaleLinear(),

        xFull: d3.scaleLinear(),
        yFull: d3.scaleLinear()
    };
    var axes = {
        y: d3.axisLeft(scales.yScale),
        x: d3.axisBottom(scales.xScale)
    };
    var zoomK = 1;
    var lastZoomK = 1;
    var selectedTimestamps = [];
    var selectedLabelTypes = [];
    var selectedLabelData = [];
    var selectedAxes = {};
    var circleData = [];
    var hexBinData;
    var hexbin = d3.hexbin()
        .x(function (d) {
            return scales.xFull(d[selectedAxes.x.field]);
        })
        .y(function (d) {
            return scales.yFull(d[selectedAxes.y.field]);
        });
    var color = d3.scaleThreshold().domain([10, 20, 30, 40, 50, 60, 70, 80, 90]).range(transientTector.colors.blue);
    var selectedColor = d3.scaleThreshold().domain([10, 20, 30, 40, 50, 60, 70, 80, 90]).range(transientTector.colors.green);
    var transientColor = d3.scaleThreshold().domain([10, 20, 30, 40, 50, 60, 70, 80, 90]).range(transientTector.colors.orange);

    var zoomer = d3.zoom().scaleExtent([.8, 15]).on("zoom", zoom);
    var resetZoom = false;

    function xAxisSelect(d) {
        selectedAxes.x = d;
        directorEvents.selectEigX(d);
        setScales();
        draw();
    }

    function yAxisSelect(d) {
        selectedAxes.y = d;
        directorEvents.selectEigY(d);
        setScales();
        draw();
    }

    function onSelect(d) {
        return d;
    }

    function hover(d, i) {

        var binnedTimestamps = _.map(_.pluck(d, "timestamp"), function (d) {
            return d.getTime()
        });
        var selectedTime = _.sortBy(_.map(selectedTimestamps, function (d) {
            return d.getTime();
        }));

        var selected = _.filter(binnedTimestamps, function (t) {
            return _.indexOf(selectedTime, t, true) > -1;
        }).length;
        var hasTransient = _.filter(binnedTimestamps, function (t) {
            return _.indexOf(selectedLabelData, t, true) > -1;
        }).length;
        var html = "<div class='popover-header'>" + d.length + " data points</div>";
        html += "<table class='table table-sm'><tbody>";
        html += "<tr><td>" + selected + "</td><td>selected</td>";
        html += "<tr><td>" + hasTransient + "</td><td>labeled transients</td>";
        html += "</tbody></table>";
        d3.select("#timeseries-hover")
            .html(html)
            .attr("style", "display:block;left:" + (d3.event.pageX + 30) + "px;top:" + (d3.event.pageY + 100) + "px;");

    }

    function refreshCircleData() {
        if(data && data.pca){
            selectedLabelData = _.sortBy(_.map(data.mergedLabels, function (c) {
                return c.timestamp.getTime();
            }));
            var selectedTime = _.map(selectedTimestamps, function (d) {
                return d.getTime();
            });
            //hexbin.radius(8 / zoomK);
            //hexBinData = hexbin(data.pca);
            circleData = _.map(hexBinData, function (d) {
                var binnedTimestamps = _.map(_.pluck(d, "timestamp"), function (t) {
                    return t.getTime()
                });


                d.isSelected = _.find(binnedTimestamps, function (t) {
                    return _.indexOf(selectedTime, t) > -1;
                }) ? true : false;
                d.hasTransient = _.find(binnedTimestamps, function (t) {
                    return _.indexOf(selectedLabelData, t, true) > -1;
                }) ? true : false;

                return d;
            });
        }

    }

    function drawHexBins() {
        //selectedLabelData = [];

        hexbin.radius(8 / zoomK);
        hexBinData = hexbin(data.pca);
        //if (zoomK !== lastZoomK) {
        refreshCircleData();
        //    lastZoomK = zoomK;
        //}
        var selectedTime = _.map(selectedTimestamps, function (d) {
            return d.getTime();
        });
        var points = container
            .select("svg.scatter")
            .select("g.hex")
            .selectAll("path")
            .data(hexBinData);

        points.enter()
            .append("path")
            .attr("class", "hexagon")
            .on("click", function (d) {
                var timestamps = _.map(
                    _.unique(
                        _.flatten(
                            [_.map(d, function (c) {
                                return c.timestamp.getTime();
                            }),
                                _.map(selectedTimestamps, function (c) {
                                    return c.getTime();
                                })]
                        )
                    ),
                    function (c) {
                        return new Date(c);
                    }
                );

                directorEvents.selectTimestamps(timestamps);
            })
            .on("mouseover", hover)
            .on("mouseout", function () {
                d3.select("#timeseries-hover").attr("style", "display:none;");
            })
            .merge(points)
            .attr("d", function (d) {
                return "M" + d.x + "," + d.y + hexbin.hexagon();
            })
            .attr("fill", function (d) {
                /*  var binnedTimestamps = _.map(_.pluck(d, "timestamp"), function (t) {
                      return t.getTime()
                  });

                  var isSelected = _.find(binnedTimestamps, function (t) {
                      return _.indexOf(selectedTime, t, true) > -1;
                  }) ? true : false;
                  var hasTransient = _.find(binnedTimestamps, function (t) {
                      return _.indexOf(selectedLabelData, t, true) > -1;
                  }) ? true : false;

                  if (isSelected) {
                      return selectedColor(d.length);
                  }
                  if (hasTransient) {
                      return transientColor(d.length);
                  }*/
                return color(d.length);

            });
        points.exit().remove();


        var selectedCircles = container
            .select("svg.scatter")
            .select("g.circles")
            .selectAll("circle.selected")
            .data(_.filter(circleData, function (d) {
                return d.isSelected;
            }));
        selectedCircles.enter()
            .append('circle')
            .attr('class', 'selected')
            .on("mouseover", hover)
            .on("mouseout", function () {
                d3.select("#timeseries-hover").attr("style", "display:none;");
            })
            .merge(selectedCircles)
            .attr("cx", function (d) {

                return d.hasTransient ? d.x + (3 / zoomK) * .5 : d.x;
            })
            .attr("cy", function (d) {
                return d.y;
            })
            .attr("fill", function (d) {

                if (d.isSelected) {
                    return selectedColor(d.length);
                }
                else {
                    return null;
                }
            })
            .attr("r", function (d) {
                if (d.isSelected) {
                    return 3 / zoomK;
                }
                else {
                    return 0;
                }
            });
        selectedCircles.exit().remove();

        var transientCircles = container
            .select("svg.scatter")
            .select("g.circles")
            .selectAll("circle.transient")
            .data(_.filter(circleData, function (d) {
                return d.hasTransient;
            }));
        transientCircles.enter()
            .append('circle')
            .attr('class', 'transient')
            .on("mouseover", hover)
            .on("mouseout", function () {
                d3.select("#timeseries-hover").attr("style", "display:none;");
            })
            .merge(transientCircles)
            .attr("cx", function (d) {
                return d.isSelected ? d.x - (3 / zoomK) * .5 : d.x;
            })
            .attr("cy", function (d) {
                return d.y;
            })
            .attr("fill", function (d) {
                if (d.hasTransient) {
                    return transientColor(d.length);
                }
                else {
                    return null;
                }
            })
            .attr("r", function (d) {
                if (d.hasTransient) {
                    return 3 / zoomK;
                }
                else {
                    return 0
                }
            });
        transientCircles.exit().remove();
    }

    function drawAxes() {
        //container.select(".xaxis").attr("height", dimensions.height * .15);
        container.select("text.yaxis-label")
            .attr("transform", "translate(" + (dimensions.width * 0.08) + "," + (dimensions.height / 2) + ") rotate(-90)")
            .style("text-anchor", "middle")
            .style("fill", "white")
            .text(selectedAxes.y.name);

        container.select("text.xaxis-label")
            .attr("transform", "translate(" + (dimensions.width / 2) + "," + (dimensions.height * .92) + ")")
            .style("text-anchor", "middle")
            .style("fill", "white")
            .text(selectedAxes.x.name);

        container.select("g.xaxis")
            .call(axes.x)
            .attr("transform", "translate(0," + (dimensions.height * 0.95) + ")")
            .selectAll("text")
            .style("text-anchor", "end")
        // .attr("transform", "")
        //.attr("transform", "rotate(-65)");

        // container.select(".yaxis").attr("height", dimensions.height * .15);
        container.select("g.yaxis")
            .call(axes.y)
            .attr("transform", "translate(" + (dimensions.width * 0.05) + ",0)")
            .selectAll("text")
            .style("text-anchor", "end")
        // .attr("dy", ".15em")
        ;
    }

    function zoom() {
        //if ((d3.event.sourceEvent && d3.event.sourceEvent.type === "brush")) return; // ignore zoom-by-brush

        var t = d3.event.transform;
        zoomK = t.k;


        container.select(".hex")
            .attr("transform", d3.event.transform);
        container.select(".circles")
            .attr("transform", d3.event.transform);
        scales.xScale.domain(t.rescaleX(scales.xFull).domain());
        scales.yScale.domain(t.rescaleY(scales.yFull).domain());
        drawHexBins();
        drawAxes();


    }

    function setScales(){
        if (!selectedAxes.x) {
            selectedAxes.x = data.compositeFields[0];
            selectedAxes.y = data.compositeFields[1];
        }

        var yExtent = d3.extent(_.map(_.pluck(data.pca,  selectedAxes.y.field), function (d) {
            return parseFloat(d);
        }));
        var xExtent = d3.extent(_.map(_.pluck(data.pca,  selectedAxes.x.field), function (d) {
            return parseFloat(d);
        }));

        scales.xScale.domain(xExtent);
        scales.xScale.range([25, dimensions.width - 25]);
        scales.xFull.domain(xExtent);
        scales.xFull.range([25, dimensions.width - 25]);

        scales.yScale.domain(yExtent);
        scales.yScale.range([dimensions.height - 25, 25]);

        scales.yFull.domain(yExtent);
        scales.yFull.range([dimensions.height - 25, 25]);
    }

    function draw() {
        var filteredData = data.pca;
        if (!filteredData) {
            return;
        }
        if (resetZoom) {
            container.selectAll(".hex")
                .attr("transform", d3.zoomIdentity);
            container.select("svg.scatter")
                .call(zoomer.transform, d3.zoomIdentity);
            resetZoom=false;
        }


        container.select("svg.scatter")
            .attr("height", dimensions.height)
            .attr("width", dimensions.width)
            .call(zoomer);



        var menuOptions = container.select(".x-selector")
            .select(".dropdown-menu")
            .selectAll(".dropdown-item")
            .data(data.compositeFields);

        menuOptions.enter()
            .append("a")
            .attr("href", "#")
            .on("click", xAxisSelect)
            .merge(menuOptions)
            .attr("class", function (d) {
                return selectedAxes.x.field === d.field ? "dropdown-item active" : "dropdown-item";
            })
            .text(function (d) {
                return d.name + " - " + d.variance_explained + "%";
            });

        menuOptions.exit().remove();

        var menuOptions = container.select(".y-selector")
            .select(".dropdown-menu")
            .selectAll(".dropdown-item")
            .data(data.compositeFields);

        menuOptions.enter()
            .append("a")
            .attr("href", "#")
            .on("click", yAxisSelect)
            .merge(menuOptions)
            .attr("class", function (d) {
                return selectedAxes.y.field === d.field ? "dropdown-item active" : "dropdown-item";
            })
            .text(function (d) {
                return d.name + " - " + d.variance_explained + "%";
            });

        menuOptions.exit().remove();

        container.select("g.legend")
            .call(
                d3.legendColor()
                // .labelFormat(d3.format("i"))
                    .labels([1, 10, 20, 30, 40, 50, 60, 70, 80, '90+'])
                    .orient('horizontal')
                    //.labels(d3.legendHelpers.thresholdLabels)
                    .scale(color).shapeWidth(25).title("Measurement Density")
            )
            .attr("transform", "translate(" + dimensions.width * .65 + "," + dimensions.height * .05 + ")");

        drawHexBins();
        drawAxes();

    }

    function constructor(selection) {
        selection.each(function (d) {
            container = d3.select(this);
            data = d;
            setScales();
            draw();
        });
    }

    constructor.dimensions = function (value) {
        if (!arguments.length) {
            return dimensions;
        }
        dimensions.width = value.width / 2;
        dimensions.height = value.height * .5;
        dimensions.parentWidth = value.width;
        dimensions.parentHeight = value.height;
        return constructor;
    };

    constructor.psn = function (value) {
        if (!arguments.length) {
            return selectedPsn;
        }
        if (selectedPsn) {
            resetZoom = true;
        }
        selectedPsn = value;

        return constructor;
    };
    constructor.selectTimestamps = function (value) {
        if (!arguments.length) {
            return selectedTimestamps;
        }
        selectedTimestamps = value;

        draw();
        return constructor;
    };
    constructor.selectedLabelTypes = function (types) {
        if (!arguments.length) {
            return selectedLabelTypes;
        }
        selectedLabelTypes = types;
        return constructor;
    };
    constructor.updateMergedLabels = function (value) {
        data.mergedLabels = value;
        draw();
    };
    return constructor;
};
transientTector.stats = function (directorEvents) {
    "use strict";
    var dimensions = {width: 0, height: 0, parentWidth: 0, parentHeight: 0};
    var container;
    var data;
    var scales = {
        x: d3.scaleLinear(),
        y: d3.scaleLinear()
    };
    var selectedTimestamps = [];
    var adjacentToSelectedClusters = [];
    var selectedClusters = [];
    var selectedPsn;

    function draw() {
        var clusterData = getStatsForMembership(memberOf());
        if (!clusterData.length) {
            return;
        }
        clusterData = _.sortBy(clusterData, function (d) {
            var clusterDist = _.find(data.clusterDistributions, function (c) {
                return c.cluster_label == d.cluster_label
            });

            return clusterDist.minutes * -1;
        })

        var xExtent = [0, _.filter(Object.keys(clusterData[0]), function (d) {
            return d.indexOf("mean") > -1;
        }).length - 1];
        var yExtent = d3.extent(_.flatten(_.map(data.clusterStats, function (d) {
            var result = [];
            var keys = _.filter(Object.keys(d), function (d) {
                return d.indexOf("mean") > -1;
            });
            for (var i in keys) {
                result.push(d[keys[i]]);
            }
            return result;
        })));

        scales.x.domain(xExtent);
        scales.x.range([0, dimensions.height / 10]);
        scales.y.domain(yExtent);
        scales.y.range([(dimensions.height / 10) - 5, 5]);
        container.select("#cluster-breakdown")
            .selectAll("div.cluster").remove();
        var clusters = container.select("#cluster-breakdown")
            .selectAll("div.cluster")
            .data(clusterData);
        if (!clusters) {
            return;
        }
        var clusterWrappers = clusters.enter()
            .append("div")
            .attr("class", function (d) {
                return selectedClusters.indexOf(d.cluster_label) > -1 ? "cluster active" : "cluster";
            })
            .on("click", function (d) {
                if (selectedClusters.indexOf(+d.cluster_label) == -1) {
                    selectedClusters.push(+d.cluster_label);
                }
                else {
                    selectedClusters.splice(selectedClusters.indexOf(+d.cluster_label), 1);
                }


                var timestamps = _.map(_.unique(_.map(_.filter(data.clusterLabels, function (c) {
                    return selectedClusters.indexOf(+c.cluster_label) > -1;
                }), function (d) {
                    return d.timestamp.getTime();
                })), function (d) {
                    return new Date(d);
                });

                directorEvents.selectTimestamps(timestamps);
            });
        var clusterSvg = clusterWrappers.append("svg");
        var clusterUsage = clusterWrappers.append("div");

        clusterSvg.append("path").attr("class", "stdev");
        clusterSvg.append("path").attr("class", "mean");
        clusterSvg.append("rect")
            .attr("x", 0)
            .attr("y", 0)
            .attr("height", dimensions.height / 10)
            .attr("width", dimensions.height / 10)
            .attr("class", function (d) {
                if (selectedClusters.indexOf(d.cluster_label) > -1) {
                    return "cluster-border selected";
                }
                else if (adjacentToSelectedClusters.indexOf(d.cluster_label) > -1) {
                    return "cluster-border adjacent";
                }
                else {
                    return "cluster-border";
                }
            });
        var merged = clusterWrappers.merge(clusters);
        merged.select("svg")
            .attr("id", function (d) {
                return "cluster-" + d.cluster_label
            })
            .attr("height", dimensions.height / 10)
            .attr("width", dimensions.height / 10);

        merged.select("path.stdev")
            .attr("d", function (d) {
                var keys = _.filter(Object.keys(d), function (d) {
                    return d.indexOf("stdev") > -1;
                });

                var meanKeys = _.filter(Object.keys(d), function (d) {
                    return d.indexOf("mean") > -1;
                });
                var result = "M";
                for (var i in keys) {
                    var mean = d[meanKeys[i]];
                    result += scales.x(i) + " " + scales.y(mean + (d[keys[i]] * 2)) + " ";
                }

                for (var i = keys.length - 1; i >= 0; i--) {
                    var mean = d[meanKeys[i]];
                    result += scales.x(i) + " " + scales.y(mean - (d[keys[i]] * 2)) + " ";
                }

                return result;
            });

        merged.select("path.mean")
            .attr("d", function (d) {
                var keys = _.filter(Object.keys(d), function (d) {
                    return d.indexOf("mean") > -1;
                });
                var result = "M";
                for (var i in keys) {
                    result += scales.x(i) + " " + scales.y(d[keys[i]]) + " ";
                }


                return result;
            });

        clusterUsage.html(function (d) {
            var clusterDist = _.find(data.clusterDistributions, function (c) {
                return c.cluster_label == d.cluster_label
            });
            if (clusterDist) {
                var percent = d3.format('.2%')(clusterDist.percent);
                var minutes = d3.format(',')(clusterDist.minutes) + '<br />minutes';
                return percent + "<br />" + minutes;
            }
            else {
                return "";
            }
        });
        var packageSimilarity = _.find(data.packageSimilarity, function (s) {
            return s.psn === selectedPsn;
        });
        var sortable = [];
        for (var related in packageSimilarity) {
            if ((related === selectedPsn) || (related === "undefined")) {
                continue;
            }

            sortable.push([related, packageSimilarity[related]]);
        }

        sortable.sort(function (a, b) {
            return a[1] - b[1];
        });
        sortable = sortable.slice(0, 5);

        var similarity = container.select("#package-similarity").selectAll("a")
            .data(sortable);

        similarity.enter()
            .append("a")
            .attr("class", "similar-link")
            .merge(similarity)
            .attr("href", "#")
            .html(function (d) {
                return d[0];
            })
            .on("click", function (d) {
                directorEvents.selectPsn(d[0]);
            });

        similarity.exit().remove();


    }

    function getStatsForMembership(clusters) {
        return _.filter(data.clusterStats, function (s) {
            return _.indexOf(clusters, s.cluster_label) > -1;
        })
    }

    function memberOf() {
        return _.unique(_.pluck(data.clusterDistributions, "cluster_label"));
    }

    function constructor(selection) {
        selection.each(function (d) {
            container = d3.select(this);
            data = d;
            draw();
        });
    }

    constructor.psn = function (value) {
        if (!arguments.length) {
            return selectedPsn;
        }
        selectedPsn = value;
        return constructor;
    };

    constructor.dimensions = function (value) {
        if (!arguments.length) {
            return dimensions;
        }
        dimensions.width = value.width;
        dimensions.height = value.height;
        dimensions.parentWidth = value.width;
        dimensions.parentHeight = value.height;
        return constructor;
    };
    constructor.selectTimestamps = function (value) {
        if (!arguments.length) {
            return selectedTimestamps;
        }
        selectedTimestamps = value;
        var milliStamps = _.map(selectedTimestamps, function (t) {
            return t.getTime();
        });
        adjacentToSelectedClusters = _.unique(_.map(
            _.filter(data.clusterLabels, function (d) {
                return milliStamps.indexOf(d.timestamp.getTime()) > -1;
            }),
            function (d) {
                return +d.cluster_label;
            }));
        if (adjacentToSelectedClusters.length == 0) {
            selectedClusters = [];
        }
        draw();
        return constructor;
    };
    return constructor;
};

transientTector.psnSelector = function (directorEvents) {
    "use strict";
    var dimensions = {width: 0, height: 0, parentWidth: 0, parentHeight: 0};
    var container;
    var data;
    var selectedPsn=34;

    function updatePsnDisplay() {
        if (selectedPsn) {
            container.selectAll(".dropdown-item").attr("class", "dropdown-item");
            d3.select(this).attr("class", "dropdown-item active");
            container.select(".dropdown-toggle").text("PSN " + selectedPsn);
        }
    }

    function onSelect(d) {
        directorEvents.selectPsn(d.psn);
    }

    function draw() {
        var menuOptions = container
            .select(".dropdown-menu")
            .selectAll(".dropdown-item")
            .data(data);

        menuOptions.enter()
            .append("a")
            .attr("class", "dropdown-item")
            .attr("href", "#")
            .on("click", onSelect)
            .merge(menuOptions)
            .text(function (d) {
                return d.psn;
            });

        menuOptions.exit().remove();
        updatePsnDisplay();
    }

    function constructor(selection) {
        selection.each(function (d) {
            container = d3.select(this);
            data = d;
            draw();
        });
    }

    constructor.psn = function (value) {
        if (!arguments.length) {
            return selectedPsn;
        }
        selectedPsn = value;

        return constructor;
    };
    constructor.dimensions = function (value) {
        if (!arguments.length) {
            return dimensions;
        }
        dimensions.width = value.width;
        dimensions.height = value.height;
        dimensions.parentWidth = value.width;
        dimensions.parentHeight = value.height;
        return constructor;
    };

    return constructor;
};

transientTector.director = function () {
    "use strict";
    var container;
    var data;
    var dimensions = {width: 0, height: 0};
    var events = {};
    var notes = [];
    var components = {
        psnSelector: transientTector.psnSelector(events),
        // metricSelector: transientTector.metricSelector(events),
        stats: transientTector.stats(events),
        reducedSpace: transientTector.reducedSpace(events),
        timeSeries: transientTector.timeSeries(events),
        dashboardState: transientTector.dashboardStateDescription(events),
        noteDownload: transientTector.annotationDownload(events)
    };
    var labelTypes = [
        {
            display: "Ensemble",
            dataKey: "ensembleLabels"
        },
        {
            display: "Kink Finder",
            dataKey: "kinkLabels"
        },
        {
            display: "Step Size",
            dataKey: "stepSizeLabels"
        },
        {
            display: "Power Jump",
            dataKey: "powerStepLabels"
        },
        {
            display: "HDBScan Outliers",
            dataKey: "hdbscanLabels"
        }
    ];
    var selectedTimestamps = [];
    var selectedLabelTypes = [];
    var selectedPsn;
    var selectedEigX;
    var selectedEigY;

    function updateMergedLabels() {
        components.reducedSpace.updateMergedLabels(data.mergedLabels);
        components.timeSeries.updateMergedLabels(data.mergedLabels);
        components.dashboardState.updateMergedLabels(data.mergedLabels);
        drawLabelSelector();
    }

    function drawLabelSelector() {
        var menuOptions = container.select("#metric-selector")
            .select(".dropdown-menu");

        menuOptions = menuOptions.selectAll(".dropdown-item")
            .data(labelTypes);

        menuOptions.enter()
            .append("a")
            .attr("href", "#")
            .on("click", events.selectLabelType)
            .merge(menuOptions)
            .attr("class", function (d) {
                return selectedLabelTypes.indexOf(d) > -1 ? "dropdown-item active" : "dropdown-item";
            })
            .text(function (d) {
                return d.display;
            });

        menuOptions.exit().remove();
    }

    function draw() {
        container.on("contextmenu", function (d, i) {
            d3.event.preventDefault();
            events.selectTimestamps([]);
        });

        container.select("#stats")
            .datum({
                clusterStats: data.clusterStats,
                clusterDistributions: data.clusterDistributions,
                clusterLabels: data.clusterLabels,
                packageSimilarity: data.packageSimilarity
            })
            .call(components.stats.psn(selectedPsn));
        container.select("#psn-selector").datum(data.psn).call(components.psnSelector.psn(selectedPsn));
        container.select("#reduced-space").datum({
            pca: data.pca,
            mergedLabels: data.mergedLabels,
            compositeFields: data.compositeFields
        }).call(components.reducedSpace.selectedLabelTypes(selectedLabelTypes));
        container.select("#timeseries").datum({
            pca: data.pca,
            raw: data.raw,
            mergedLabels: data.mergedLabels,
            kinkLabels: data.kinkLabels,
            powerStepLabels: data.powerStepLabels,
            stepSizeLabels: data.stepSizeLabels,
            hdbscanLabels: data.hdbscanLabels,
           // ensembleLabels: data.ensembleLabels,
            fields: data.fields,
            compositeFields: data.compositeFields,
            eigenvalues: data.eigenvalues
        }).call(components.timeSeries
            .selectedLabelTypes(selectedLabelTypes)
            .selectedEigX(selectedEigX)
            .selectedEigY(selectedEigY)
        );

        container.select(".dashboard-state-description")
            .datum({
                pca: data.pca,
                mergedLabels: data.mergedLabels
            }).call(components.dashboardState.selectedLabelTypes(selectedLabelTypes));
        container.select("#note-download").call(components.noteDownload);

        drawLabelSelector();
    }

    function getMergedTransientLabels() {
        var kinkDates = _.find(selectedLabelTypes, function (c) {
            return c.dataKey === "kinkLabels"
        })
            ? _.map(data.kinkLabels, function (d) {
                return d.timestamp.getTime();
            })
            : [];
        var powerDates = _.find(selectedLabelTypes, function (c) {
            return c.dataKey === "powerStepLabels"
        })
            ? _.map(data.powerStepLabels, function (d) {
                return d.timestamp.getTime();
            })
            : [];
        var stepDates = _.find(selectedLabelTypes, function (c) {
            return c.dataKey === "stepSizeLabels"
        })
            ? _.map(data.stepSizeLabels, function (d) {
                return d.timestamp.getTime();
            })
            : [];

        var hdbscanDates = _.find(selectedLabelTypes, function (c) {
            return c.dataKey === "hdbscanLabels";
        })
            ? _.map(data.hdbscanLabels, function (d) {
                return d.timestamp.getTime();
            })
            : [];

        var ensembleDates = _.find(selectedLabelTypes, function (c) {
            return c.dataKey === "ensembleLabels";
        })
            ? _.map(data.ensembleLabels, function (d) {
                return d.timestamp.getTime();
            })
            : [];

        var dates = _.union(kinkDates, powerDates, stepDates, hdbscanDates, ensembleDates);
        var timeParse = d3.timeParse("%Q");
        return _.map(dates, function (d) {
            var hasKink = _.contains(kinkDates, d) ? 1 : 0;
            var hasPower = _.contains(powerDates, d) ? 1 : 0;
            var hasStep = _.contains(stepDates, d) ? 1 : 0;
            var hasHdbscan = _.contains(hdbscanDates, d) ? 1 : 0;
            var hasEnsemble = _.contains(ensembleDates, d) ? 1 : 0;
            return {
                timestamp: timeParse(d),
                kink: hasKink,
                powerStep: hasPower,
                stepSize: hasStep,
                hdbscan: hasHdbscan,
                ensemble: hasEnsemble
            }
        });
    }

    function updatePsnData(error,
                           raw,
                           pca,
                           kinkLabels,
                           clusterLabels,
                           powerStepLabels,
                           stepSizeLabels,
                           clusterDistributions,
                           hdbscan,
                           ensembleLabels) {
        data.raw = raw;
        data.pca = pca;
        data.kinkLabels = kinkLabels;
        data.clusterLabels = clusterLabels;
        data.clusterDistributions = clusterDistributions;
        data.hdbscanLabels = hdbscan;
        data.powerStepLabels = powerStepLabels;
        data.stepSizeLabels = stepSizeLabels;
        data.ensembleLabels = ensembleLabels;


        data.raw.forEach(function (d) {
            d.timestamp = transientTector.timeParse(d.timestamp);
            for (var i in data.fields) {
                var field = data.fields[i].field;
                if (field && field != 'TIMESTAMP') {
                    d[field.toLowerCase()] = +d[field.toLowerCase()];
                }

            }
        });
        data.pca.forEach(function (d) {
            d.timestamp = transientTector.timeParse(d.timestamp);
            var numericCols = ["pca_eig0", "pca_eig1", "pca_eig2", "pca_eig3", "pca_eig4"]
            for (var i in numericCols) {
                d[numericCols[i]] = +d[numericCols[i]];
            }
        });
        data.kinkLabels.forEach(function (d) {
            d.timestamp = transientTector.timeParse(d.timestamp);
            var labelCols = ["kink_finder_labels"]
            for (var i in labelCols) {
                d[labelCols[i]] = +d[labelCols[i]];
            }
        });
        data.stepSizeLabels.forEach(function (d) {
            d.timestamp = transientTector.timeParse(d.timestamp);
        });
        data.clusterLabels.forEach(function (d) {
            d.timestamp = transientTector.timeParse(d.timestamp);
        });
        data.hdbscanLabels.forEach(function (d) {
            d.timestamp = transientTector.timeParse(d.timestamp);
        });
        data.powerStepLabels.forEach(function (d) {
            d.timestamp = transientTector.timeParse(d.timestamp);
        });
        data.ensembleLabels.forEach(function (d) {
            d.timestamp = transientTector.timeParse(d.timestamp);
        });
        data.clusterStats.forEach(function (d) {
            if (data.clusterStats.length == 0) {
                return;
            }
            var labelCols = Object.keys(data.clusterStats[0]);
            for (var i in labelCols) {
                d[labelCols[i]] = +d[labelCols[i]];
            }
        });
        data.clusterDistributions.forEach(function (d) {
            var labelCols = ["percent", "minutes", "cluster_label"];
            for (var i in labelCols) {
                d[labelCols[i]] = +d[labelCols[i]];
            }
        });
        data.packageSimilarity.forEach(function (d) {
            for (var i in data.psn) {
                d[data.psn[i].psn] = +d[data.psn[i].psn];
            }
        });

        /*data.eigenvalues.forEach(function (d) {
            for (var i in data.fields) {
                var field = data.fields[i].field;
                if (field && field != 'TIMESTAMP') {
                    d[field.toLowerCase()] = +d[field.toLowerCase()];
                }

            }
        });*/
        data.mergedLabels = getMergedTransientLabels();

        events.selectTimestamps([]);
        draw();
    }

    events.selectPsn = function (psn) {
        selectedPsn = psn;
        components.reducedSpace.psn(psn);

        d3.queue()
            .defer(d3.csv, "data/pipeline_files/model2_preprocessed_data_psn" + psn + ".csv")
            .defer(d3.csv, "data/pipeline_files/model2_pca_ncomponents5_psn" + psn + ".csv")
            .defer(d3.csv, "data/pipeline_files/model2_20min_kinkfinder_psn" + psn + ".csv")
            .defer(d3.csv, "data/pipeline_files/model2_20min_kmeans_labels_psn" + psn + ".csv")
            .defer(d3.csv, "data/pipeline_files/model2_powerstepsize_psn" + psn + ".csv")
            .defer(d3.csv, "data/pipeline_files/model2_stepsize_psn" + psn + ".csv")
            .defer(d3.csv, "data/pipeline_files/model2_20min_cluster_distributions_psn" + psn + ".csv")
            .defer(d3.csv, "data/pipeline_files/model2_hdbscan_psn" + psn + ".csv")
            .defer(d3.csv, "data/pipeline_files/model2_ensemble_psn" + psn + ".csv")
            .await(updatePsnData);

        return psn;
    };
    events.selectEigX = function (field) {
        selectedEigX = field;
        draw();
    }
    events.selectEigY = function (field) {
        selectedEigY = field;
        draw();
    }
    events.selectTimestamps = function (timestamps) {
        selectedTimestamps = _.sortBy(timestamps);

        components.reducedSpace.selectTimestamps(timestamps);
        components.timeSeries.selectTimestamps(timestamps);
        components.stats.selectTimestamps(timestamps);
        components.dashboardState.selectTimestamps(timestamps);
    };
    events.selectLabelType = function (type) {
        if (selectedLabelTypes.indexOf(type) > -1) {
            selectedLabelTypes.splice(selectedLabelTypes.indexOf(type), 1);
        }
        else {
            selectedLabelTypes.push(type);
        }
        data.mergedLabels = getMergedTransientLabels();

        updateMergedLabels();
        //draw();
    };
    events.addNote = function () {
        var annotation = d3.select("#annotation");
        var label = annotation.select("#transient-select").property("value");
        var note = annotation.select("#data-notes").property("value");

        var noteRecord = {
            psn: selectedPsn,
            timestamps: selectedTimestamps,
            label: label,
            note: note
        };
        notes.push(noteRecord);
        components.noteDownload.addNote(noteRecord);

        $("#annotation").modal("hide");
        document.getElementById("transient-select").value = "Not Transient";
        document.getElementById("data-notes").value = "";
    };

    function constructor(selection) {
        selection.each(function (d) {
            container = d3.select(this);
            data = d;
            selectedEigX = data.compositeFields[0];
            selectedEigY = data.compositeFields[1];
            events.selectPsn(41);
            draw();
        });
    }

    constructor.dimensions = function (value) {
        if (!arguments.length) {
            return dimensions;
        }
        dimensions = value;
        for (var k in components) {
            components[k].dimensions(dimensions);
        }
        return constructor;
    };

    return constructor;

};
