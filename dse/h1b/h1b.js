var h1b = {};

h1b.dataMunger = function(){
    var data,filteredData, filteredForCompanies, filteredForJobs, filters,geo, wages, filteredWages;

    var mapMunged,companyMunged,jobMunged;
    var jobCountColors =  [
        '#f0f9e8',
        '#ccebc5',
        '#a8ddb5',
        '#7bccc4',
        '#43a2ca',
        '#0868ac'
    ];

    var wageColors = [
        '#feedde',
        '#fdd0a2',
        '#fdae6b',
        '#fd8d3c',
        '#e6550d',
        '#a63603'
    ];

    var scales = {
        jobCount:d3.scaleLog(),
        jobCountCompanies:d3.scaleLog(),
        jobCountJobTypes:d3.scaleLog(),
        wages:d3.scaleLinear(),
        jobCountColor:d3.scaleThreshold().domain([1,10,100,1000,10000,100000]).range(jobCountColors),
        wagesColor:d3.scaleThreshold()
    };

    function avgWage(jobs){
        var wages = _.map(
            jobs,
            function(j){
                var wage;
                if(j['WAGE_RATE_OF_PAY_FROM'] > 0 && j['WAGE_RATE_OF_PAY_TO'] > 0){
                    wage = (j['WAGE_RATE_OF_PAY_TO'] + j['WAGE_RATE_OF_PAY_FROM']) / 2;
                }
                else if(j['WAGE_RATE_OF_PAY_FROM'] > 0){
                    wage = j['WAGE_RATE_OF_PAY_FROM'];
                }

                if(wage && j['TOTAL_WORKERS']){
                    return wage * j['TOTAL_WORKERS'];

                }
                else{
                    return 0;
                }

            });
        var totalWorkers = totalWorkerCount(jobs);

        return _.reduce(wages, function(a,b){return a+b;})/ totalWorkers;
    }

    function totalWorkerCount(jobs){
        return _.reduce(_.map(jobs, function(j){ return j['TOTAL_WORKERS']?j['TOTAL_WORKERS']:0 ; }), function(a,b){return a+b;});
    }
    function execFilters(){
        filteredData = _.filter(data, function(d){
            var conditions = [];

            if(filters.selectedState){
                conditions.push(d['WORKSITE_STATE'] == filters.selectedState)
            }

            if(filters.selectedCounty){
                conditions.push(d['WORKSITE_COUNTY'] == filters.selectedCounty)
            }

            if(filters.selectedCompany){
                conditions.push(filters.selectedCompany == d['EMPLOYER_NAME']);
            }

            if(filters.selectedJobType){
                conditions.push(filters.selectedJobType == d['SOC_CODE'].substring(0,2));
            }

            if(filters.selectedWageRange && filters.selectedWageRange.length == 2){
                conditions.push(d['WAGE_RATE_OF_PAY_FROM'] >= filters.selectedWageRange[0] && d['WAGE_RATE_OF_PAY_FROM'] <= filters.selectedWageRange[1]);
            }

            return _.every(conditions);
        });

        filteredForCompanies = _.filter(data, function(d){
            var conditions = [];

            if(filters.selectedState){
                conditions.push(d['WORKSITE_STATE'] == filters.selectedState)
            }

            if(filters.selectedCounty){
                conditions.push(d['WORKSITE_COUNTY'] == filters.selectedCounty)
            }

            if(filters.selectedJobType){
                conditions.push(filters.selectedJobType==d['SOC_CODE'].substring(0,2));
            }

            return _.every(conditions);
        });

        filteredForJobs = _.filter(data, function(d){
            var conditions = [];

            if(filters.selectedState){
                conditions.push(d['WORKSITE_STATE'] == filters.selectedState)
            }

            if(filters.selectedCounty){
                conditions.push(d['WORKSITE_COUNTY'] == filters.selectedCounty)
            }

            if(filters.selectedCompany){
                conditions.push(filters.selectedCompany == d['EMPLOYER_NAME']);
            }

            return _.every(conditions);
        });

        constructMiniMungers();

        mapMunged = miniMungers.map.aggregate();
        companyMunged = miniMungers.company.aggregate();
        jobMunged = miniMungers.job.aggregate();


        var plucked = _.pluck(companyMunged,'jobCount');
        var companyJobCountMax = _.max(plucked);
        var companyJobCountMin = _.min(plucked);

        var jobTypeJobCountMax =  _.max(_.pluck(jobMunged,'jobCount'));


        var wageMax = _.max([
            _.max(_.pluck(companyMunged,'avgWage')),
            _.max(_.pluck(jobMunged,'avgWage'))
        ]);


        if(companyJobCountMax > 10000){
            scales.jobCountCompanies = d3.scaleLog();
        }
        else {
            scales.jobCountCompanies = d3.scaleLinear();
        }


        if(jobTypeJobCountMax > 10000){
            scales.jobCountJobTypes = d3.scaleLog();
        }
        else {
            scales.jobCountJobTypes = d3.scaleLinear();
        }

        scales.jobCountJobTypes.domain([1,jobTypeJobCountMax]);
        scales.jobCountCompanies.domain([companyJobCountMin,companyJobCountMax]);

        scales.wages.domain([10000,wageMax])
    }

    mapMunger = function(){
        var data, filters,geo;

        var contexts = {
            state:{
                dataId:'WORKSITE_STATE',
                geoId:'iso_3166_2',
                filter: function(data){
                    return data;
                },
                matchToGeo:function(f){
                    var comparison = function(d){
                        var geoState = f.properties[contexts[filters.mapContext].geoId];
                        var dataState = d.indexValue;
                        var c = geoState
                            && dataState
                            && geoState == dataState;

                        return c;
                    };

                    return comparison;
                }
            },
            county:{
                dataId:'WORKSITE_COUNTY',
                geoId:'name',
                filter: function(data){
                    return _.filter(data, function(d){
                        return d[contexts.state.dataId] == filters.selectedState;
                    });
                },
                matchToGeo:function(f){
                    var comparison = function(d){
                        var geoState = f.properties[contexts.state.geoId];
                        var geoCounty = f.properties[contexts[filters.mapContext].geoId];
                        var dataCounty = d.indexValue;
                        var selectedState  = filters.selectedState;
                        var c = geoState
                            && geoCounty
                            && dataCounty
                            && selectedState
                            && geoState == selectedState
                            && (
                                dataCounty.toLowerCase() == geoCounty.toLowerCase()
                                || dataCounty.toLowerCase().replace('county','') == geoCounty.toLowerCase()
                                || dataCounty.toLowerCase()+' county' == geoCounty.toLowerCase()
                            );

                        return c;
                    };

                    return comparison;
                },
                filterGeo:function(f){
                    return f.properties[contexts.state.geoId] == filters.selectedState ||  f.properties[contexts.state.geoId] == filters.selectedState;
                }
            },
            zip:{
                dataId:'WORKSITE_POSTAL_CODE',
                geoId:'zip',
                filter: function(data){
                    return _.filter(data, function(d){
                        return d[contexts.state.dataId] == filters.selectedState;
                    });
                },
                matchToGeo: function(f){
                    var comparison = function(d){
                        var geoState = f.properties.state;
                        var geoZip = f.properties.zip;
                        var dataZip = d.indexValue;
                        var selectedState  = filters.selectedState;
                        var c = geoState
                            && geoZip
                            && dataZip
                            && selectedState
                            && geoState == selectedState
                            && dataZip == geoZip;

                        return c;
                    };

                    return comparison;
                },
                filterGeo:function(f){
                    return f.properties.state == filters.selectedState;
                }
            }
        };

        function countByCol(col){
            var filteredData = contexts[filters.mapContext].filter(data);

            var groups = _.groupBy(filteredData, col);
            var transformedGroups = _.map(groups, function(g, colVal){
                return {
                    indexValue: colVal,
                    indexName: col,
                    totalCount: g.length
                }
            });
            return transformedGroups;
        }

        function filterGeo(){
            if(!filters.selectedState) {
                return geo[filters.mapContext];
            }
            else{
                var contextGeo = _.clone(geo[filters.mapContext]);
                contextGeo.features = _.filter(geo[filters.mapContext].features, contexts[filters.mapContext].filterGeo);
                return contextGeo;
            }
        }

        function aggregateForMap(){
            var groupCol = contexts[filters.mapContext].dataId;
            var aggregatedData = countByCol(groupCol);
            var filteredGeo = filterGeo();
            var results = [];

            filteredGeo.features.forEach(function(f){
                var geoData = _.find(
                    aggregatedData,
                    contexts[filters.mapContext].matchToGeo(f)
                );
                if(!geoData){
                    f.properties.totalCount = 0;
                } else {
                    f.properties = _.extend(f.properties, geoData);
                }
            });

            return filteredGeo;
        }

        function constructor(d, f){
            data = d['h1b'];
            geo = d['geo'];
            filters = f;
            return constructor;
        }

        constructor.aggregate = aggregateForMap;

        return constructor;
    }();
    companyMunger = function(){
        var data, filters, unfilteredData;

        function aggregate(){
            var g =  _.groupBy(data, function(d){
                return d['EMPLOYER_NAME'];
            });

            return _.sortBy(_.map(g, function(c, d){ return {
                name:d,
                jobCount:totalWorkerCount(c),
                avgWage:avgWage(c)};
            }), 'jobCount').slice(-20);
        }

        function constructor(d, f){
            data = d['h1b'];
            unfilteredData = d['unfilteredH1b'];
            filters = f;
            return constructor;
        }
        constructor.aggregate = aggregate;

        return constructor;
    }();
    jobMunger = function(){
        var data, filters;

        var jobTypes = {
            '11':'Management Occupations',
            '13':'Business and Financial Operations Occupations',
            '15':'Computer and Mathematical Occupations',
            '17':'Architecture and Engineering Occupations',
            '19':'Life, Physical, and Social Science Occupations',
            '21':'Community and Social Service Occupations',
            '23':'Legal Occupations',
            '25':'Education, Training, and Library Occupations',
            '27':'Arts, Design, Entertainment, Sports, and Media Occupations',
            '29':'Healthcare Practitioners and Technical Occupations',
            '31':'Healthcare Support Occupations',
            '33':'Protective Service Occupations',
            '35':'Food Preparation and Serving Related Occupations',
            '37':'Building and Grounds Cleaning and Maintenance Occupations',
            '39':'Personal Care and Service Occupations',
            '41':'Sales and Related Occupations',
            '43':'Office and Administrative Support Occupations',
            '45':'Farming, Fishing, and Forestry Occupations',
            '47':'Construction and Extraction Occupations',
            '49':'Installation, Maintenance, and Repair Occupations',
            '51':'Production Occupations',
            '53':'Transportation and Material Moving Occupations'
        };


        function aggregate(){
            var g =  _.groupBy(data, function(d){
                return d['SOC_CODE'].substring(0,2);
            });

            return _.map(g, function(c, d){ return {
                code:d,
                name:jobTypes[d],
                jobCount:totalWorkerCount(c),
                avgWage:avgWage(c)};
            });
        }
        function constructor(d, f){
            data = d['h1b'];
            filters = f;

            return constructor;
        }
        constructor.aggregate = aggregate;
        constructor.jobTypes = jobTypes;

        return constructor;
    }();

    var miniMungers = {
        map:null,
        company:null,
        job:null
    };

    function topoToGeoJson(d, context){
        return topojson.feature(
            d[context],
            d[context].objects[context]
        );
    }

    function constructMiniMungers(){
        miniMungers.map = mapMunger({h1b:filteredData,geo:geo},filters);
        miniMungers.company = companyMunger({
            h1b:filteredForCompanies,
            geo:geo,
            unfilteredH1b:data
        }, filters);

        miniMungers.job = jobMunger({h1b:filteredForJobs},filters);
    }

    function constructor(d, f){
        var floatCols = ['WAGE_RATE_OF_PAY_FROM', ['WAGE_RATE_OF_PAY_TO']];
        var intCols = ['TOTAL_WORKERS'];
        var dateCols = ['CASE_SUBMITTED'];
        data = _.map(d['h1b'], function(e){
            Object.keys(e).forEach(function(key) {
                if(key.indexOf('DATE') > -1 || dateCols.indexOf(key) > -1){
                    e[key] = moment(e[key]);
                }
                else if(intCols.indexOf(key) > -1){
                    e[key] = parseInt(e[key]);
                }
                else if(floatCols.indexOf(key) > -1){
                    e[key] = parseFloat(e[key]);
                }

            });

            return e;
        });
        geo = {
            state: topoToGeoJson(d['geo'],'state'),
            county: topoToGeoJson(d['geo'],'county')
        };
        wages = d['wages'];
        filters = f;

        execFilters();
        return constructor;
    }

    constructor.aggregateForMap = function(){
        return mapMunged;
    };
    constructor.aggregateForCompanies = function(){
        return companyMunged;
    };
    constructor.aggregateForWages = function(){
        return jobMunged;
    };
    constructor.aggregateForJobs = function(){
        return miniMungers.job.aggregate();
    };
    constructor.execFilters = execFilters;
    constructor.scales = function(){return scales;};
    constructor.totalWorkerCount = function(){
        return totalWorkerCount(filteredData);
    };
    constructor.jobTypes = function(){return miniMungers.job.jobTypes;}
    return constructor;
}();

