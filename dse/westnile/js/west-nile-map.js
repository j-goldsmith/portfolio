'use strict';
var westNileMap = {};
westNileMap.title = function(){
    function draw(container){
        container
            .append('text')
            .attr('class','display-3')
            .attr('x','50%')
            .attr('y','50%')
            .attr('text-anchor','middle')
            .attr('alignment-baseline',"middle" )
            .html('The West Nile Virus');
    }
    function constructor(selection){
        selection.each(function (data, i) {
            draw(d3.select(this));
        });
    }

    return constructor;
};

westNileMap.filter = function(){
    var dimensions = {
        height:200,
        width:600
    };
    var colors = {};
    var filters = {};
    var ranges = {
        yearRange:[2006,2015],
        weekRange:[1,52]
    };
    var onUpdate_cb = function(){

    };
    var onUpdate = function(){
        onUpdate_cb();
        draw();
    };
    var barWidth;
    var rawData;
    var filteredData;
    var transformedData;
    var rootContainer;
    function transformData(data){
        var results = {};
        var weekMin = ranges.weekRange[0];
        var weekMax = ranges.weekRange[1];
        var yearMin = ranges.yearRange[0];
        var yearMax = ranges.yearRange[1];

        for(var i = yearMin;i<=yearMax; i++){
            for(var j = weekMin; j <= weekMax; j++){
                var result = {year:i, week:j, positive_cases:0};
                results[i+'-'+j] = result;
            }
        }

        data.weeklyReportsByCounty.forEach(function(r){
            var idx = r.Year+'-'+r.Week_Reported;
            if(results[idx]){
                results[idx].positive_cases += r.Positive_Cases;
            }
        });


        return _.values(results);
    }

    function _dragStart(){
        var i = Math.round((d3.event.x - (dimensions.width*.025))/barWidth);
        var entry = transformedData[i]
        filters.yearMin = entry.year;
        filters.weekMin = entry.week;

        filters.yearMax = entry.year;
        filters.weekMax = entry.week;
        if(!entry){
            return;
        }
        onUpdate();
    }

    function _dragging(){
        var i = Math.round((d3.event.x - (dimensions.width*.025))/barWidth);
        var entry = transformedData[i];
        if(!entry){
            return;
        }
        if((filters.yearMin < entry.year) || (filters.yearMin == entry.year && filters.weekMin < entry.week)){
            filters.yearMax = entry.year;
            filters.weekMax = entry.week;
        }
        else{
            filters.yearMin = entry.year;
            filters.weekMin = entry.week;
        }
        onUpdate();
    }

    function _dragEnd(){

    }
    function build(container){

    }
    function draw(){
        var container = rootContainer;
        var data = rawData;
        transformedData = transformData(data);
        filteredData = transformedData;
        var yearOptions = function(){
            var results = [];
            for(var i = ranges.yearRange[0];i<=ranges.yearRange[1]; i++){
                results.push(i);
            }
            return results;
        }();

        var maxWeeklyCount = _.max(filteredData, function(d){ return d.positive_cases;}).positive_cases;

        var heightScale = d3.scaleLinear()
            .domain([0,maxWeeklyCount])
            .range([dimensions.height * .05, dimensions.height * .8]);


        barWidth = (dimensions.width * .95) / filteredData.length;

        var g = container.attr('width',dimensions.width).attr('height', dimensions.height);
        if(g.selectAll('text').empty()){
            g.append('text')
                .attr('transform','translate('+(dimensions.width * .01)+','+(dimensions.height - (dimensions.height*.03) - heightScale(0))+')')
                .attr('fill','lightgrey')
                .html(0);
            g.append('text')
                .attr('transform','translate('+(dimensions.width * .017)+','+(dimensions.height - (dimensions.height*.03) - heightScale(maxWeeklyCount/2) + 15)+') rotate(-90)')
                .attr('fill','lightgrey')
                .html('cases');
            g.append('text')
                .attr('transform','translate('+(dimensions.width * .01)+','+(dimensions.height - (dimensions.height*.03) - heightScale(maxWeeklyCount))+')')
                .attr('fill','lightgrey')
                .html(maxWeeklyCount);

            var yearMarkers = g.selectAll('text.years');
            yearMarkers.data(yearOptions)
                .enter()
                .append('text')
                .attr('transform',function(d,i){return 'translate('+((i*(barWidth*52))+ (dimensions.width*.025) + (barWidth*52/2 - 20))+',15)';})
                .attr('fill','lightgrey')
                .html(function(d){return d;});
        }




        var recordEntries = g.selectAll('g.record-entry');
        recordEntries.selectAll('rect.case-total-background')
            .attr('opacity',function(d){
                var greaterThanMin = (filters.yearMin < d.year) || (filters.yearMin == d.year && filters.weekMin < d.week);
                var lessThanMax = (filters.yearMax > d.year) || (filters.yearMax == d.year && filters.weekMax > d.week)
                if( greaterThanMin && lessThanMax ){
                    return .1;
                }
                else{
                    return 0;
                }
            });

        var entered = recordEntries.data(filteredData)
            .enter()
            .append("g")
            .attr('class','record-entry')
            .attr('height',dimensions.height);
        entered.append('rect')
            .attr('class','case-total-background')
            .attr('width',barWidth)
            .attr('stroke-opacity',0)
            .attr('x', function(d,i){ return (i * barWidth) + (dimensions.width*.025);})
            .attr('y', function(d,i){ return dimensions.height - (dimensions.height*.05) - heightScale(74);})
            .attr('height',function(d){return heightScale(74); })
            .attr('opacity',function(d){
                var greaterThanMin = (filters.yearMin < d.year) || (filters.yearMin == d.year && filters.weekMin < d.week);
                var lessThanMax = (filters.yearMax > d.year) || (filters.yearMax == d.year && filters.weekMax > d.week)
                if( greaterThanMin && lessThanMax ){
                    return .1;
                }
                else{
                    return 0;
                }
            })
            .style("fill", function (d) {
                return 'grey';
            });
        entered.append('rect')
            .attr('class','case-totals')
            .attr('width',barWidth)
            .attr('x', function(d,i){ return (i * barWidth) + (dimensions.width*.025);})
            .attr('y', function(d,i){ return dimensions.height - (dimensions.height*.05) - heightScale(d.positive_cases);})
            .attr('height',function(d){return heightScale(d.positive_cases); })
            .style("fill", function (d) {
                return 'lightgrey';
            }).exit()
            .remove();

        var drag_behavior = d3.drag()
            .on("start", _dragStart)
            .on("drag", _dragging);
        var seasonMarkers = g
            .selectAll("rect.seasons")
            .data(filteredData)
            .enter()
            .append("rect")
            .attr('class','seasons')
            .attr('width',barWidth)
            .attr('height',(dimensions.height*.05))
            .attr('x', function(d,i){ return (i * barWidth) + (dimensions.width*.025);})
            .attr('y', function(d,i) { return dimensions.height - (dimensions.height*.05); })
            .style("fill", function (d) {
                if(d.week >= 49 || d.week < 10){
                    return colors.categorical[1];
                }
                if(d.week >= 10 && d.week < 24){
                    return colors.categorical[0];
                }
                if(d.week >= 24 && d.week < 37){
                    return colors.categorical[3];
                }
                if(d.week >= 37 && d.week < 49){
                    return colors.categorical[2];
                }
            })
            .exit()
            .remove();

        if(g.select('rect.hover-entry').empty()){
            g.append('rect')
                .attr('width',dimensions.width)
                .attr('height',dimensions.height)
                .attr('fill-opacity',0)
                .attr('stroke-opacity',0)
                .attr('class','hover-entry')
                .on('contextmenu', function(){
                    d3.event.preventDefault();
                    filters.yearMin = 2006;
                    filters.weekMin = 1;
                    filters.yearMax = 2015;
                    filters.weekMax = 52;

                    onUpdate();
                })
                .call(drag_behavior);
        }
    }

    function constructor(selection){
        selection.each(function (data, i) {
            rawData = data;
            rootContainer = d3.select(this);
            build(d3.select(this));
            draw(d3.select(this), data);
        });
    }
    constructor.width = function (value) {
        if (!arguments.length) return dimensions.width;
        dimensions.width = value;
        return constructor;
    };
    constructor.height = function (value) {
        if (!arguments.length) return dimensions.height;
        dimensions.height = value;
        return constructor;
    };
    constructor.filters = function (value) {
        if (!arguments.length) return filters;
        filters = value;
        return constructor;
    };
    constructor.colors = function (value) {
        if (!arguments.length) return colors;
        colors = value;
        return constructor;
    };
    constructor.onUpdate = function (value) {
        if (!arguments.length) return onUpdate;
        onUpdate_cb = value;
        return constructor;
    };
    return constructor;
};

