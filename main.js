// main.js

// 1) Load the CSV in "wide" format and transform to "long" format
d3.csv("data/Mouse_Data_Student_Copy.csv").then(rawData => {
    // Each element in rawData is an object with keys like f1,f2,...,f13 (for example).
    // We'll add a 'minute' property based on the row index:
    rawData.forEach((row, i) => {
      row.minute = i; // zero-based index = "time"
    });
  
    // Convert from wide to long
    // For each row, each "fX" becomes a new record: { mouseID: "fX", minute, temperature }
    const longData = [];
    rawData.forEach(row => {
      const minuteVal = +row.minute; // convert to number
      // Loop over all keys in this row
      Object.keys(row).forEach(col => {
        if (col === "minute") return; // skip the minute field itself
        const val = row[col];
        if (val !== undefined && val !== "") {
          longData.push({
            mouseID: col,
            minute: minuteVal,
            temperature: +val // parse string to number
          });
        }
      });
    });
  
    // Now we have an array of records: 
    // { mouseID: 'f1', minute: 0, temperature: 37.11 }, etc.
  
    // Build the chart
    createMultiLineChart(longData);
  
  }).catch(error => {
    console.error("Error loading CSV:", error);
  });
  
  
  // 2) Multi-Line Chart Function
  function createMultiLineChart(data) {
    // Chart dimensions
    const width = 800;
    const height = 400;
    const margin = { top: 40, right: 120, bottom: 50, left: 60 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
  
    // Create SVG
    const svg = d3.select("#chart")
      .append("svg")
      .attr("width", width)
      .attr("height", height);
  
    // Main group to hold chart elements
    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);
  
    // Group data by mouseID
    const nested = d3.groups(data, d => d.mouseID);
    // nested = [ [ 'f1', [ {mouseID:'f1', minute:..., temperature:...}, ... ] ],
    //            [ 'f2', [ ... ] ],
    //            ... ]
  
    // Determine the domain for x (minute) and y (temperature)
    const xExtent = d3.extent(data, d => d.minute);
    const yExtent = d3.extent(data, d => d.temperature);
  
    // Scales
    const xScale = d3.scaleLinear()
      .domain(xExtent)
      .range([0, innerWidth]);
  
    const yScale = d3.scaleLinear()
      .domain(yExtent)
      .range([innerHeight, 0])
      .nice();
  
    // Color scale for each mouse line
    const mouseIDs = nested.map(([mID]) => mID); // ['f1','f2','f3',...]
    const colorScale = d3.scaleOrdinal()
      .domain(mouseIDs)
      .range(d3.schemeCategory10);
  
    // Line generator
    const lineGen = d3.line()
      .x(d => xScale(d.minute))
      .y(d => yScale(d.temperature));
  
    // Draw a path for each mouse
    nested.forEach(([mID, records]) => {
      // Sort by minute so the line goes left to right
      records.sort((a, b) => d3.ascending(a.minute, b.minute));
  
      g.append("path")
        .datum(records)
        .attr("fill", "none")
        .attr("stroke", colorScale(mID))
        .attr("stroke-width", 1.5)
        .attr("opacity", 0.9)
        .attr("d", lineGen);
    });
  
    // Axes
    const xAxis = d3.axisBottom(xScale)
      .ticks(10)
      .tickFormat(d => d);
  
    const yAxis = d3.axisLeft(yScale).ticks(6);
  
    g.append("g")
      .attr("class", "axis")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(xAxis)
      .append("text")
      .attr("x", innerWidth / 2)
      .attr("y", 35)
      .attr("fill", "black")
      .attr("text-anchor", "middle")
      .text("Minute");
  
    g.append("g")
      .attr("class", "axis")
      .call(yAxis)
      .append("text")
      .attr("x", -innerHeight / 2)
      .attr("y", -45)
      .attr("fill", "black")
      .attr("text-anchor", "middle")
      .attr("transform", "rotate(-90)")
      .text("Temperature (°C)");
  
    // Title
    g.append("text")
      .attr("x", innerWidth / 2)
      .attr("y", -10)
      .attr("text-anchor", "middle")
      .style("font-size", "16px")
      .text("Mouse Temperatures Over Time");
  
    // Simple legend on the right side
    const legend = svg.append("g")
      .attr("transform", `translate(${width - margin.right + 20}, ${margin.top})`);
  
    mouseIDs.forEach((mID, i) => {
      const yPos = i * 20;
      // color box
      legend.append("rect")
        .attr("class", "legend-rect")
        .attr("x", 0)
        .attr("y", yPos)
        .attr("width", 12)
        .attr("height", 12)
        .attr("fill", colorScale(mID));
  
      // label text
      legend.append("text")
        .attr("class", "legend-item")
        .attr("x", 20)
        .attr("y", yPos + 10)
        .style("font-size", "12px")
        .text(mID);
    });
  }  