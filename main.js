// main.js

////////////////////////////////////
// 1) LOAD CSV & WIDE->LONG 
////////////////////////////////////
let fullData = [];
let allMice = [];

d3.csv("data/Mouse_Data_Student_Copy.csv").then(rawData => {
  console.log("CSV rows loaded:", rawData.length);

  // Tag each row with a minute index
  rawData.forEach((row, i) => {
    row.minute = i; 
  });

  // Reshape wide->long
  rawData.forEach(row => {
    const minVal = +row.minute;
    Object.keys(row).forEach(col => {
      if (col === "minute") return;
      const val = row[col];
      if (val) {
        const temp = +val;
        if (!isNaN(temp)) {
          fullData.push({
            mouseID: col,
            minute: minVal,
            temperature: temp
          });
        }
      }
    });
  });

  // Distinct mouse IDs
  allMice = [...new Set(fullData.map(d => d.mouseID))];
  console.log("All mice:", allMice);

  // Build checkboxes
  createMouseToggles(allMice);

  // Render heatmap with all mice selected by default
  updateHeatmap();

}).catch(err => {
  console.error("Error loading CSV:", err);
});


////////////////////////////////////
// 2) CREATE CHECKBOXES
////////////////////////////////////
function createMouseToggles(mouseIDs) {
  const container = d3.select("#mouseToggles");
  container.selectAll("*").remove();

  container.append("p").text("Select which mice to display below:");

  mouseIDs.forEach(mID => {
    const label = container.append("label");
    label.append("input")
      .attr("type", "checkbox")
      .attr("value", mID)
      .property("checked", true)
      .on("change", updateHeatmap);
    label.append("span").text(mID);
  });
}


////////////////////////////////////
// 3) UPDATE HEATMAP ON TOGGLE
////////////////////////////////////
function updateHeatmap() {
  // Which mice are checked?
  const selected = [];
  d3.selectAll("#mouseToggles input[type=checkbox]").each(function() {
    if (this.checked) selected.push(this.value);
  });

  // Clear old chart
  d3.select("#heatmap").selectAll("*").remove();

  // If none selected, show message
  if (!selected.length) {
    d3.select("#heatmap").append("p").text("No mice selected!");
    return;
  }

  // Filter fullData to only those mice
  const filtered = fullData.filter(d => selected.includes(d.mouseID));

  // Create & render the heatmap
  createHeatmap(filtered, selected);
}