westNileMap.legend = function(){
    var dimensions = {
        height:600,
        width:100
    },
        colorScale = function(){ return 'lightgrey';},
        colors = {},
        rootContainer = null,
        rawData = null;

    function build(){

        rootContainer.attr('viewBox', '0 50 '+dimensions.width+' '+' '+dimensions.height)
        .attr('preserveAspectRatio', 'xMidYMid meet')
        rootContainer.append('text')
            .attr('font-size',dimensions.width/40  > 10 ? dimensions.width/40:10)
            .attr('x','50%')
            .attr('y','10%')
            .attr('width',dimensions.width)
            .attr('height',dimensions.height)
            .attr('text-anchor','middle')   
            .selectAll('tspan')
            .data(['\'West Nile is a virus most commonly spread to people by mosquito bites. ',
                'In North America, cases of West Nile virus (WNV) occur during mosquito season, ',
                'which starts in the summer and continues through fall. WNV cases have been reported ',
                'in all of the continental United States. There are no vaccines to prevent or medications ',
                'to treat WNV. Fortunately, most people infected with WNV do not have symptoms.\'',
                '           - Centers for Disease Control and Prevention',
                '',
                'Explore confirmed cases of West Nile Virus in California with this visualization. ',
                'Click and drag along the bar chart to select different time periods. ',
                'Hover over the map for WNV case counts. Right click the bar chart to reset the date.'])
            .enter()
            .append('tspan')
            .attr('font-weight', '300')
            .attr('x','50%')
            .attr('y', function(d,i){return ((i+3)*25);})
            .text(function(d){return d;});
    }
    function draw(){
        var categories = [
            {season:'winter',color:colors.categorical[1]},
            {season:'spring',color:colors.categorical[0]},
            {season:'summer',color:colors.categorical[3]},
            {season:'fall',color:colors.categorical[2]}
        ];

        var countBins = [
            {label:'0', color:colors.sequential[0]},
            {label:'1 to 99', color:colors.sequential[1]},
            {label:'100 to 199', color:colors.sequential[2]},
            {label:'200 to 299', color:colors.sequential[3]},
            {label:'300+', color:colors.sequential[4]}
        ];

        var seasonWidth = (dimensions.width*.6) / 4,
            binWidth = (dimensions.width*.6) / 5;

         var countLegendContainer = rootContainer.append('g').attr('transform','translate('+(dimensions.width - binWidth*5) / 2+','+dimensions.height*.80+')');
        countLegendContainer.append('text')
            .attr('class','h5')
            .attr('x',binWidth*5 / 2 - binWidth*.85)
            .html('Confirmed Cases');
        var countElement = countLegendContainer
            .selectAll('svg.bins')
            .data(countBins)
            .enter()
            .append('svg')
            .attr('class','bins')
            .attr('width',binWidth)
            .attr('height',45)
            .attr('x',function(d,i){ return i*binWidth;}).attr('y',5);
        countElement.append('rect')
            .attr('width',binWidth)
            .attr('height',15)
            .attr('fill',function(d){return d.color;});
        countElement.append('text')
            .attr('x','50%')
            .attr('y','75%')
            .attr('text-anchor','middle')
            .attr('alignment-baseline',"middle" )
            .html(function(d){ return d.label;});

        var seasonContainer = rootContainer.append('g').attr('transform','translate('+(dimensions.width - seasonWidth*4) / 2+','+dimensions.height*.65+')');

        seasonContainer.append('text').attr('class','h5')
            .attr('x',seasonWidth*4 / 2 - seasonWidth*.35)
            .html('Seasons');

        var seasonElement = seasonContainer
            .selectAll('svg.seasons')
            .data(categories)
            .enter()
            .append('svg')
            .attr('class','seasons')
            .attr('width',seasonWidth)
            .attr('height', 45)
            .attr('x',function(d,i){ return (i*seasonWidth);})
            .attr('y',5);
        seasonElement.append('rect')
            .attr('width',seasonWidth)
            .attr('height',15)
            .attr('fill',function(d){return d.color;});
        seasonElement.append('text')
            .attr('x','50%')
            .attr('y','75%')
            .attr('text-anchor','middle')
            .attr('alignment-baseline',"middle" )
            .html(function(d){ return d.season;});
    }

    function constructor(selection){
        selection.each(function (data, i) {
            rootContainer = d3.select(this);
            rawData = data;

            build();
            draw();
        });
    }
    constructor.width = function (value) {
        if (!arguments.length) return dimensions.width;
        dimensions.width = value;
        return constructor;
    };
    constructor.height = function (value) {
        if (!arguments.length) return dimensions.height;
        dimensions.height = value;
        return constructor;
    };
    constructor.colorScale = function (value) {
        if (!arguments.length) return colorScale;
        colorScale = value;
        return constructor;
    };
    constructor.colors = function (value) {
        if (!arguments.length) return colors;
        colors = value;
        return constructor;
    };
    return constructor;
};