h1b.title = function(){
    var container, data;

    var dimensions = {
        width:0,
        height:0
    };

    var colors = {

    };

    var filters = {

    };

    var scales = {

    };

    function draw(){
        container.attr('style','width:'+dimensions.width+'px;height:'+dimensions.height+'px;');
    }

    function constructor(selection){
        selection.each(function (d, i) {
            data = d;
            container = d3.select(this);
            draw();
        });
    }

    constructor.dimensions = function (value) {
        if (!arguments.length) return dimensions;
        dimensions.parentHeight = value.height;
        dimensions.parentWidth = value.width;

        dimensions.width = value.width;
        dimensions.height = value.height * (1/10);

        return constructor;
    };
    constructor.colors = function (value) {
        if (!arguments.length) return colors;
        colors = value;
        return constructor;
    };
    constructor.filters = function (value) {
        if (!arguments.length) return filters;
        filters = value;
        return constructor;
    };
    constructor.scales = function (value) {
        if (!arguments.length) return scales;
        scales = value;
        return constructor;
    };

    return constructor;
};

h1b.filterDescription = function(){
    var container, data;

    var dimensions = {
        width:0,
        height:0
    };

    var colors = {

    };

    var filters = {

    };

    var scales = {

    };

    var components;

    var _onUpdateCallbacks = [];

    function onUpdate(){
        data.execFilters();

        //then
        draw();
        if(!filters.selectedState) {
            d3.select('g.contextPaths').attr("transform", null)
        }

        //then handle callbacks
        _onUpdateCallbacks.forEach(function(f){
            f();
        })

    }

    function draw(){
        container.attr('width',dimensions.width)
            .attr('height', dimensions.height);

        container.select('.filter-count')
            .html(d3.format(',')(data.totalWorkerCount())+ ' H-1B Positions');
        var locationDescription = container.select('.location-description');

        locationDescription.attr('width',dimensions.width*.5);
        locationDescription.selectAll('span').remove();
        locationDescription.selectAll('ul').remove();

        if(!filters.selectedState){
            container.select('.location-description')
                .html('<span>all states</span>');
        }
        else{

            var stateButton = locationDescription.append('ul')
                .attr('class','list-group');
            stateButton.append('li').attr('class','list-group-item')
                .html(filters.selectedState + '&nbsp;&nbsp;<button type="button" class="close"><span aria-hidden="true">&times;</span></button>')
                .on('click',function(d){ filters.selectedState = null;filters.selectedCounty = null;filters.mapContext = 'state'; onUpdate(); });;


            if(filters.selectedCounty){

                stateButton.append('li')
                    .attr('class','list-group-item')
                    .html(filters.selectedCounty + ' County&nbsp;&nbsp;<button type="button" class="close" ><span aria-hidden="true">&times;</span></button>')
                    .on('click',function(d){ filters.selectedCounty = null;filters.mapContext = 'county'; onUpdate(); });
            }
        }

        var jobDescription = container.select('.job-description');

        jobDescription.attr('width',dimensions.width*.5);
        jobDescription.selectAll('span').remove();
        jobDescription.selectAll('ul').remove();

        if(!filters.selectedJobType){
            container.select('.job-description')
                .html('<span>all job types</span>');
        }
        else{

            var l = jobDescription.append('ul')
                .attr('class','list-group');
            l.append('li').attr('class','list-group-item')
                .html(data.jobTypes()[filters.selectedJobType] + '&nbsp;&nbsp;<button type="button" class="close"><span aria-hidden="true">&times;</span></button>')
                .on('click',function(d){ filters.selectedJobType = null;onUpdate(); });;
        }

        var companyDescription = container.select('.company-description');

        companyDescription.attr('width',dimensions.width*.5);
        companyDescription.selectAll('span').remove();
        companyDescription.selectAll('ul').remove();

        if(!filters.selectedCompany){
            container.select('.company-description')
                .html('<span>all companies</span>');
        }
        else{

            var l = companyDescription.append('ul')
                .attr('class','list-group');
            l.append('li').attr('class','list-group-item')
                .html(filters.selectedCompany + '&nbsp;&nbsp;<button type="button" class="close"><span aria-hidden="true">&times;</span></button>')
                .on('click',function(d){ filters.selectedCompany = null;onUpdate(); });;
        }


        var legend = container.select('.color-legend');
        legend.attr('width',dimensions.width).attr('height',50);
        legend.selectAll('g').remove();
        legend.append('g');

        var legendOrdinal = d3.legendColor()
            .orient("horizontal")
            .labels([0,1,10,100,'1,000','10,000+'])
            .shapeWidth((dimensions.width-20)/6)
            .shapeHeight(20)
            .scale(data.scales().jobCountColor);

        legend.select("g")
            .call(legendOrdinal);

        /*components.forEach(function(f){
           f(container);
        });*/
    }

    function constructor(selection){
        selection.each(function (d, i) {
            container = d3.select(this);
            draw();
        });
    }

    constructor.dimensions = function (value) {
        if (!arguments.length) return dimensions;
        dimensions.parentHeight = value.height;
        dimensions.parentWidth = value.width;

        dimensions.width = value.width * (1/3.1);
        dimensions.height = value.height * (1/3);

        return constructor;
    };
    constructor.colors = function (value) {
        if (!arguments.length) return colors;
        colors = value;
        return constructor;
    };
    constructor.filters = function (value) {
        if (!arguments.length) return filters;
        filters = value;
        return constructor;
    };
    constructor.scales = function (value) {
        if (!arguments.length) return scales;
        scales = value;
        return constructor;
    };
    constructor.components = function (value) {
        if (!arguments.length) return components;
        components = value;
        return constructor;
    };
    constructor.data = function (value) {
        if (!arguments.length) return data;
        data = value;
        return constructor;
    };
    constructor.onUpdate = function (value) {
        if (!arguments.length) return onUpdate;
        _onUpdateCallbacks = value;
        return constructor;
    };
    constructor.draw = draw;

    return constructor;
};

