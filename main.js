// main.js

//////////////////////
// 1) Load the CSV  //
//////////////////////
d3.csv("data/Mouse_Data_Student_Copy.csv")
  .then(rawData => {
    // For each row, add a "minute" index
    rawData.forEach((row, i) => {
      row.minute = i;
    });

    // Reshape from wide (f1,f2...) => long array
    const longData = [];
    rawData.forEach(row => {
      const minVal = +row.minute;
      Object.keys(row).forEach(col => {
        if (col === "minute") return;
        const val = row[col];
        if (val !== undefined && val !== "") {
          longData.push({
            mouseID: col,
            minute: minVal,
            temperature: +val
          });
        }
      });
    });

    // For convenience, let's get a list of distinct mouse IDs
    const allMice = [...new Set(longData.map(d => d.mouseID))];

    /////////////////////////////////
    // 2) Draw Each Exploratory Chart
    /////////////////////////////////
    createMultiLineChart(longData, allMice, "#chart1");
    createSingleMouseLine(longData, "f1", "#chart2");
    createBarChartAvgTemp(longData, allMice, "#chart3");
    createDayNightComparison(longData, "f1", "#chart4");
    createBrushZoomChart(longData, "f2", "#chart5");
    
    // If you want more charts, define & call more functions:
    // createSomeOtherChart(..., "#chart6");

  })
  .catch(err => {
    console.error("Error loading CSV:", err);
  });