westNileMap.map = function(){
    var dimensions = {
            height:400,
            width:600
        },
        filters = {},
        colorScale = function(){ return 'lightgrey';},
        colors = {},
        rootContainer = null,
        rawData;

    function build(){
        rootContainer.append('text').attr('class','display-4');
        rootContainer.append('svg')
    }

    function filterData(data){
        return _.map(data.countyGeography.features, function(d){
           var reports = _.filter(data.weeklyReportsByCounty, function(r){
               var greaterThanMin = (filters.yearMin < r.Year) || (filters.yearMin == r.Year && filters.weekMin < r.Week_Reported);
               var lessThanMax = (filters.yearMax > r.Year) || (filters.yearMax == r.Year && filters.weekMax > r.Week_Reported)

               return r.County == d.properties.NAME && greaterThanMin && lessThanMax;

           });
           var cases = _.reduce(_.map(reports,function(r){return r.Positive_Cases;}), function(a,b){ return a + b});
           d.properties['positive_cases'] = cases;

           return d;
        });
    }

    function draw(){
        var svgElement = rootContainer.select('svg')
            .attr('width',dimensions.width)
            .attr('height',dimensions.height*.95),
        countyGroupElement = svgElement,
        tooltipElement = d3.select(".tooltip")
            .style("opacity", 0),
        projectionCenter = d3.geoCentroid(rawData.countyGeography),
        projection = d3.geoMercator()
            .scale(dimensions.width*1.25)
            .center(projectionCenter)
            .translate([
                dimensions.width * 3.5 / 12,
                dimensions.height*4.5/7
            ]),
        geoPath = d3.geoPath().projection(projection);

        var filteredData = filterData(rawData);
        rootContainer.select('text.display-4')
            .attr('text-anchor','middle') 
            .attr('style','height:'+(dimensions.height*.05)+'px')
            .attr('transform','translate('+dimensions.width * .3+','+dimensions.height*6.8/7+')')
            .html(function(){
                if(filters.yearMin != filters.yearMax){
                    return filters.yearMin + ' through '+ filters.yearMax;
                }else if(filters.weekMax - filters.weekMin == 0){
                    return '1 week in '+ filters.yearMin;
                } else{
                    return (filters.weekMax - filters.weekMin + 1) + ' weeks in '+ filters.yearMin;
                }

            });
        countyGroupElement
            .selectAll("path")
            .transition()
            .style("fill", function (d) {
                return d.properties.positive_cases > 0
                    ? colorScale(d.properties.positive_cases)
                    : colors.sequential[0];
            }).duration(100);

        countyGroupElement
            .selectAll("path").data(filteredData)
            .enter()
            .append("path")
            .attr("d", geoPath)
            .style("fill", function (d) {
                return d.properties.positive_cases > 0
                    ? colorScale(d.properties.positive_cases)
                    : colors.sequential[0];
            })
            .style('stroke', '#f7f7f7')
            .style('stroke-width', 0.3)
            .on('mouseover', function (d) {
                var html = d.properties.NAME + " <br />" + (d.properties.positive_cases ? d.properties.positive_cases : 0) + ' '+ (d.properties.positive_cases == 1 ? 'case':'cases');

                tooltipElement.transition()
                    .duration(200)
                    .style("opacity", .9);
                tooltipElement.html(html)
                    .style("left", (d3.event.pageX + 40 ) + "px")
                    .style("top", (d3.event.pageY - 28) + "px");

            })
            .on('mouseout', function (d) {
                tooltipElement.transition()
                    .duration(500)
                    .style("opacity", 0);
            })
            .exit()
            .remove();

        svgElement.call(
            d3.zoom()
                .scaleExtent([1, 8])
                .on("zoom", function () {
                    countyGroupElement.attr("transform", d3.event.transform);
                })
        );


    }

    function constructor(selection){
        selection.each(function (data, i) {
            rootContainer = d3.select(this);
            rawData = data;

            build();
            draw();
        });
    }

    constructor.width = function (value) {
        if (!arguments.length) return dimensions.width;
        dimensions.width = value;
        return constructor;
    };
    constructor.height = function (value) {
        if (!arguments.length) return dimensions.height;
        dimensions.height = value;
        return constructor;
    };
    constructor.filters = function (value) {
        if (!arguments.length) return filters;
        filters = value;
        return constructor;
    };
    constructor.colorScale = function (value) {
        if (!arguments.length) return colorScale;
        colorScale = value;
        return constructor;
    };
    constructor.colors = function (value) {
        if (!arguments.length) return colors;
        colors = value;
        return constructor;
    };
    constructor.draw = function (value) {
        if (!arguments.length) return draw;
        draw = value;
        return constructor;
    };

    return constructor;
};