h1b.map = function(){
    var container, data;

    var dimensions = {
        width:0,
        height:0,
        parentWidth:0,
        parentHeight:0
    };

    var colors = {

    };

    var filters = {

    };

    var scales = {
        values:d3.scaleQuantize(),
    };

    var _onUpdateCallbacks = [];

    function onUpdate(){
        data.execFilters();

        //then
        //container.select('g.contextPaths').attr("transform",null)
        draw();

        //then handle callbacks
        _onUpdateCallbacks.forEach(function(f){
            f();
        })

    }

    function drawFilterDescription(e){
        var c = e.select('.location-filter-description');

        var state = c.select('.selected-state');
        var county = c.select('.selected-county');

        state.style('display',function(){ return filters.selectedState ? 'block':'none';});
        state.select('span').html('<strong>State:</strong> '+filters.selectedState);
        state.select('button').on('click',function(){ filters.selectedState=null;filters.selectedCounty=null;filters.mapContext='state'; onUpdate();})

        county.style('display',function(){ return filters.selectedCounty ? 'block':'none';});
        county.select('span').html('<strong>County:</strong> '+filters.selectedCounty);
        county.select('button').on('click',function(){ filters.selectedCounty=null; onUpdate();})
    }

    function _calcMapBounds(filteredData){
        var center = d3.geoCentroid(filteredData);
        var scale  = (dimensions.width) * .8;
        var offset = [(dimensions.width)/2, (dimensions.height)/2];
        var projection = d3.geoMercator().scale(scale).center(center)
            .translate(offset);

        // create the path
        var path = d3.geoPath().projection(projection);

        // using the path determine the bounds of the current map and use
        // these to determine better values for the scale and translation
        var bounds  = path.bounds(filteredData);
        var hscale  = scale*(dimensions.width-20)  / (bounds[1][0] - bounds[0][0]);
        var vscale  = scale*(dimensions.height-20) / (bounds[1][1] - bounds[0][1]);
        var scale   = (hscale < vscale) ? hscale : vscale;
        var offset  = [dimensions.width -20 - (bounds[0][0] + bounds[1][0])/2,
            dimensions.height - 20 - (bounds[0][1] + bounds[1][1])/2];

        return {
            bounds:bounds,
            scale:scale,
            offset:offset,
            center:center
        };
    }

    function draw(){
        var aggregatedData = data.aggregateForMap();
        var mapBounds = _calcMapBounds(aggregatedData);

        container.attr('width',dimensions.width)
            .attr('height',dimensions.height*.9)
            .attr('x', dimensions.parentWidth*1/3)
            .attr('y', dimensions.height*.1);

        var globalScales = data.scales();

        var geoProjection = d3.geoMercator()
            .scale(mapBounds.scale)
            .center(mapBounds.center)
            .translate(mapBounds.offset);
        var geoPath = d3.geoPath()
            .projection(geoProjection);


        container.select('g.contextPaths')
            .selectAll("path").remove();
        var p = container.select('g.contextPaths')
            .selectAll("path").data(aggregatedData.features);
        p.enter()
            .append("path")
            .style('stroke', '#f7f7f7')
            .style('stroke-width', 0.3)
            .on('click',function(d){
                if(filters.mapContext == 'state'){
                    filters.mapContext = 'county';
                    filters.selectedState = d.properties.indexValue;
                }
                else if ( filters.mapContext == 'county'){
                    filters.selectedCounty = d.properties.indexValue;
                }

                onUpdate();
            })
            .on('mouseover', function (d) {
                var tooltipElement = d3.select('#tooltip');

                var html = (d.properties.indexValue ? d.properties.indexValue+'<br/>':'')+d3.format(',')(d.properties.totalCount)+' certified positions';
                tooltipElement.select('.tooltip-inner').html(html)
                tooltipElement.transition()
                    .duration(200)
                    .style("opacity", .9);
                tooltipElement
                    .style("left", (d3.event.pageX + 40 ) + "px")
                    .style("top", (d3.event.pageY - 28) + "px");

            })
            .on('mouseout', function (d) {
                var tooltipElement = d3.select('#tooltip');

                tooltipElement.transition()
                    .duration(500)
                    .style("opacity", 0);
            })
            .merge(p)
            .attr("d", geoPath)
            .attr('fill', function(d){
                return globalScales.jobCountColor(d.properties.totalCount);
            });

        p.exit().remove();

       /* container.call(
            d3.zoom()
                .scaleExtent([1, 8])
                .on("zoom", function () {
                    container.select('g.contextPaths').attr("transform", d3.event.transform);
                })
        );*/

    }

    function constructor(selection){
        selection.each(function (d, i) {
            container = d3.select(this);
            draw();
        });
    }

    constructor.dimensions = function (value) {
        if (!arguments.length) return dimensions;
        dimensions.parentHeight = value.height;
        dimensions.parentWidth = value.width;

        dimensions.width = value.width * (1/3.2);
        dimensions.height = value.height * (2/3);

        return constructor;
    };
    constructor.colors = function (value) {
        if (!arguments.length) return colors;
        colors = value;
        return constructor;
    };
    constructor.filters = function (value) {
        if (!arguments.length) return filters;
        filters = value;
        return constructor;
    };
    constructor.scales = function (value) {
        if (!arguments.length) return scales;
        scales = value;
        return constructor;
    };
    constructor.onUpdate = function (value) {
        if (!arguments.length) return onUpdate;
        _onUpdateCallbacks = value;
        return constructor;
    };
    constructor.data = function (value) {
        if (!arguments.length) return data;
        data = value;
        return constructor;
    };
    constructor.drawFilterDescription = drawFilterDescription;
    constructor.draw = draw;

    return constructor;
};

