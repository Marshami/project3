// main.js

///////////////////////
// 1) LOAD & TRANSFORM
///////////////////////
let longData = [];
let allMouseIDs = [];

d3.csv("data/Mouse_Data_Student_Copy.csv").then(rawData => {
  console.log("Loaded CSV rows:", rawData.length);
  if (!rawData.length) {
    console.warn("No data found in CSV. Check file path/names.");
    return;
  }

  // Add 'minute' index
  rawData.forEach((row, i) => {
    row.minute = i;
  });

  // Reshape from wide to long
  rawData.forEach(row => {
    const minVal = +row.minute;
    Object.keys(row).forEach(col => {
      if (col === "minute") return; // skip artificially added key
      const tempStr = row[col];
      if (tempStr) {
        const tempNum = +tempStr;
        if (!isNaN(tempNum)) {
          // Build record
          longData.push({
            mouseID: col,        // e.g. "f1"
            minute: minVal,
            temperature: tempNum
          });
        }
      }
    });
  });

  // Enrich with sex, day, estrus
  longData.forEach(d => {
    d.sex = d.mouseID.toLowerCase().startsWith("f") ? "F" : "M";
    d.day = Math.floor(d.minute / 1440); 
    // e.g. estrus every 4 days from day=2 (adjust logic if needed)
    d.isEstrus = (d.sex === "F") && (d.day % 4 === 2);
  });

  // Distinct mouse IDs
  allMouseIDs = Array.from(new Set(longData.map(d => d.mouseID)));
  console.log("Mouse IDs found:", allMouseIDs);

  // Generate checkboxes
  createCheckboxes(allMouseIDs);

  // Draw chart initially with all mice selected
  updateChart();
})
.catch(err => {
  console.error("Error loading CSV:", err);
});


////////////////////////////
// 2) CREATE CHECKBOXES   //
////////////////////////////
function createCheckboxes(mouseIDs) {
  const container = d3.select("#mouseToggles");
  container.html(""); // clear if needed

  mouseIDs.forEach(mID => {
    const label = container.append("label")
      .style("margin-right", "10px");

    label.append("input")
      .attr("type", "checkbox")
      .attr("value", mID)
      .attr("checked", true) // default: all selected
      .on("change", updateChart);

    label.append("span").text(mID);
  });
}


////////////////////////////////////////////
// 3) UPDATE CHART (re-draw with filters) //
////////////////////////////////////////////
function updateChart() {
  // Determine which mice are checked
  const checkedMice = [];
  d3.selectAll("#mouseToggles input[type=checkbox]").each(function() {
    if (this.checked) {
      checkedMice.push(this.value);
    }
  });

  // Clear the old chart
  d3.select("#finalChart").selectAll("*").remove();

  // If no mice are selected, do nothing or show a message
  if (!checkedMice.length) {
    d3.select("#finalChart").append("p").text("No mice selected!");
    return;
  }

  // Build final interactive chart with chosen mice
  createFinalInteractiveChart(longData, checkedMice, "#finalChart", allMouseIDs);
}