westNileMap.display = function (){
    var dimensions = {
        width:600,
        height:600
    };

    var colors = {
        categorical:[
            '#7fc97f',
            '#beaed4',
            '#fdc086',
            '#ffff99'
        ],
        sequential:[
            '#f1eef6',
            '#bdc9e1',
            '#74a9cf',
            '#2b8cbe',
            '#045a8d'
        ],
        blackWhite:[
            '#f7f7f7',
            '#cccccc',
            '#969696',
            '#636363',
            '#252525'
        ]
    };

    var scales = {
        caseCount:d3.scaleQuantize().range([colors.sequential[1],colors.sequential[2],colors.sequential[3],colors.sequential[4]]),
        yearRange:[2006,2015],
        weekRange:[1,52]
    };

    var filters = {
        yearMin:2006,
        yearMax:2015,
        weekMin:1,
        weekMax:52
    };

    var components = {
        filter: this.filter(),
        legend: this.legend(),
        map: this.map(),
        title: this.title()
    };

    function setDomains(data){
        var groups = _.groupBy(data.weeklyReportsByCounty, function(d){return d.County;})
        var sums = _.map(_.values(groups), function(d){
            var cases = _.pluck(d, 'Positive_Cases');
            return _.reduce(cases, function(a,b){return a+b;})
        });
        scales.caseCount.domain([0,400])
    }

    function draw(container, data){
        container.attr('width',dimensions.width);
        container.attr('height',dimensions.height);

        components.filter
            .height(dimensions.height / 7)
            .width(dimensions.width)
            .filters(filters)
            .colors(colors)
            .onUpdate(components.map.draw());
        components.map
            .height(dimensions.height)
            .width(dimensions.width)
            .filters(filters)
            .colors(colors)
            .colorScale(scales.caseCount);
        components.legend
            .height(dimensions.height * 5 / 7)
            .width(dimensions.width * 5/12)
            .colors(colors)
            .colorScale(scales.caseCount);

        container.select('.filter')
            .attr('y', (dimensions.height /  7))
            .attr('width',dimensions.width)
            .attr('height',dimensions.height / 7)
            .call(components.filter);
        container.select('.legend')
            .attr('x',(dimensions.width * 7/12))
            .attr('y', (dimensions.height * 2 / 7))
            .attr('width',dimensions.width * 5/12)
            .attr('height',dimensions.height* 5 / 7)
            .call(components.legend);
        container.select('.map')
            .attr('x',0)
            .attr('y', 0)
            .attr('width',dimensions.width * 7/12)
            .attr('height',dimensions.height)
            .call(components.map);
        container.select('.title')
            .attr('width',dimensions.width)
            .attr('height',dimensions.height / 7)
            .call(components.title);
    }

    function constructor(selection){
        selection.each(function (data, i) {
            setDomains(data);
            draw(d3.select(this), data);
        });
    }

    constructor.width = function (value) {
        if (!arguments.length) return dimensions.width;
        dimensions.width = value;
        return constructor;
    };
    constructor.height = function (value) {
        if (!arguments.length) return dimensions.height;
        dimensions.height = value;
        return constructor;
    };

    return constructor;
}