h1b.companyStats = function () {
    var container, data;

    var dimensions = {
        width:0,
        height:0
    };

    var colors = {

    };

    var filters = {

    };


    var _onUpdateCallbacks = [];

    function onUpdate(){
        data.execFilters();

        //then
        draw();

        //then handle callbacks
        _onUpdateCallbacks.forEach(function(f){
            f();
        })

    }

    var scales = {
        jobCount: d3.scaleLog(),
        wages: d3.scaleLinear()
    };

    function draw(){
        var aggregatedData = data.aggregateForCompanies();
        var globalScales = data.scales();

        container.attr('width',dimensions.width)
            .attr('height',dimensions.height)
            .attr('x', dimensions.parentWidth * (2/3));

        globalScales.wages
            .range([dimensions.height * .9, dimensions.height * .15]);

        var jScale = globalScales.jobCountCompanies
            .range([dimensions.height * .9, dimensions.height * .15]);


        var jobTicks = jScale.ticks(5);
        var wageTicks = globalScales.wages.ticks(5);

        var plots = container.select('.plots');
        var tooltipElement = d3.select('#tooltip');

        var p = plots.selectAll('line.job')
            .data(aggregatedData);
        p
            .enter()
            .append('line')
            .attr('class','job')
            .attr('id',function(d,i){return 'job-'+i;})
            .merge(p)
            .transition()
            .attr('y2',function(d){ return jScale(d['jobCount']); })
            .attr('x2',dimensions.width * .8)
            .attr('y1',function(d){ return globalScales.wages(d['avgWage']); })
            .attr('x1',dimensions.width * .2)
            .attr('stroke',function(d){return filters.selectedCompany == d['name'] ? colors.secondary[4]:'lightgrey';})
            .attr('opacity',function(d){return filters.selectedCompany == d['name']? .9:.65;})
            .attr('stroke-width',function(d){return filters.selectedCompany == d['name']? 4: 2.5})

        p.exit().remove();

        var p = plots.selectAll('line.job-hover')
            .data(aggregatedData);
        p
            .enter()
            .append('line')
            .attr('class','job-hover')
            .on('click', function(d){
                if(filters.selectedCompany != d['name']){
                    filters.selectedCompany = d['name'];
                }
                else{
                    filters.selectedCompany = null;
                }
                onUpdate();
            })
            .on('mouseover', function (d,i) {
                var html = d.name;
                var jScale = globalScales.jobCountCompanies;

                container.select('#job-'+i)
                    .attr('stroke-width',4).attr('stroke',colors.secondary[3]);
                tooltipElement.select('.tooltip-inner').html(html).style("opacity", .95);
                tooltipElement.transition()
                    .duration(200)
                    .style("opacity", .9);
                tooltipElement
                    .style("left", (d3.event.pageX + 40 ) + "px")
                    .style("top", (d3.event.pageY - 28) + "px");


                var g = container.select('g.hovered-data-label');

                g.selectAll('text').remove();
                g.selectAll('line').remove();

                g.append('line')
                    .attr('x1',dimensions.width * .2)
                    .attr('x2',dimensions.width * .15)
                    .attr('y1',globalScales.wages(d['avgWage']))
                    .attr('y2',globalScales.wages(d['avgWage']))
                    .attr('stroke',colors.secondary[3]);

                g.append('line')
                    .attr('x1',dimensions.width * .8)
                    .attr('x2',dimensions.width * .85)
                    .attr('y1',jScale(d['jobCount']))
                    .attr('y2',jScale(d['jobCount']))
                    .attr('stroke',colors.secondary[3]);

                g.append('text')
                    .attr('x', dimensions.width * .86)
                    .attr('y', jScale(d['jobCount']) + 5)
                    .attr('text-anchor','start')
                    .text(d3.format(',')(d['jobCount']))
                    .attr('fill',colors.secondary[3]);


                g.append('text')
                    .attr('x', dimensions.width * .14)
                    .attr('y', globalScales.wages(d['avgWage']) + 5)
                    .attr('text-anchor','end')
                    .text(d3.format('$,.0f')(d['avgWage']))
                    .attr('fill',colors.secondary[3]);


            })
            .on('mouseout', function (d,i) {
                container.select('#job-'+i)
                    .attr('stroke',filters.selectedCompany == d['name'] ? colors.secondary[4]:'lightgrey')
                    .attr('stroke-width',filters.selectedCompany == d['name']? 4: 2.5);

                var g = container.select('g.hovered-data-label');

                g.selectAll('text').remove();
                g.selectAll('line').remove();

                tooltipElement.transition()
                    .duration(500)
                    .style("opacity", 0);

                tooltipElement.style("left", 0)
                    .style("top", 0);
            })
            .merge(p)
            .attr('y2',function(d){ return jScale(d['jobCount']); })
            .attr('x2',dimensions.width * .8)
            .attr('y1',function(d){ return globalScales.wages(d['avgWage']); })
            .attr('x1',dimensions.width * .2)
            .attr('opacity',0)
            .attr('stroke','grey')
            .attr('stroke-width',15);

        p.exit().remove();

        container.select('line.jobs')
            .attr('y1', dimensions.height * .15)
            .attr('y2', dimensions.height * .9)
            .attr('x1', dimensions.width * .8)
            .attr('x2', dimensions.width * .8)
            .attr('stroke','lightgrey')

        container.select('line.wages')
            .attr('y1', dimensions.height * .15)
            .attr('y2', dimensions.height * .9)
            .attr('x1', dimensions.width * .2)
            .attr('x2', dimensions.width * .2)
            .attr('stroke','lightgrey')

        container.select('text.wage-title')
            .attr('text-anchor','middle')
            .attr('y',dimensions.height * .13)
            .attr('x',dimensions.width * .25)
            .attr('fill','lightgrey');

        container.select('text.job-title')
            .attr('text-anchor','middle')
            .attr('y',dimensions.height * .13)
            .attr('x',dimensions.width * .8)
            .attr('fill','lightgrey');

        container.select('text.title')
            .attr('text-anchor','middle')
            .text('Top '+aggregatedData.length+' Companies')
            .attr('y',dimensions.height * .05)
            .attr('x',dimensions.width /2);


        container.selectAll('g.job-ticks').remove();

        var g = container.selectAll('g.job-ticks')
            .data(jobTicks)
            .enter()
            .append('g');

        g.attr('class','job-ticks');
        g.append('line')
            .attr('x1',dimensions.width * .8)
            .attr('x2',dimensions.width * .85)
            .attr('y1',function(d){return jScale(d);})
            .attr('y2',function(d){return jScale(d);})
            .attr('stroke','lightgrey');

        g.append('text')
            .attr('x', dimensions.width * .86)
            .attr('y', function(d){return jScale(d) + 5;})
            .attr('fill','lightgrey')
            .text(function(d){return d3.format(",")(d);});

        g.exit().remove();

        container.selectAll('g.wage-ticks').remove();

        var g = container.selectAll('g.wage-ticks')
            .data(wageTicks)
            .enter()
            .append('g');

        g.attr('class','wage-ticks');
        g.append('line')
            .attr('x1',dimensions.width * .2)
            .attr('x2',dimensions.width * .15)
            .attr('y1',function(d){return globalScales.wages(d);})
            .attr('y2',function(d){return globalScales.wages(d);})
            .attr('stroke','lightgrey');

        g.append('text')
            .attr('text-anchor','end')
            .attr('x', dimensions.width * .14)
            .attr('y', function(d){return globalScales.wages(d) + 5;})
            .attr('fill','lightgrey')
            .text(function(d){return d3.format("$,")(d);});

        g.exit().remove();


        var g = container.select('g.selected-data-label');

        g.selectAll('text').remove();
        g.selectAll('line').remove();
        if(filters.selectedCompany){
            var point = _.find(aggregatedData, function (d) {
                return d['name'] == filters.selectedCompany;
            });


            g.append('line')
                .attr('x1',dimensions.width * .8)
                .attr('x2',dimensions.width * .85)
                .attr('y1',function(d){return jScale(point['jobCount']);})
                .attr('y2',function(d){return jScale(point['jobCount']);})

                .attr('stroke',colors.secondary[4]);

            g.append('line')
                .attr('x1',dimensions.width * .2)
                .attr('x2',dimensions.width * .15)
                .attr('y1',function(d){return globalScales.wages(point['avgWage']);})
                .attr('y2',function(d){return globalScales.wages(point['avgWage']);})
                .attr('stroke',colors.secondary[4]);

            g.append('text')
                .attr('x', dimensions.width * .86)

                .attr('y', jScale(point['jobCount']) + 5)
                .attr('text-anchor','start')
                .text(d3.format(',')(point['jobCount']))
                .attr('fill',colors.secondary[4]);


            g.append('text')
                .attr('x', dimensions.width * .14)
                .attr('y', globalScales.wages(point['avgWage']) + 5)
                .attr('text-anchor','end')
                .text(d3.format('$,.0f')(point['avgWage']))
                .attr('fill',colors.secondary[4]);


        }

    }


    function constructor(selection){
        selection.each(function (d, i) {
            container = d3.select(this);
            draw();
        });
    }

    constructor.dimensions = function (value) {
        if (!arguments.length) return dimensions;
        dimensions.parentHeight = value.height;
        dimensions.parentWidth = value.width;

        dimensions.width = value.width * (1/3.2);
        dimensions.height = value.height;

        return constructor;
    };
    constructor.colors = function (value) {
        if (!arguments.length) return colors;
        colors = value;
        return constructor;
    };
    constructor.filters = function (value) {
        if (!arguments.length) return filters;
        filters = value;
        return constructor;
    };
    constructor.scales = function (value) {
        if (!arguments.length) return scales;
        scales = value;
        return constructor;
    };
    constructor.data = function (value) {
        if (!arguments.length) return data;
        data = value;
        return constructor;
    };
    constructor.onUpdate = function (value) {
        if (!arguments.length) return onUpdate;
        _onUpdateCallbacks = value;
        return constructor;
    };
    constructor.draw = draw;


    return constructor;
};

