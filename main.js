// main.js

////////////////////////////////////////////////////////////////////////
// 1) LOAD CSV, TRANSFORM (WIDE->LONG), AND STORE IN GLOBAL ARRAYS
////////////////////////////////////////////////////////////////////////
let fullData = [];
let allMice = [];

d3.csv("data/Mouse_Data_Student_Copy.csv").then(rawData => {
  console.log("Rows in CSV:", rawData.length);

  // Tag each row with a 'minute' index
  rawData.forEach((row, i) => {
    row.minute = i;
  });

  // Convert from wide to long
  rawData.forEach(row => {
    const minuteVal = +row.minute;
    Object.keys(row).forEach(col => {
      if (col === "minute") return;
      const val = row[col];
      if (val) {
        const tempNum = +val;
        if (!isNaN(tempNum)) {
          fullData.push({
            mouseID: col,
            minute: minuteVal,
            temperature: tempNum
          });
        }
      }
    });
  });

  // Distinct mouse IDs
  allMice = [...new Set(fullData.map(d => d.mouseID))];
  console.log("All Mice:", allMice);

  // Build checkboxes
  createMouseToggles(allMice);

  // Render the heatmap initially with all mice
  updateHeatmap();

}).catch(err => {
  console.error("Error loading CSV:", err);
});


//////////////////////////////////////////////////////////////
// 2) CREATE CHECKBOXES (mouse toggles) AND EVENT HANDLERS
//////////////////////////////////////////////////////////////
function createMouseToggles(mouseIDs) {
  const container = d3.select("#mouseToggles");
  container.selectAll("*").remove();

  container.append("p").text("Select which mice to display below:");

  mouseIDs.forEach(mID => {
    const label = container.append("label").style("margin-right", "10px");
    label.append("input")
      .attr("type", "checkbox")
      .attr("value", mID)
      .property("checked", true) // default: all checked
      .on("change", updateHeatmap);

    label.append("span").text(mID);
  });
}


//////////////////////////////////////////////////////////////
// 3) UPDATE THE HEATMAP WHEN CHECKBOXES CHANGE
//////////////////////////////////////////////////////////////
function updateHeatmap() {
  // Which mice are selected?
  const selected = [];
  d3.selectAll("#mouseToggles input[type=checkbox]").each(function() {
    if (this.checked) selected.push(this.value);
  });

  // Clear old chart
  d3.select("#heatmap").selectAll("*").remove();

  // If none selected
  if (!selected.length) {
    d3.select("#heatmap").append("p").text("No mice selected!");
    return;
  }

  // Filter global data for only these mice
  const filtered = fullData.filter(d => selected.includes(d.mouseID));

  // Build the new heatmap
  createHeatmap(filtered, selected);
}


