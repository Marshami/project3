// main.js

/////////////////////////////////////
// 1) Load the CSV & Convert Data //
/////////////////////////////////////
d3.csv("data/Mouse_Data_Student_Copy.csv")
  .then(rawData => {
    // Check if we actually got rows:
    console.log("CSV loaded. Row count:", rawData.length);
    if (rawData.length === 0) {
      console.warn("No data rows found. Check if the CSV is empty or path is incorrect.");
      return; // Stop if no data
    }

    // Print a sample row for debugging:
    console.log("First row sample:", rawData[0]);

    // If your CSV has columns named F1,F2..., you may need to adapt these lines:
    // We'll assume the CSV has columns: f1,f2,...,f13 in the header, plus 'minute' we create.

    // STEP A: Add a numeric "minute" based on row index
    rawData.forEach((row, i) => {
      row.minute = i; // 0-based index
    });

    // STEP B: Convert from WIDE to LONG format
    const longData = [];
    rawData.forEach(row => {
      const minVal = +row.minute; // parse to number
      Object.keys(row).forEach(col => {
        // Skip the artificially added "minute" key
        if (col === "minute") return;

        const val = row[col];
        // Check that we have a valid string
        if (val !== undefined && val.trim() !== "") {
          // Convert to number
          const tempNum = +val;
          if (!Number.isNaN(tempNum)) {
            longData.push({
              mouseID: col,       // e.g. "f1"
              minute: minVal,     // numeric minute
              temperature: tempNum
            });
          } else {
            // This row had a non-numeric value; you can decide whether to skip or log a warning
            // console.warn(`Non-numeric temperature for mouse ${col}, minute ${minVal}: "${val}"`);
          }
        }
      });
    });

    console.log("longData length:", longData.length);
    if (longData.length === 0) {
      console.warn("longData is empty—maybe column names don’t match, or all values are non-numeric.");
      return; // No valid data to visualize
    }

    // Distinct mouse IDs
    const allMice = [...new Set(longData.map(d => d.mouseID))];
    console.log("Mouse IDs found:", allMice);

    /////////////////////////////////
    // 2) Generate Charts         //
    /////////////////////////////////
    createMultiLineChart(longData, allMice, "#chart1");
    createSingleMouseLine(longData, "f1", "#chart2");   // Example: "f1"
    createBarChartAvgTemp(longData, allMice, "#chart3");
    createDayNightComparison(longData, "f1", "#chart4");
    createBrushZoomChart(longData, "f2", "#chart5");    // Example: "f2"

    // If you have more charts, define more functions and call them here.

  })
  .catch(err => {
    console.error("Error loading CSV:", err);
  });