h1b.jobStats = function () {
    var container, data;

    var dimensions = {
        width:0,
        height:0
    };

    var colors = {

    };

    var filters = {

    };

    var scales = {
        jobCount: d3.scaleLog(),
        wages: d3.scaleLinear()
    };
    var _onUpdateCallbacks = [];

    function onUpdate(){
        data.execFilters();

        //then
        draw();

        //then handle callbacks
        _onUpdateCallbacks.forEach(function(f){
            f();
        })

    }
    function draw(){
        var aggregatedData = data.aggregateForJobs();
        var globalScales = data.scales();

        container.attr('width',dimensions.width)
            .attr('height',dimensions.height);

        globalScales.wages
            .range([dimensions.height * .9, dimensions.height * .15]);

        var jScale = globalScales.jobCountJobTypes
            .range([dimensions.height * .9, dimensions.height * .15]);

        var jobTicks = jScale.ticks(5);
        var wageTicks = globalScales.wages.ticks(5);

        var plots = container.select('.plots');

        var p = plots.selectAll('line.job')
            .data(aggregatedData);
        p
            .enter()
            .append('line')
            .attr('class','job')
            .attr('id',function(d,i){return 'job-'+i;})
            .merge(p)
            .transition()
            .attr('y2',function(d){ return jScale(d['jobCount']); })
            .attr('x2',dimensions.width * .2)
            .attr('y1',function(d){ return globalScales.wages(d['avgWage']); })
            .attr('x1',dimensions.width * .8)
            .attr('stroke',function(d){return filters.selectedJobType == d['code'] ? colors.secondary[4]:'lightgrey';})
            .attr('opacity',function(d){return filters.selectedJobType == d['code']? .9:.65;})
            .attr('stroke-width',function(d){return filters.selectedJobType == d['code']? 4: 2.5});

        p.exit().remove();

        var p = plots.selectAll('line.job-hover')
            .data(aggregatedData);
        p
            .enter()
            .append('line')
            .attr('class','job-hover')
            .on('click', function(d){
                if(filters.selectedJobType != d['code']){
                    filters.selectedJobType = d['code'];
                }
                else{
                    filters.selectedJobType = null;
                }
                onUpdate();
            })
            .on('mouseover', function (d,i) {
                var tooltipElement = d3.select('#tooltip');
                var jScale = globalScales.jobCountJobTypes;

                var html = d.name;
                container.select('#job-'+i)
                    .attr('stroke-width',4).attr('stroke',colors.secondary[3]);
                tooltipElement.select('.tooltip-inner').html(html).style("opacity", 1);
                tooltipElement.transition()
                    .duration(200)
                    .style("opacity", .95);
                tooltipElement
                    .style("left", (d3.event.pageX + 40 ) + "px")
                    .style("top", (d3.event.pageY - 28) + "px");


                var g = container.select('g.hovered-data-label');

                g.selectAll('text').remove();
                g.selectAll('line').remove();

                g.append('line')
                    .attr('x1',dimensions.width * .8)
                    .attr('x2',dimensions.width * .85)
                    .attr('y1',globalScales.wages(d['avgWage']))
                    .attr('y2',globalScales.wages(d['avgWage']))
                    .attr('stroke',colors.secondary[3]);

                g.append('line')
                    .attr('x1',dimensions.width * .2)
                    .attr('x2',dimensions.width * .15)
                    .attr('y1',jScale(d['jobCount']))
                    .attr('y2',jScale(d['jobCount']))
                    .attr('stroke',colors.secondary[3]);

                g.append('text')
                    .attr('x', dimensions.width * .14)
                    .attr('y', jScale(d['jobCount']) + 5)
                    .attr('text-anchor','end')
                    .text(d3.format(',')(d['jobCount']))
                    .attr('fill',colors.secondary[3]);


                g.append('text')
                    .attr('x', dimensions.width * .86)
                    .attr('y', globalScales.wages(d['avgWage']) + 5)
                    .attr('text-anchor','start')
                    .text(d3.format('$,.0f')(d['avgWage']))
                    .attr('fill',colors.secondary[3]);

            })
            .on('mouseout', function (d,i) {
                var tooltipElement = d3.select('#tooltip');

                container.select('#job-'+i)
                    .attr('stroke',filters.selectedJobType == d['code'] ? colors.secondary[4]:'lightgrey')
                    .attr('stroke-width',filters.selectedJobType == d['code']? 4: 2.5);

                var g = container.select('g.hovered-data-label');

                g.selectAll('text').remove();
                g.selectAll('line').remove();

                tooltipElement.transition()
                    .duration(500)
                    .style("opacity", 0);

                tooltipElement.style("left", 0)
                    .style("top", 0);
            })
            .merge(p)
            .attr('y2',function(d){ return jScale(d['jobCount']); })
            .attr('x2',dimensions.width * .2)
            .attr('y1',function(d){ return globalScales.wages(d['avgWage']); })
            .attr('x1',dimensions.width * .8)
            .attr('opacity',0)
            .attr('stroke','grey')
            .attr('stroke-width',15);

        p.exit().remove();

        container.select('line.jobs')
            .attr('y1', dimensions.height * .15)
            .attr('y2', dimensions.height * .9)
            .attr('x1', dimensions.width * .2)
            .attr('x2', dimensions.width * .2)
            .attr('stroke','lightgrey');

        container.select('line.wages')
            .attr('y1', dimensions.height * .15)
            .attr('y2', dimensions.height * .9)
            .attr('x1', dimensions.width * .8)
            .attr('x2', dimensions.width * .8)
            .attr('stroke','lightgrey');

        container.select('text.wage-title')
            .attr('text-anchor','middle')
            .attr('y',dimensions.height * .13)
            .attr('x',dimensions.width * .75)
            .attr('fill','lightgrey');

        container.select('text.job-title')
            .attr('text-anchor','middle')
            .attr('y',dimensions.height * .13)
            .attr('x',dimensions.width * .2)
            .attr('fill','lightgrey');

        container.select('text.title')
            .attr('text-anchor','middle')
            .text('Job Types')
            .attr('y',dimensions.height * .05)
            .attr('x',dimensions.width /2);

        container.select('.attribute-legend').selectAll('g.job-ticks').remove();

        var g = container.select('.attribute-legend').selectAll('g.job-ticks')
            .data(jobTicks)
            .enter()
            .append('g');

        g.attr('class','job-ticks');
        g.append('line')
            .attr('x1',dimensions.width * .2)
            .attr('x2',dimensions.width * .15)
            .attr('y1',function(d){return jScale(d);})
            .attr('y2',function(d){return jScale(d);})
            .attr('stroke','lightgrey');

        g.append('text')
            .attr('text-anchor','end')
            .attr('x', dimensions.width * .14)
            .attr('y', function(d){return jScale(d) + 5;})
            .attr('fill','lightgrey')
            .text(function(d){return d3.format(",")(d);});

        g.exit().remove();

        container.select('.attribute-legend').selectAll('g.wage-ticks').remove();

        var g = container.select('.attribute-legend').selectAll('g.wage-ticks')
            .data(wageTicks)
            .enter()
            .append('g');

        g.attr('class','wage-ticks');
        g.append('line')
            .attr('x1',dimensions.width * .8)
            .attr('x2',dimensions.width * .85)
            .attr('y1',function(d){return globalScales.wages(d);})
            .attr('y2',function(d){return globalScales.wages(d);})
            .attr('stroke','lightgrey');

        g.append('text')
            .attr('text-anchor','start')
            .attr('x', dimensions.width * .86)
            .attr('y', function(d){return globalScales.wages(d) + 5;})
            .attr('fill','lightgrey')
            .text(function(d){return d3.format("$,")(d);});

        g.exit().remove();

        var g = container.select('g.selected-data-label');

        g.selectAll('text').remove();
        g.selectAll('line').remove();
        if(filters.selectedJobType){
            var point = _.find(aggregatedData, function (d) {
                return d['code'] == filters.selectedJobType;
            });


            g.append('line')
                .attr('x1',dimensions.width * .8)
                .attr('x2',dimensions.width * .85)
                .attr('y1',function(d){return globalScales.wages(point['avgWage']);})
                .attr('y2',function(d){return globalScales.wages(point['avgWage']);})
                .attr('stroke',colors.secondary[4]);

            g.append('line')
                .attr('x1',dimensions.width * .2)
                .attr('x2',dimensions.width * .15)
                .attr('y1',function(d){return jScale(point['jobCount']);})
                .attr('y2',function(d){return jScale(point['jobCount']);})
                .attr('stroke',colors.secondary[4]);

            g.append('text')
                .attr('x', dimensions.width * .14)
                .attr('y', jScale(point['jobCount']) + 5)
                .attr('text-anchor','end')
                .text(d3.format(',')(point['jobCount']))
                .attr('fill',colors.secondary[4]);


            g.append('text')
                .attr('x', dimensions.width * .86)
                .attr('y', globalScales.wages(point['avgWage']) + 5)
                .attr('text-anchor','start')
                .text(d3.format('$,.0f')(point['avgWage']))
                .attr('fill',colors.secondary[4]);


        }



    }

    function constructor(selection){
        selection.each(function (d, i) {
            container = d3.select(this);
            draw();
        });
    }

    constructor.dimensions = function (value) {
        if (!arguments.length) return dimensions;
        dimensions.parentHeight = value.height;
        dimensions.parentWidth = value.width;

        dimensions.width = value.width * (1/3.2);
        dimensions.height = value.height;

        return constructor;
    };
    constructor.colors = function (value) {
        if (!arguments.length) return colors;
        colors = value;
        return constructor;
    };
    constructor.filters = function (value) {
        if (!arguments.length) return filters;
        filters = value;
        return constructor;
    };
    constructor.scales = function (value) {
        if (!arguments.length) return scales;
        scales = value;
        return constructor;
    };
    constructor.data = function (value) {
        if (!arguments.length) return data;
        data = value;
        return constructor;
    };
    constructor.onUpdate = function (value) {
        if (!arguments.length) return onUpdate;
        _onUpdateCallbacks = value;
        return constructor;
    };
    constructor.draw = draw;
    constructor.drawFilterDescription = function(){};

    return constructor;
};