////////////////////////////////////////////////////////
// 4) CREATE HEATMAP with Brush, Tooltip, Color Scale
////////////////////////////////////////////////////////
function createHeatmap(data, selectedMice) {
  // A) Downsample: For example, 20-minute bins
  const binSize = 20; // adjust to 5, 10, 30, etc.
  // Group by mouseID + bin => average temperature
  const nested = d3.rollups(
    data,
    v => d3.mean(v, d => d.temperature),
    d => d.mouseID,
    d => Math.floor(d.minute / binSize)
  );
  // => [ [ 'f1', [ [ binIndex, avgTemp ], [ binIndex, avgTemp ] ] ], [ 'f2', ...], ...]

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

  // For convenience, sort by binIndex
  binData.sort((a,b) => d3.ascending(a.binIndex, b.binIndex));

  // B) Build scales
  const miceSorted = selectedMice.slice().sort(); // sort the selected mouse IDs
  const yScale = d3.scaleBand()
    .domain(miceSorted) 
    .range([0, miceSorted.length * 30]) // 30 px per row
    .padding(0.1);

  const xExtent = d3.extent(binData, d => d.binIndex);
  const xScale = d3.scaleLinear()
    .domain(xExtent)
    .range([0, 1000]); // 1000 px wide chart, adjust as needed

  // Temperature range
  const [minTemp, maxTemp] = d3.extent(binData, d => d.temperature);
  const colorScale = d3.scaleSequential(d3.interpolateSpectral)
    .domain([maxTemp, minTemp]); 
    // invert so hot = red, cold = blue (Spectral is reversed typically)

  // C) Create SVG
  const margin = { top: 50, right: 100, bottom: 50, left: 80 };
  const width = 1200,
        height = yScale.range()[1] + margin.top + margin.bottom + 50; // room for axis

  const svg = d3.select("#heatmap")
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // D) Axes
  const xAxis = d3.axisBottom(xScale)
    .ticks(10)
    .tickFormat(d => d * binSize); 
    // Convert binIndex back to "actual minutes"
  g.append("g")
    .attr("class", "x-axis")
    .attr("transform", `translate(0,${yScale.range()[1]})`)
    .call(xAxis);

  const yAxis = d3.axisLeft(yScale);
  g.append("g")
    .attr("class", "y-axis")
    .call(yAxis);

  // Title
  g.append("text")
    .attr("x", (xScale.range()[1] / 2))
    .attr("y", -10)
    .attr("text-anchor", "middle")
    .style("font-size", "16px")
    .text("Interactive Mouse Temperatures Over 14 Days");

  // E) Draw Heatmap Rects
  // For each row in binData => x = binIndex, y = mouseID
  const rects = g.selectAll("rect.heat-cell")
    .data(binData)
    .enter()
    .append("rect")
    .attr("class", "heat-cell")
    .attr("x", d => xScale(d.binIndex))
    .attr("y", d => yScale(d.mouseID))
    .attr("width", xScale(1) - xScale(0)) // width of 1 bin
    .attr("height", yScale.bandwidth())
    .attr("fill", d => colorScale(d.temperature));

  // F) Tooltip 
  // We'll position absolutely inside #heatmap
  const tooltip = d3.select("#heatmap")
    .append("div")
    .attr("class", "heatmap-tooltip");

  rects
    .on("mouseover", (evt, d) => {
      tooltip.style("opacity", 1)
        .html(`Mouse: <b>${d.mouseID}</b><br>
               Bin: ${d.binIndex} (approx ${d.binIndex * binSize} min)<br>
               Temp: ${d.temperature.toFixed(2)}°C`);
    })
    .on("mousemove", (evt) => {
      tooltip
        .style("left", (evt.pageX + 10) + "px")
        .style("top",  (evt.pageY - 20) + "px");
    })
    .on("mouseout", () => {
      tooltip.style("opacity", 0);
    });

  // G) Color Legend (Optional)
  const legendHeight = 200;
  const legendScale = d3.scaleLinear()
    .domain([maxTemp, minTemp])
    .range([0, legendHeight]);
  const legendAxis = d3.axisRight(legendScale)
    .ticks(5)
    .tickFormat(d => d.toFixed(1));

  // gradient
  const defs = svg.append("defs");
  const gradient = defs.append("linearGradient")
    .attr("id", "tempGradient")
    .attr("x1", "0%").attr("y1", "0%")
    .attr("x2", "0%").attr("y2", "100%");
  // colorScale is reversed, so we move from min to max
  [minTemp, maxTemp].forEach((t, i) => {
    gradient.append("stop")
      .attr("offset", i === 0 ? "0%" : "100%")
      .attr("stop-color", colorScale(t));
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
    .attr("x", -20)
    .attr("y", -10)
    .attr("text-anchor", "start")
    .style("font-size", "12px")
    .text("Temp (°C)");

  // H) Brush for horizontal zoom
  // We'll allow brushing along the x-axis only
  const brush = d3.brushX()
    .extent([[0, 0], [xScale.range()[1], yScale.range()[1]]])
    .on("end", brushEnded);

  g.append("g")
    .attr("class", "brush")
    .call(brush);

  function brushEnded(evt) {
    if (!evt.selection) return; // user cleared brush
    const [x0, x1] = evt.selection;  
    const bin0 = xScale.invert(x0);
    const bin1 = xScale.invert(x1);
    // update domain
    xScale.domain([bin0, bin1]);
    // redraw x-axis
    g.select(".x-axis").call(d3.axisBottom(xScale).ticks(5).tickFormat(d => Math.round(d*binSize)));

    // reposition rects
    rects
      .attr("x", d => xScale(d.binIndex))
      .attr("width", xScale(1) - xScale(0));
    // clear brush
    g.select(".brush").call(brush.move, null);
  }
}