////////////////////////////////////////////////////////////
// 4) CREATE FINAL INTERACTIVE CHART WITH ADV. FEATURES   //
////////////////////////////////////////////////////////////
function createFinalInteractiveChart(data, selectedMice, container, allMice) {
  // Filter data to only selected mice
  const filtered = data.filter(d => selectedMice.includes(d.mouseID));

  // Dimensions
  const width = 900,
        height = 500,
        margin = { top: 60, right: 150, bottom: 50, left: 60 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  // SVG
  const svg = d3.select(container)
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  const gMain = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // x scale
  const xExtent = d3.extent(filtered, d => d.minute);
  const xScale = d3.scaleLinear()
    .domain(xExtent)
    .range([0, innerWidth]);

  // y scale
  const yExtent = d3.extent(filtered, d => d.temperature);
  const yScale = d3.scaleLinear()
    .domain(yExtent)
    .range([innerHeight, 0])
    .nice();

  // color scale
  const colorScale = d3.scaleOrdinal(d3.schemeTableau10)
    .domain(allMice);

  // Axes
  const xAxis = d3.axisBottom(xScale).ticks(10);
  const yAxis = d3.axisLeft(yScale).ticks(6);

  const gX = gMain.append("g")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(xAxis);

  gMain.append("g").call(yAxis);

  // Title
  gMain.append("text")
    .attr("x", innerWidth / 2)
    .attr("y", -20)
    .attr("text-anchor", "middle")
    .style("font-size", "16px")
    .text("Interactive Mouse Temperatures Over 14 Days");

  // Shading estrus days
  const estrusDays = Array.from(new Set(filtered.filter(d => d.isEstrus).map(d => d.day)));
  const gShade = gMain.append("g").attr("class", "estrus-shading");
  estrusDays.forEach(dayNum => {
    const dayStart = dayNum * 1440;
    const dayEnd = (dayNum + 1) * 1440;
    // If out of x range, skip
    if (dayStart > xExtent[1] || dayEnd < xExtent[0]) return;
    gShade.append("rect")
      .attr("x", xScale(dayStart))
      .attr("y", 0)
      .attr("width", xScale(dayEnd) - xScale(dayStart))
      .attr("height", innerHeight)
      .attr("fill", "pink")
      .attr("opacity", 0.15)
      .append("title")
        .text(`Estrus Day: ${dayNum}`);
  });

  // Nest data by mouse
  const nested = d3.groups(filtered, d => d.mouseID)
    .map(([mID, recs]) => {
      recs.sort((a,b) => d3.ascending(a.minute, b.minute));
      return { mouseID: mID, records: recs };
    });

  // Line generator
  const lineGen = d3.line()
    .x(d => xScale(d.minute))
    .y(d => yScale(d.temperature));

  // Tooltip
  const tooltip = d3.select("body").append("div")
    .attr("role", "tooltip")
    .style("position", "absolute")
    .style("opacity", 0);

  // Draw lines & circles
  nested.forEach(group => {
    const mID = group.mouseID;
    const recs = group.records;

    const gLine = gMain.append("g").attr("class", "mouse-group");

    // Path
    gLine.append("path")
      .datum(recs)
      .attr("fill", "none")
      .attr("stroke", colorScale(mID))
      .attr("stroke-width", 2)
      .attr("opacity", 0.9)
      .attr("d", lineGen);

    // Circles (for tooltips)
    gLine.selectAll("circle")
      .data(recs)
      .join("circle")
      .attr("r", 3)
      .attr("fill", colorScale(mID))
      .attr("cx", d => xScale(d.minute))
      .attr("cy", d => yScale(d.temperature))
      .attr("opacity", 0) // Hide by default, show on hover if you prefer
      .on("mouseover", (evt, d) => {
        tooltip.style("opacity", 1)
          .html(`Mouse: <b>${mID}</b><br>
                 Minute: ${d.minute}<br>
                 Temp: ${d.temperature.toFixed(2)}`);
      })
      .on("mousemove", (evt) => {
        tooltip
          .style("left", evt.pageX + 10 + "px")
          .style("top", evt.pageY - 20 + "px");
      })
      .on("mouseout", () => {
        tooltip.style("opacity", 0);
      });
  });

  // Brush
  const brush = d3.brushX()
    .extent([[0,0],[innerWidth,innerHeight]])
    .on("end", brushed);

  gMain.append("g")
    .attr("class", "brush")
    .call(brush);

  function brushed(evt) {
    const selection = evt.selection;
    if (!selection) return; // user clicked outside or cleared brush
    const [x0, x1] = selection;
    const domain0 = xScale.invert(x0);
    const domain1 = xScale.invert(x1);

    // Update xScale
    xScale.domain([domain0, domain1]);
    // Redraw axis
    gX.call(xAxis);
    // Redraw lines, circles
    redraw();
    // Clear brush
    gMain.select(".brush").call(brush.move, null);
  }

  function redraw() {
    // Update estrus shading
    gShade.selectAll("rect")
      .attr("x", function() {
        const xVal = +d3.select(this).attr("data-day-start") || 0;
        return xScale(xVal);
      })
      .attr("width", function() {
        const dayStart = +d3.select(this).attr("data-day-start") || 0;
        const dayEnd = +d3.select(this).attr("data-day-end") || 0;
        return xScale(dayEnd) - xScale(dayStart);
      });

    // Update paths
    nested.forEach(group => {
      const mID = group.mouseID;
      const recs = group.records;
      gMain.selectAll(".mouse-group path")
        .filter(function() {
          // We can match by color or another attribute
          return d3.select(this).attr("stroke") === colorScale(mID);
        })
        .attr("d", lineGen(recs));
      // Update circles
      gMain.selectAll(".mouse-group circle")
        .filter(d => d.mouseID === mID)
        .attr("cx", d => xScale(d.minute))
        .attr("cy", d => yScale(d.temperature));
    });
  }

  // Legend (static, no toggling here - toggling is done by checkboxes)
  const legend = svg.append("g")
    .attr("transform", `translate(${width - margin.right + 20}, ${margin.top})`);

  nested.forEach((group, i) => {
    const mID = group.mouseID;
    const yPos = i * 20;
    legend.append("rect")
      .attr("x", 0)
      .attr("y", yPos)
      .attr("width", 12)
      .attr("height", 12)
      .attr("fill", colorScale(mID));
    legend.append("text")
      .attr("x", 20)
      .attr("y", yPos + 10)
      .style("font-size", "12px")
      .text(mID);
  });
}