//////////////////////////////////////////////////////
// 2.1) Multi‐Line Chart: All Mice in One Chart     //
//////////////////////////////////////////////////////
function createMultiLineChart(data, allMice, container) {
  const width = 800, height = 300;
  const margin = { top: 30, right: 120, bottom: 50, left: 60 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const svg = d3.select(container)
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // Group data by mouseID
  const nested = d3.groups(data, d => d.mouseID);

  // x/y domain
  const xExtent = d3.extent(data, d => d.minute);
  const yExtent = d3.extent(data, d => d.temperature);

  const xScale = d3.scaleLinear().domain(xExtent).range([0, innerWidth]);
  const yScale = d3.scaleLinear().domain(yExtent).range([innerHeight, 0]).nice();

  // color scale
  const colorScale = d3.scaleOrdinal()
    .domain(allMice)
    .range(d3.schemeCategory10);

  // line generator
  const line = d3.line()
    .x(d => xScale(d.minute))
    .y(d => yScale(d.temperature));

  // draw path for each mouse
  nested.forEach(([mID, recs]) => {
    recs.sort((a,b) => d3.ascending(a.minute, b.minute));
    g.append("path")
      .datum(recs)
      .attr("fill", "none")
      .attr("stroke", colorScale(mID))
      .attr("stroke-width", 1.2)
      .attr("d", line)
      .attr("opacity", 0.85);
  });

  // axes
  const xAxis = d3.axisBottom(xScale).ticks(10);
  const yAxis = d3.axisLeft(yScale).ticks(6);

  g.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(xAxis);

  g.append("g")
    .attr("class", "axis")
    .call(yAxis);

  // title
  g.append("text")
    .attr("x", innerWidth / 2)
    .attr("y", -10)
    .attr("text-anchor", "middle")
    .style("font-size", "14px")
    .text("Multi‐Line: All Mice Temperature Over Time");

  // legend
  const legend = svg.append("g")
    .attr("transform", `translate(${width - margin.right + 20}, ${margin.top})`);
  allMice.forEach((m, i) => {
    const yPos = i * 20;
    legend.append("rect")
      .attr("class", "legend-rect")
      .attr("x", 0)
      .attr("y", yPos)
      .attr("width", 12)
      .attr("height", 12)
      .attr("fill", colorScale(m));
    legend.append("text")
      .attr("class", "legend-item")
      .attr("x", 20)
      .attr("y", yPos + 10)
      .style("font-size", "12px")
      .text(m);
  });
}


//////////////////////////////////////////////////////
// 2.2) Single Mouse Line Chart                      //
//////////////////////////////////////////////////////
function createSingleMouseLine(data, mouseID, container) {
  // Filter data for just this mouse
  const filtered = data.filter(d => d.mouseID === mouseID);

  const width = 400, height = 300;
  const margin = { top: 30, right: 20, bottom: 40, left: 50 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const svg = d3.select(container)
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // domains
  const xExtent = d3.extent(filtered, d => d.minute);
  const yExtent = d3.extent(filtered, d => d.temperature);

  const xScale = d3.scaleLinear().domain(xExtent).range([0, innerWidth]);
  const yScale = d3.scaleLinear().domain(yExtent).range([innerHeight, 0]).nice();

  const line = d3.line()
    .x(d => xScale(d.minute))
    .y(d => yScale(d.temperature));

  filtered.sort((a,b) => d3.ascending(a.minute, b.minute));
  g.append("path")
    .datum(filtered)
    .attr("fill", "none")
    .attr("stroke", "steelblue")
    .attr("stroke-width", 1.5)
    .attr("d", line);

  // axes
  const xAxis = d3.axisBottom(xScale).ticks(5);
  const yAxis = d3.axisLeft(yScale).ticks(5);

  g.append("g")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(xAxis);

  g.append("g").call(yAxis);

  // title
  g.append("text")
    .attr("x", innerWidth / 2)
    .attr("y", -10)
    .attr("text-anchor", "middle")
    .style("font-size", "13px")
    .text(`Single Mouse (${mouseID}) Temp Over Time`);
}


//////////////////////////////////////////////////////
// 2.3) Bar Chart: Avg Temperature by Mouse         //
//////////////////////////////////////////////////////
function createBarChartAvgTemp(data, allMice, container) {
  // Group by mouse, compute average temperature
  const avgByMouse = d3.rollups(
    data,
    v => d3.mean(v, d => d.temperature),
    d => d.mouseID
  );
  // => [ [ 'f1', 37.32 ], [ 'f2', 37.22 ], ...]

  // Sort by mouseID or by average, if you like
  avgByMouse.sort((a,b) => d3.ascending(a[0], b[0])); 
  // a[0] is the mouseID, a[1] is the avg

  const width = 500, height = 300;
  const margin = { top: 30, right: 20, bottom: 70, left: 60 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const svg = d3.select(container)
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // x scale (mouse IDs)
  const x = d3.scaleBand()
    .domain(avgByMouse.map(d => d[0]))
    .range([0, innerWidth])
    .padding(0.2);

  // y scale (average temp)
  const y = d3.scaleLinear()
    .domain([0, d3.max(avgByMouse, d => d[1])])
    .range([innerHeight, 0])
    .nice();

  // bars
  g.selectAll("rect")
    .data(avgByMouse)
    .enter()
    .append("rect")
    .attr("x", d => x(d[0]))
    .attr("width", x.bandwidth())
    .attr("y", d => y(d[1]))
    .attr("height", d => innerHeight - y(d[1]))
    .attr("fill", "tomato");

  // axes
  const xAxis = d3.axisBottom(x);
  const yAxis = d3.axisLeft(y).ticks(5);

  g.append("g")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(xAxis)
    .selectAll("text")
      .style("text-anchor", "middle");

  g.append("g")
    .call(yAxis);

  // Title
  g.append("text")
    .attr("x", innerWidth / 2)
    .attr("y", -5)
    .attr("text-anchor", "middle")
    .style("font-size", "14px")
    .text("Average Temperature by Mouse");
}


//////////////////////////////////////////////////////
// 2.4) Day vs. Night Comparison (Single Mouse)     //
//////////////////////////////////////////////////////
function createDayNightComparison(data, mouseID, container) {
  // For each row, define "dayOrNight" based on minute % 1440
  // Suppose first 720 minutes is "night", next 720 is "day" (or vice versa).
  // Mice are typically more active in dark, so adapt logic as needed.
  const newData = data.filter(d => d.mouseID === mouseID).map(d => {
    const minOfDay = d.minute % 1440; 
    return {
      ...d,
      dayOrNight: (minOfDay < 720) ? "Night" : "Day"
    };
  });

  // Group by dayOrNight, compute average temperature
  const grouped = d3.rollups(
    newData,
    v => d3.mean(v, d => d.temperature),
    d => d.dayOrNight
  );
  // => [ [ 'Night', 37.12 ], [ 'Day', 37.52 ] ] for example

  // Setup chart
  const width = 300, height = 300;
  const margin = { top: 30, right: 20, bottom: 40, left: 50 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const svg = d3.select(container)
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // x scale
  const x = d3.scaleBand()
    .domain(["Night","Day"])
    .range([0, innerWidth])
    .padding(0.2);

  const maxTemp = d3.max(grouped, d => d[1]);
  const y = d3.scaleLinear()
    .domain([0, maxTemp])
    .range([innerHeight, 0])
    .nice();

  // bars
  g.selectAll("rect")
    .data(grouped)
    .enter()
    .append("rect")
    .attr("x", d => x(d[0]))
    .attr("width", x.bandwidth())
    .attr("y", d => y(d[1]))
    .attr("height", d => innerHeight - y(d[1]))
    .attr("fill", d => d[0] === "Night" ? "darkblue" : "gold");

  // axes
  const xAxis = d3.axisBottom(x);
  const yAxis = d3.axisLeft(y).ticks(5);

  g.append("g")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(xAxis);

  g.append("g").call(yAxis);

  // Title
  g.append("text")
    .attr("x", innerWidth / 2)
    .attr("y", -5)
    .attr("text-anchor", "middle")
    .style("font-size", "13px")
    .text(`Day/Night Avg Temp (${mouseID})`);
}


//////////////////////////////////////////////////////
// 2.5) Brush/Zoom Chart (In‐Progress Dynamic Demo) //
//////////////////////////////////////////////////////
function createBrushZoomChart(data, mouseID, container) {
  // Filter for one mouse
  const filtered = data.filter(d => d.mouseID === mouseID);
  filtered.sort((a,b) => d3.ascending(a.minute, b.minute));

  const width = 600, height = 300;
  const margin = { top: 30, right: 20, bottom: 50, left: 60 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const svg = d3.select(container)
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // Scales
  const xScale = d3.scaleLinear()
    .domain(d3.extent(filtered, d => d.minute))
    .range([0, innerWidth]);

  const yScale = d3.scaleLinear()
    .domain(d3.extent(filtered, d => d.temperature))
    .range([innerHeight, 0])
    .nice();

  // Axes
  const xAxis = d3.axisBottom(xScale).ticks(10);
  const yAxis = d3.axisLeft(yScale).ticks(5);

  // Draw line
  const lineGen = d3.line()
    .x(d => xScale(d.minute))
    .y(d => yScale(d.temperature));

  const linePath = g.append("path")
    .datum(filtered)
    .attr("fill", "none")
    .attr("stroke", "purple")
    .attr("stroke-width", 1.5)
    .attr("d", lineGen);

  // Axes groups
  const xAxisG = g.append("g")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(xAxis);

  const yAxisG = g.append("g")
    .call(yAxis);

  // Title
  g.append("text")
    .attr("x", innerWidth / 2)
    .attr("y", -10)
    .attr("text-anchor", "middle")
    .style("font-size", "13px")
    .text(`Brush/Zoom Prototype (${mouseID})`);

  // Brush
  const brush = d3.brushX()
    .extent([[0,0], [innerWidth,innerHeight]])
    .on("end", brushed);

  g.append("g")
    .attr("class", "brush")
    .call(brush);

  function brushed(event) {
    const selection = event.selection;
    if (!selection) return; // user clicked outside or cleared brush

    const [x0, x1] = selection;
    // Invert screen coords back to data domain
    const minX = xScale.invert(x0);
    const maxX = xScale.invert(x1);

    // Update domain
    xScale.domain([minX, maxX]);

    // Re-render line and x-axis
    linePath.attr("d", lineGen);
    xAxisG.call(xAxis);

    // Clear the brush selection
    g.select(".brush").call(brush.move, null);
  }
}