//////////////////////////////////////////////////////
// 2.1) Multi‐Line Chart: All Mice in One SVG       //
//////////////////////////////////////////////////////
function createMultiLineChart(data, allMice, container) {
  console.log("createMultiLineChart() called for container:", container);

  const width = 800,
        height = 300,
        margin = { top: 30, right: 120, bottom: 50, left: 60 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  // Group data by mouseID
  const nested = d3.groups(data, d => d.mouseID);

  // x/y domains
  const xExtent = d3.extent(data, d => d.minute);
  const yExtent = d3.extent(data, d => d.temperature);

  // Check for NaN in your extents
  console.log("xExtent (minutes):", xExtent);
  console.log("yExtent (temp):", yExtent);

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

  // Append SVG
  const svg = d3.select(container).append("svg")
    .attr("width", width)
    .attr("height", height);

  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // Draw one path per mouse
  nested.forEach(([mID, recs]) => {
    recs.sort((a,b) => d3.ascending(a.minute, b.minute));
    g.append("path")
      .datum(recs)
      .attr("fill", "none")
      .attr("stroke", colorScale(mID))
      .attr("stroke-width", 1.2)
      .attr("opacity", 0.8)
      .attr("d", line);
  });

  // Axes
  const xAxis = d3.axisBottom(xScale).ticks(10);
  const yAxis = d3.axisLeft(yScale).ticks(6);

  g.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(xAxis);

  g.append("g")
    .attr("class", "axis")
    .call(yAxis);

  // Title
  g.append("text")
    .attr("x", innerWidth / 2)
    .attr("y", -10)
    .attr("text-anchor", "middle")
    .style("font-size", "14px")
    .text("Multi‐Line: All Mice Temperature Over Time");

  // Legend
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
// 2.2) Single Mouse Line Chart                     //
//////////////////////////////////////////////////////
function createSingleMouseLine(data, mouseID, container) {
  console.log("createSingleMouseLine() for:", mouseID, "in", container);

  const filtered = data.filter(d => d.mouseID === mouseID);
  if (filtered.length === 0) {
    console.warn(`No data for mouseID: ${mouseID}`);
    return;
  }

  const width = 400,
        height = 300,
        margin = { top: 30, right: 20, bottom: 40, left: 50 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  // x/y domains
  filtered.sort((a,b) => d3.ascending(a.minute, b.minute));
  const xExtent = d3.extent(filtered, d => d.minute);
  const yExtent = d3.extent(filtered, d => d.temperature);

  console.log(`[SingleMouse] xExtent:`, xExtent, `yExtent:`, yExtent);

  const xScale = d3.scaleLinear().domain(xExtent).range([0, innerWidth]);
  const yScale = d3.scaleLinear().domain(yExtent).range([innerHeight, 0]).nice();

  // line generator
  const line = d3.line()
    .x(d => xScale(d.minute))
    .y(d => yScale(d.temperature));

  // Append SVG
  const svg = d3.select(container).append("svg")
    .attr("width", width)
    .attr("height", height);

  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // path
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
  console.log("createBarChartAvgTemp() in", container);

  // Group by mouse => average temperature
  const avgByMouse = d3.rollups(
    data,
    v => d3.mean(v, d => d.temperature),
    d => d.mouseID
  );
  // Sort by mouse ID, or by value
  avgByMouse.sort((a,b) => d3.ascending(a[0], b[0]));

  console.log("Averages by mouse:", avgByMouse);

  const width = 500, height = 300;
  const margin = { top: 30, right: 20, bottom: 70, left: 60 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  // Scales
  const x = d3.scaleBand()
    .domain(avgByMouse.map(d => d[0]))  // mouseID
    .range([0, innerWidth])
    .padding(0.2);

  const y = d3.scaleLinear()
    .domain([0, d3.max(avgByMouse, d => d[1])])
    .range([innerHeight, 0])
    .nice();

  // SVG
  const svg = d3.select(container).append("svg")
    .attr("width", width)
    .attr("height", height);

  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // Bars
  g.selectAll("rect")
    .data(avgByMouse)
    .enter()
    .append("rect")
    .attr("x", d => x(d[0]))
    .attr("width", x.bandwidth())
    .attr("y", d => y(d[1]))
    .attr("height", d => innerHeight - y(d[1]))
    .attr("fill", "tomato");

  // Axes
  const xAxis = d3.axisBottom(x);
  const yAxis = d3.axisLeft(y).ticks(5);

  g.append("g")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(xAxis)
    .selectAll("text")
    .style("text-anchor", "middle");

  g.append("g").call(yAxis);

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
  console.log("createDayNightComparison() for:", mouseID);

  // Filter for this mouse
  const filtered = data.filter(d => d.mouseID === mouseID);
  if (!filtered.length) {
    console.warn(`No data found for mouseID ${mouseID} in day/night chart.`);
    return;
  }

  // Tag each record as Day or Night
  // For example, minutes 0-719 => "Night", 720-1439 => "Day"
  const withDayNight = filtered.map(d => {
    const minOfDay = d.minute % 1440;
    return {
      ...d,
      dayOrNight: (minOfDay < 720) ? "Night" : "Day"
    };
  });

  // Group by dayOrNight => average
  const grouped = d3.rollups(
    withDayNight,
    v => d3.mean(v, d => d.temperature),
    d => d.dayOrNight
  );
  // => [ [ 'Night', 37.12 ], [ 'Day', 37.53 ] ]
  console.log("Day/Night averages:", grouped);

  const width = 300, height = 300;
  const margin = { top: 30, right: 20, bottom: 40, left: 50 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  // Scales
  const x = d3.scaleBand()
    .domain(["Night","Day"])
    .range([0, innerWidth])
    .padding(0.2);

  const maxTemp = d3.max(grouped, d => d[1]);
  const y = d3.scaleLinear()
    .domain([0, maxTemp])
    .range([innerHeight, 0])
    .nice();

  // SVG
  const svg = d3.select(container).append("svg")
    .attr("width", width)
    .attr("height", height);

  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // Bars
  g.selectAll("rect")
    .data(grouped)
    .enter()
    .append("rect")
    .attr("x", d => x(d[0]))
    .attr("width", x.bandwidth())
    .attr("y", d => y(d[1]))
    .attr("height", d => innerHeight - y(d[1]))
    .attr("fill", d => d[0] === "Night" ? "darkblue" : "gold");

  // Axes
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
// 2.5) Brush/Zoom Chart (Prototype Interaction)    //
//////////////////////////////////////////////////////
function createBrushZoomChart(data, mouseID, container) {
  console.log("createBrushZoomChart() for:", mouseID);

  // Filter for one mouse
  const filtered = data.filter(d => d.mouseID === mouseID);
  if (!filtered.length) {
    console.warn(`No data found for mouseID ${mouseID} in brush/zoom chart.`);
    return;
  }

  filtered.sort((a,b) => d3.ascending(a.minute, b.minute));

  const width = 600, height = 300;
  const margin = { top: 30, right: 20, bottom: 50, left: 60 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const svg = d3.select(container).append("svg")
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

  const xAxisG = g.append("g")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(xAxis);

  g.append("g").call(yAxis);

  // Title
  g.append("text")
    .attr("x", innerWidth / 2)
    .attr("y", -10)
    .attr("text-anchor", "middle")
    .style("font-size", "13px")
    .text(`Brush/Zoom Prototype (${mouseID})`);

  // Brush
  const brush = d3.brushX()
    .extent([[0, 0], [innerWidth, innerHeight]])
    .on("end", brushed);

  g.append("g")
    .attr("class", "brush")
    .call(brush);

  function brushed(event) {
    const selection = event.selection;
    if (!selection) {
      // User cleared or clicked outside brush
      return;
    }
    const [x0, x1] = selection;
    // Convert pixel range -> data range
    const newMinX = xScale.invert(x0);
    const newMaxX = xScale.invert(x1);

    // Update domain
    xScale.domain([newMinX, newMaxX]);

    // Redraw line & x-axis
    linePath.attr("d", lineGen);
    xAxisG.call(xAxis);

    // Clear brush selection
    g.select(".brush").call(brush.move, null);
  }
}