//////////////////////////////////////////////////////////////
// 4) CREATE HEATMAP: DOWNSAMPLE, DRAW, CLIP, BRUSH, TOOLTIP,
//    PLUS AXIS LABELS & RESET BUTTON & MATCHED LEGEND
//////////////////////////////////////////////////////////////
function createHeatmap(data, selectedMice) {
  /////////////////////////////////////////////////////////////////////////
  // 4.1) DOWNSAMPLE: e.g. 20-minute bins for each (mouseID, binIndex)
  /////////////////////////////////////////////////////////////////////////
  const binSize = 20; // Adjust as desired
  const nested = d3.rollups(
    data,
    v => d3.mean(v, d => d.temperature),
    d => d.mouseID,
    d => Math.floor(d.minute / binSize)
  );
  // => [ [ 'f1', [ [0, avg], [1, avg] ] ], [ 'f2', ...], ...]

  // Flatten
  let binData = [];
  nested.forEach(([mouseID, binArr]) => {
    binArr.forEach(([binIndex, avgTemp]) => {
      binData.push({
        mouseID,
        binIndex,
        temperature: avgTemp
      });
    });
  });
  // Sort by binIndex so x positions flow left->right
  binData.sort((a,b) => d3.ascending(a.binIndex, b.binIndex));

  /////////////////////////////////////////////////////////////////////////
  // 4.2) SCALES
  /////////////////////////////////////////////////////////////////////////

  // Sort mice in numeric order => f1, f2, f3, ...
  const miceSorted = selectedMice.slice().sort((a,b) => {
    const numA = parseInt(a.slice(1), 10);
    const numB = parseInt(b.slice(1), 10);
    return numA - numB;
  });

  // Y-scale (each mouse is a row)
  const yScale = d3.scaleBand()
    .domain(miceSorted)
    .range([0, miceSorted.length * 30]) // 30 px per row
    .padding(0.1);

  // X-scale (binIndex from min->max)
  const xExtent = d3.extent(binData, d => d.binIndex);
  const xScale = d3.scaleLinear()
    .domain(xExtent)
    .range([0, 1000]); // ~1000 px wide

  // Determine min and max temps
  const [minTemp, maxTemp] = d3.extent(binData, d => d.temperature);

  // ***Key part***: We want cooler=blue, hotter=red. By default, d3.interpolateRdYlBu(0)=red, (1)=blue.
  // So we reverse it with a custom interpolator "t => d3.interpolateRdYlBu(1 - t)" for domain [minTemp, maxTemp].
  const colorScale = d3.scaleSequential(t => d3.interpolateRdYlBu(1 - t))
    .domain([minTemp, maxTemp]);

  /////////////////////////////////////////////////////////////////////////
  // 4.3) CREATE SVG & AXES
  /////////////////////////////////////////////////////////////////////////
  const margin = { top: 50, right: 100, bottom: 60, left: 80 };
  const chartWidth = 1000;   // Must match xScale.range()[1]
  const chartHeight = yScale.range()[1];
  const width = chartWidth + margin.left + margin.right;
  const height = chartHeight + margin.top + margin.bottom;

  const svg = d3.select("#heatmap")
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // x-axis
  const xAxis = d3.axisBottom(xScale)
    .ticks(10)
    .tickFormat(d => d * binSize);
  g.append("g")
    .attr("class", "x-axis")
    .attr("transform", `translate(0,${chartHeight})`)
    .call(xAxis);

  // x-axis label
  g.append("text")
    .attr("class", "x-axis-label")
    .attr("x", chartWidth / 2)
    .attr("y", chartHeight + 40)
    .attr("text-anchor", "middle")
    .style("font-size", "12px")
    .text("Time (binned minutes)");

  // y-axis
  const yAxis = d3.axisLeft(yScale);
  g.append("g")
    .attr("class", "y-axis")
    .call(yAxis);

  // y-axis label
  g.append("text")
    .attr("class", "y-axis-label")
    .attr("x", -chartHeight / 2)
    .attr("y", -55)
    .attr("transform", "rotate(-90)")
    .attr("text-anchor", "middle")
    .style("font-size", "12px")
    .text("Mouse IDs");

  // Title
  g.append("text")
    .attr("x", chartWidth / 2)
    .attr("y", -10)
    .attr("text-anchor", "middle")
    .style("font-size", "16px")
    .text("Interactive Mouse Temperatures Over 14 Days");

  /////////////////////////////////////////////////////////////////////////
  // 4.4) DEFINE A CLIP PATH TO PREVENT OVERLAP WHEN ZOOMING
  /////////////////////////////////////////////////////////////////////////
  svg.append("defs")
    .append("clipPath")
    .attr("id", "chart-clip")
    .append("rect")
    .attr("width", chartWidth)
    .attr("height", chartHeight);

  /////////////////////////////////////////////////////////////////////////
  // 4.5) DRAW HEATMAP RECTS INSIDE A CLIPPED GROUP
  /////////////////////////////////////////////////////////////////////////
  const chartG = g.append("g")
    .attr("class", "heatmap-cells")
    .attr("clip-path", "url(#chart-clip)");

  const rectW = xScale(1) - xScale(0); // width of one bin
  const rects = chartG.selectAll("rect.heat-cell")
    .data(binData)
    .enter()
    .append("rect")
    .attr("class", "heat-cell")
    .attr("x", d => xScale(d.binIndex))
    .attr("y", d => yScale(d.mouseID))
    .attr("width", rectW)
    .attr("height", yScale.bandwidth())
    .attr("fill", d => colorScale(d.temperature));

  /////////////////////////////////////////////////////////////////////////
  // 4.6) TOOLTIP
  /////////////////////////////////////////////////////////////////////////
  const tooltip = d3.select("#heatmap")
    .append("div")
    .attr("class", "heatmap-tooltip")
    .style("opacity", 0);

  rects
    .on("mouseover", (evt, d) => {
      tooltip.style("opacity", 1)
        .html(`Mouse: <b>${d.mouseID}</b><br>
               Bin: ${d.binIndex * binSize} min<br>
               Temp: ${d.temperature.toFixed(2)}°C`);
    })
    .on("mousemove", evt => {
      tooltip
        .style("left", (evt.pageX + 10) + "px")
        .style("top", (evt.pageY - 20) + "px");
    })
    .on("mouseout", () => {
      tooltip.style("opacity", 0);
    });

  /////////////////////////////////////////////////////////////////////////
  // 4.7) COLOR LEGEND (HOT=RED at TOP, COLD=BLUE at BOTTOM)
  /////////////////////////////////////////////////////////////////////////
  const legendHeight = 200;

  // We'll treat the top of the legend as the hottest (maxTemp), the bottom as the coldest (minTemp).
  // So domain is [maxTemp, minTemp] => 0 => top, 200 => bottom
  const legendScale = d3.scaleLinear()
    .domain([maxTemp, minTemp])  // top->bottom
    .range([0, legendHeight]);   // 0 at top, 200 at bottom

  const legendAxis = d3.axisRight(legendScale)
    .ticks(5)
    .tickFormat(d => d.toFixed(1));

  // The gradient definition
  const defsLegend = svg.append("defs");
  const gradient = defsLegend.append("linearGradient")
    .attr("id", "tempGradient")
    .attr("x1", "0%").attr("y1", "0%")
    .attr("x2", "0%").attr("y2", "100%");

  // offset=0 => colorScale(maxTemp)=red, offset=100 => colorScale(minTemp)=blue
  [ [0, maxTemp], [100, minTemp] ].forEach(([offset, val]) => {
    gradient.append("stop")
      .attr("offset", offset + "%")
      .attr("stop-color", colorScale(val));
  });

  const legendG = svg.append("g")
    .attr("transform", `translate(${width - margin.right + 30}, ${margin.top})`);

  legendG.append("rect")
    .attr("width", 15)
    .attr("height", legendHeight)
    .style("fill", "url(#tempGradient)");

  legendG.append("g")
    .attr("transform", `translate(15, 0)`)
    .call(legendAxis);

  legendG.append("text")
    .attr("x", -15)
    .attr("y", -10)
    .style("font-size", "12px")
    .text("Temp (°C)");

  /////////////////////////////////////////////////////////////////////////
  // 4.8) BRUSH FOR HORIZONTAL ZOOM (+ STORED INITIAL DOMAIN & RESET)
  /////////////////////////////////////////////////////////////////////////
  const initialDomain = xScale.domain();

  const brush = d3.brushX()
    .extent([[0, 0], [chartWidth, chartHeight]])
    .on("end", brushed);

  g.append("g")
    .attr("class", "brush")
    .call(brush);

  function brushed(evt) {
    if (!evt.selection) return; // user cleared
    const [x0, x1] = evt.selection;
    const bin0 = xScale.invert(x0);
    const bin1 = xScale.invert(x1);

    // Update domain
    xScale.domain([bin0, bin1]);

    // Redraw x-axis
    g.select(".x-axis")
      .call(d3.axisBottom(xScale).ticks(5).tickFormat(d => Math.round(d * binSize)));

    // Reposition rects (within the clip)
    chartG.selectAll("rect.heat-cell")
      .attr("x", d => xScale(d.binIndex))
      .attr("width", xScale(1) - xScale(0));

    // Clear brush
    g.select(".brush").call(brush.move, null);
  }

  /////////////////////////////////////////////////////////////////////////
  // 4.9) RESET ZOOM BUTTON
  /////////////////////////////////////////////////////////////////////////
  d3.select("#heatmap").append("button")
    .attr("id", "resetZoomBtn")
    .style("margin-top", "10px")
    .text("Reset Zoom")
    .on("click", resetZoom);

  function resetZoom() {
    // Restore the xScale domain
    xScale.domain(initialDomain);

    // Redraw x-axis
    g.select(".x-axis")
      .call(d3.axisBottom(xScale).ticks(10).tickFormat(d => d * binSize));

    // Re-draw rects
    chartG.selectAll("rect.heat-cell")
      .attr("x", d => xScale(d.binIndex))
      .attr("width", xScale(1) - xScale(0));
  }
}