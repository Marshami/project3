// main.js
////////////////////////////////////////////////////////////
// 1) LOAD WIDE CSV, TRANSFORM -> LONG, THEN DOWNSAMPLE   //
////////////////////////////////////////////////////////////
let allMouseIDs = [];
let downsampledData = [];

d3.csv("data/Mouse_Data_Student_Copy.csv").then(rawData => {
  console.log("Rows loaded from CSV:", rawData.length);

  // 1.1) Convert each row to have minute = i
  rawData.forEach((row, i) => {
    row.minute = i;
  });

  // 1.2) WIDE -> LONG
  const longData = [];
  rawData.forEach(row => {
    const minVal = +row.minute;
    Object.keys(row).forEach(col => {
      if (col === "minute") return;
      const val = row[col];
      if (val) {
        const numVal = +val;
        if (!isNaN(numVal)) {
          longData.push({
            mouseID: col,       // e.g. "f1"
            minute: minVal,
            temperature: numVal
          });
        }
      }
    });
  });
  console.log("longData length:", longData.length);

  // 1.3) Tag each record with day, sex, and estrus logic if needed
  longData.forEach(d => {
    d.sex = d.mouseID.toLowerCase().startsWith("f") ? "F" : "M";
    d.day = Math.floor(d.minute / 1440);
    // example: every 4th day from day=2 => estrus
    d.isEstrus = (d.sex === "F") && (d.day % 4 === 2);
  });

  // 1.4) DOWNSAMPLE (AGGREGATE) BY 5 MINUTES
  // This drastically reduces data points (1/5 as many).
  downsampledData = downsampleData(longData, 5);

  // Distinct mice
  allMouseIDs = [...new Set(downsampledData.map(d => d.mouseID))];
  console.log("All Mouse IDs:", allMouseIDs);

  // Create checkboxes
  createCheckboxes(allMouseIDs);

  // Draw chart with all mice selected by default
  updateChart();

}).catch(err => {
  console.error("Error loading CSV:", err);
});

///////////////////////////////////////////////////////
// 2) HELPER FUNCTION: DOWNSAMPLE EVERY binSize MINUTES
///////////////////////////////////////////////////////
function downsampleData(originalData, binSize = 5) {
  // Group by mouseID, then by bin index => mean temperature
  // binIndex = Math.floor(minute / binSize)
  const grouped = d3.rollups(
    originalData,
    v => {
      // compute average temperature in this bin
      return d3.mean(v, d => d.temperature);
    },
    d => d.mouseID,
    d => Math.floor(d.minute / binSize)
  );
  // grouped looks like:
  // [ [ 'f1', [ [0, meanTemp], [1, meanTemp], ... ] ],
  //   [ 'f2', ... ],
  //   ...
  // ]

  // We'll also carry forward day, sex, and estrus logic
  // but we must pick some representative from that bin.
  // We'll pick the first record for day/sex/estrus or compute them logically.

  // Build a new flattened array
  const newArray = [];
  grouped.forEach(([mouseID, binArr]) => {
    binArr.forEach(([binIndex, meanTemp]) => {
      // approximate the minute as binIndex * binSize
      const approxMinute = binIndex * binSize;
      // day is then approxMinute // 1440
      const approxDay = Math.floor(approxMinute / 1440);
      // If you want estrus logic: check if approxDay % 4 === 2 for female
      const isFemale = mouseID.toLowerCase().startsWith("f");
      const isEstrus = (isFemale && (approxDay % 4 === 2));

      newArray.push({
        mouseID,
        minute: approxMinute,
        temperature: meanTemp,
        sex: isFemale ? "F" : "M",
        day: approxDay,
        isEstrus
      });
    });
  });

  // Sort by minute to keep lines consistent
  newArray.sort((a,b) => d3.ascending(a.minute, b.minute));
  return newArray;
}

///////////////////////////////////////////
// 3) CREATE CHECKBOXES FOR MOUSE TOGGLING
///////////////////////////////////////////
function createCheckboxes(mouseIDs) {
  const container = d3.select("#mouseToggles");
  container.html("");

  mouseIDs.forEach(mID => {
    const lbl = container.append("label")
      .style("margin-right", "10px");

    lbl.append("input")
      .attr("type", "checkbox")
      .attr("value", mID)
      .property("checked", true)
      .on("change", updateChart);

    lbl.append("span").text(mID);
  });
}