h1b.panels = function(){
    var container, data;

    var dimensions = {
        width:0,
        height:0
    };

    var colors = {

    };

    var filters = {

    };

    var scales = {

    };

    var components = {
        map: this.map(),
        companyStats: this.companyStats(),
        //wageStats: this.wageStats(),
        jobStats: this.jobStats(),
        filterDescription: this.filterDescription()
    };
    var _onUpdateCallbacks = [components.filterDescription.draw];

    function draw(){
        container.attr('style','width:'+dimensions.width+'px;height:'+dimensions.height+'px;');
        components.map
            .dimensions(dimensions)
            .filters(filters)
            .colors(colors)
            .onUpdate(_onUpdateCallbacks.concat([components.companyStats.draw, components.jobStats.draw, components.filterDescription.draw]))
            .data(data);

        container.select('.map')
            .call(components.map);

        components.companyStats
            .dimensions(dimensions)
            .filters(filters)
            .colors(colors)
            .onUpdate(_onUpdateCallbacks.concat([components.map.draw, components.jobStats.draw, components.filterDescription.draw]))
            .data(data);

        container.select('.company-stats')
            .call(components.companyStats);

     /*   components.wageStats
            .dimensions(dimensions)
            .filters(filters)
            .colors(colors)
            .onUpdate(_onUpdateCallbacks.concat([components.map.draw,components.companyStats.draw]))
            .data(data);

        container.select('.wage-stats')
            .call(components.wageStats);
*/
        components.jobStats
            .dimensions(dimensions)
            .filters(filters)
            .colors(colors)
            .onUpdate(_onUpdateCallbacks.concat([components.map.draw,components.companyStats.draw, components.filterDescription.draw]))
            .data(data);

        container.select('.job-stats')
            .call(components.jobStats);

        components.filterDescription
            .dimensions(dimensions)
            .filters(filters)
            .colors(colors)
            .onUpdate(_onUpdateCallbacks.concat([components.map.draw,components.companyStats.draw, components.jobStats.draw]))
            .data(data);
        container.select('.filter-description')
            .call(components.filterDescription);
    }

    function constructor(selection){
        selection.each(function (d, i) {
            container = d3.select(this);
            draw();
        });
    }

    constructor.dimensions = function (value) {
        if (!arguments.length) return dimensions;
        dimensions.parentHeight = value.height;
        dimensions.parentWidth = value.width;

        dimensions.width = value.width;
        dimensions.height = value.height * (9/10);

        return constructor;
    };
    constructor.colors = function (value) {
        if (!arguments.length) return colors;
        colors = value;
        return constructor;
    };
    constructor.filters = function (value) {
        if (!arguments.length) return filters;
        filters = value;
        return constructor;
    };
    constructor.scales = function (value) {
        if (!arguments.length) return scales;
        scales = value;
        return constructor;
    };
    constructor.data = function (value) {
        if (!arguments.length) return data;
        data = value;
        return constructor;
    };
    constructor.onUpdate = function (value) {
        if (!arguments.length) return onUpdate;
        _onUpdateCallbacks = value;
        return constructor;
    };

    return constructor;
};