///////////////////////////////
// 4) UPDATE CHART (re-draw)  //
///////////////////////////////
function updateChart() {
  // Which mice are checked?
  const checked = [];
  d3.selectAll("#mouseToggles input[type=checkbox]").each(function() {
    if (this.checked) checked.push(this.value);
  });

  d3.select("#finalChart").selectAll("*").remove(); // clear old chart

  if (!checked.length) {
    d3.select("#finalChart").append("p").text("No mice selected.");
    return;
  }

  createFinalChart(downsampledData, checked, "#finalChart", allMouseIDs);
}

////////////////////////////////////////
// 5) CREATE FINAL CHART (Optimized)  //
////////////////////////////////////////
function createFinalChart(allData, selectedMice, container, allMIDs) {
  // Filter data for selected mice only
  const data = allData.filter(d => selectedMice.includes(d.mouseID));

  // Dimensions
  const width = 900,
        height = 500,
        margin = { top: 50, right: 150, bottom: 50, left: 60 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  // SVG
  const svg = d3.select(container)
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // x scale
  const xExtent = d3.extent(data, d => d.minute);
  const xScale = d3.scaleLinear()
    .domain(xExtent)
    .range([0, innerWidth]);

  // y scale
  const yExtent = d3.extent(data, d => d.temperature);
  const yScale = d3.scaleLinear()
    .domain(yExtent)
    .range([innerHeight, 0])
    .nice();

  // color scale
  const colorScale = d3.scaleOrdinal(d3.schemeTableau10)
    .domain(allMIDs);

  // axes
  const xAxis = d3.axisBottom(xScale).ticks(10);
  const yAxis = d3.axisLeft(yScale).ticks(6);

  g.append("g")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(xAxis);
  g.append("g").call(yAxis);

  // Title
  g.append("text")
    .attr("x", innerWidth / 2)
    .attr("y", -10)
    .attr("text-anchor", "middle")
    .style("font-size", "16px")
    .text("Downsampled Mouse Temperatures Over 14 Days (5-min bins)");

  // Group by mouseID
  const nested = d3.groups(data, d => d.mouseID).map(([mID, recs]) => {
    // ensure time-sorted
    recs.sort((a,b) => d3.ascending(a.minute, b.minute));
    return { mouseID: mID, records: recs };
  });

  // optional: highlight estrus days
  // gather unique day numbers where isEstrus is true
  const estrusDays = new Set(data.filter(d => d.isEstrus).map(d => d.day));
  estrusDays.forEach(dayNum => {
    // day -> minute range from dayNum*1440 to (dayNum+1)*1440
    const start = dayNum * 1440 / 5;  // but we have 5-min bins => scale carefully
    const end = (dayNum+1) * 1440 / 5;
    // or just do minute scale directly: dayNum * (1440 / binSize)
    if (start > xExtent[1] || end < xExtent[0]) return;

    g.append("rect")
      .attr("x", xScale(start))
      .attr("y", 0)
      .attr("width", xScale(end) - xScale(start))
      .attr("height", innerHeight)
      .attr("fill", "pink")
      .attr("opacity", 0.15);
  });

  // line generator
  const line = d3.line()
    .x(d => xScale(d.minute))
    .y(d => yScale(d.temperature));

  // draw paths (no circles!)
  nested.forEach(group => {
    g.append("path")
      .datum(group.records)
      .attr("fill", "none")
      .attr("stroke", colorScale(group.mouseID))
      .attr("stroke-width", 2)
      .attr("d", line)
      .attr("opacity", 0.9);
  });

  // BRUSH
  const brush = d3.brushX()
    .extent([[0,0],[innerWidth,innerHeight]])
    .on("end", brushed);

  g.append("g").attr("class", "brush").call(brush);

  function brushed(evt) {
    if (!evt.selection) return;
    const [x0, x1] = evt.selection;
    const minX = xScale.invert(x0);
    const maxX = xScale.invert(x1);

    // update domain
    xScale.domain([minX, maxX]);
    // redraw axis
    g.select(".brush").call(brush.move, null); // clear brush
    g.selectAll("path").attr("d", d => line(d)); // re-draw lines
    g.selectAll("rect") // re-draw estrus shading if needed
      .attr("x", r => parseFloat(d3.select(r).attr("x"))); // or remove & re-draw
    g.select(".x-axis").call(xAxis);
  }

  // minimal legend
  const legend = svg.append("g")
    .attr("transform", `translate(${width - margin.right}, ${margin.top})`);

  nested.forEach((gr, i) => {
    const yPos = i * 20;
    legend.append("rect")
      .attr("x", 0)
      .attr("y", yPos)
      .attr("width", 12)
      .attr("height", 12)
      .attr("fill", colorScale(gr.mouseID));
    legend.append("text")
      .attr("x", 20)
      .attr("y", yPos + 10)
      .text(gr.mouseID)
      .style("font-size", "12px");
  });
}