h1b.jobList = function(){
    var container, data;

    var dimensions = {
        width:0,
        height:0
    };

    var colors = {

    };

    var filters = {

    };

    var scales = {

    };

    function draw(){

    }

    function constructor(selection){
        selection.each(function (d, i) {
            data = d;
            container = d3.select(this);
            draw();
        });
    }

    constructor.dimensions = function (value) {
        if (!arguments.length) return dimensions;
        dimensions = value;
        return constructor;
    };
    constructor.colors = function (value) {
        if (!arguments.length) return colors;
        colors = value;
        return constructor;
    };
    constructor.filters = function (value) {
        if (!arguments.length) return filters;
        filters = value;
        return constructor;
    };
    constructor.scales = function (value) {
        if (!arguments.length) return scales;
        scales = value;
        return constructor;
    };
    constructor.data = function (value) {
        if (!arguments.length) return data;
        data = value;
        return constructor;
    };
    return constructor;
};

h1b.jobListPagination = function(){
    var container, data;

    var dimensions = {
        width:0,
        height:0
    };

    var colors = {

    };

    var filters = {

    };

    var scales = {

    };

    function draw(){

    }

    function constructor(selection){
        selection.each(function (d, i) {
            data = d;
            container = d3.select(this);
            draw();
        });
    }

    constructor.dimensions = function (value) {
        if (!arguments.length) return dimensions;
        dimensions = value;
        return constructor;
    };
    constructor.colors = function (value) {
        if (!arguments.length) return colors;
        colors = value;
        return constructor;
    };
    constructor.filters = function (value) {
        if (!arguments.length) return filters;
        filters = value;
        return constructor;
    };
    constructor.scales = function (value) {
        if (!arguments.length) return scales;
        scales = value;
        return constructor;
    };
    constructor.data = function (value) {
        if (!arguments.length) return data;
        data = value;
        return constructor;
    };
    return constructor;
};

h1b.display = function(){
    var container, data;

    var dimensions = {
        width:0,
        height:0
    };

    var colors = {
        primary:[
            '#f0f9e8',
            '#ccebc5',
            '#a8ddb5',
            '#7bccc4',
            '#43a2ca',
            '#0868ac'
        ],
        secondary:[
'#feebe2',
'#fcc5c0',
'#fa9fb5',
'#f768a1',
'#c51b8a',
'#7a0177'

       /*     '#feedde',
            '#fdd0a2',
            '#fdae6b',
            '#fd8d3c',
            '#e6550d',
            '#a63603'
      */  ],
        tertiary:[
            '#FFECAA',
            '#D4BC6A',
            '#AA9039',
            '#806715',
            '#554200'
        ],
        quaternary:[
            '#FFBAAA',
            '#D47F6A',
            '#AA4E39',
            '#802A15',
            '#551000'
        ],
        blackWhite:[
            '#f7f7f7',
            '#d9d9d9',
            '#bdbdbd',
            '#969696',
            '#636363',
            '#252525'
        ]
    };

    var filters = {
        mapContext:'state',
        selectedState:null,
        selectedCounty:null,
        selectedCompany:null,
        selectedJobType:null,
        selectedWageRange:null
    };

    var scales = {
        wageColors:d3.scaleThreshold(),
        jobCounts:d3.scaleThreshold()
    };

    var components = {
        title: this.title(),
        panels: this.panels(),
        jobList: this.jobList(),
        jobListPagination: this.jobListPagination()
    };

    function draw(){
        container.style('background-color',colors.blackWhite[5]);
        components.title
            .dimensions(dimensions)
            .filters(filters)
            .colors(colors);

        components.panels
            .dimensions(dimensions)
            .filters(filters)
            .colors(colors)
            .data(data);

        components.jobList
            .dimensions(dimensions)
            .filters(filters)
            .colors(colors)
            .data(data);
        components.jobListPagination
            .dimensions(dimensions)
            .filters(filters)
            .colors(colors)
            .data(data);

        container.select('.title')
            .call(components.title);
        container.select('.panels')
            .call(components.panels);

        container.select('.job-list')
            .call(components.jobList);
        container.selectAll('.job-list-pagination')
            .call(components.jobListPagination);
    }

    function constructor(selection){
        selection.each(function (d, i) {
            data = h1b.dataMunger(d, filters);
            container = d3.select(this);
            draw();
        });
    }

    constructor.dimensions = function (value) {
        if (!arguments.length) return dimensions;
        dimensions = value;
        return constructor;
    };
    constructor.colors = function (value) {
        if (!arguments.length) return colors;
        colors = value;
        return constructor;
    };
    constructor.filters = function (value) {
        if (!arguments.length) return filters;
        filters = value;
        return constructor;
    };
    constructor.scales = function (value) {
        if (!arguments.length) return scales;
        scales = value;
        return constructor;
    };

    return constructor;
};